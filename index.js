const express = require('express');
const ConfigParser = require('@webantic/nginx-config-parser');
const parser = new ConfigParser();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

require('dotenv').config();

const NGINX_DIR = '/etc/nginx/sites-enabled';
const GOOGLE_AUTH_SCOPES = 'https://www.googleapis.com/auth/userinfo.email';
const GOOGLE_RESPONSE_TYPE = 'code';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_GRANT_TYPE = 'authorization_code';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

const app = express();
app.get('/google-oauth', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).send('Google client ID is not configured');
  }
  res.status(200).json({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: GOOGLE_RESPONSE_TYPE,
    scope: GOOGLE_AUTH_SCOPES,
  });
});
app.get('/google-oauth/callback', async (req, res) => {
  const googleAuthData = await axios.post(
    GOOGLE_TOKEN_ENDPOINT,
    {
      code: req.query.code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: GOOGLE_GRANT_TYPE,
    }
  );
  if (!googleAuthData.data.access_token) {
    return res.status(401).json({ error: googleAuthData.data.error });
  }

  const googleUserData = await axios.get(
    GOOGLE_USERINFO_ENDPOINT,
    {
      headers: {
        Authorization: `Bearer ${googleAuthData.data.access_token}`,
      },
    }
  );
  if (!googleUserData.data.email) {
    return res.status(401).json({ error: googleUserData.data.error });
  }
  if (googleUserData.data.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'User has no admin access' });
  }

  return res
    .status(200)
    .send({
      token: jwt.sign(
        { email: googleUserData.data.email },
        process.env.JWT_SECRET
      ),
    });
});
app.get('/nginx', (req, res) => {
  if (process.env.JWT_SECRET && process.env.ADMIN_EMAIL) {
    const token = jwt.verify(req.query.token, process.env.JWT_SECRET);
    if (!token || token.email !== process.env.ADMIN_EMAIL) {
      return res.status(401).send('Unauthorized');
    }
  }

  const files = fs.readdirSync(NGINX_DIR);
  const result = [];
  for (let file of files) {
    try {
      const data = parser.readConfigFile(path.join(NGINX_DIR, file));
      result.push({ id: file, data, error: null });
    } catch (err) {
      result.push({ id: file, data: null, error: err });
    }
  }
  res.status(200).json(result);
});

app.listen(8082, 'localhost');
