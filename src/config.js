const path = require("path");
require("dotenv").config();

const ROOT_DIR = path.join(__dirname, "..");

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "local-dev-secret",
  dataDir: process.env.DATA_DIR || path.join(ROOT_DIR, "data"),
  storageDir: process.env.STORAGE_DIR || path.join(ROOT_DIR, "storage"),
};
