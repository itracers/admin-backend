const { Router } = require("express");
const path = require("path");
const fs = require("fs");

const ConfigParser = require("@webantic/nginx-config-parser");
const parser = new ConfigParser();

const router = Router();

const NGINX_DIR = "/etc/nginx/sites-enabled";

router.get("/nginx", (_req, res) => {
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
  res.status(200).setHeader('content-range', files.length).send(result);
});

module.exports = router;
