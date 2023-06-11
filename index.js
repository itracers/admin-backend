const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const nginxRouter = require("./nginxRouter");
const { isAuthorizedEmail } = require("./auth");

require("dotenv").config();

const GOOGLE_AUTH_SCOPES = "https://www.googleapis.com/auth/userinfo.email";
const GOOGLE_RESPONSE_TYPE = "code";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_GRANT_TYPE = "authorization_code";
const GOOGLE_USERINFO_ENDPOINT =
  "https://www.googleapis.com/oauth2/v3/userinfo";

const app = express();
app.get("/google-oauth", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).send("Google client ID is not configured");
  }
  res.status(200).json({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: GOOGLE_RESPONSE_TYPE,
    scope: GOOGLE_AUTH_SCOPES,
  });
});
app.get("/google-oauth/callback", async (req, res) => {
  const googleAuthData = await axios.post(GOOGLE_TOKEN_ENDPOINT, {
    code: req.query.code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: req.query.redirect_uri || process.env.GOOGLE_REDIRECT_URI,
    grant_type: GOOGLE_GRANT_TYPE,
  });
  if (!googleAuthData.data.access_token) {
    return res.status(401).json({ error: googleAuthData.data.error });
  }

  const googleUserData = await axios.get(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${googleAuthData.data.access_token}`,
    },
  });
  if (!googleUserData.data.email) {
    return res.status(401).json({ error: googleUserData.data.error });
  }
  if (!isAuthorizedEmail(googleUserData.data.email)) {
    return res.status(403).json({ error: "User has no admin access" });
  }

  return res.status(200).send({
    token: jwt.sign(
      { email: googleUserData.data.email },
      process.env.JWT_SECRET
    ),
  });
});

app.use((req, res, next) => {
  if (process.env.JWT_SECRET && process.env.ADMIN_EMAIL) {
    let token = null;
    try {
      token = jwt.verify(req.headers["authorization"], process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).send("Unauthorized");
    }
    if (!token) {
      return res.status(401).send("Unauthorized");
    }
    if (!isAuthorizedEmail(token.email)) {
      return res.status(403).send("User has no admin access");
    }
  }
  next();
});

app.use(nginxRouter);

app.use((err, _req, res, _next) => {
  if (err && !err.status) {
    res.status(500).send({ error: "Unknown error" });
    console.error(err);
  }
});

app.listen(8082, "localhost");
