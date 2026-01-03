const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw || "null") ?? fallback;
  } catch (err) {
    console.error(`Failed to read JSON from ${filePath}:`, err);
    return fallback;
  }
}

function writeJsonSafe(filePath, payload) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    return true;
  } catch (err) {
    console.error(`Failed to write JSON to ${filePath}:`, err);
    return false;
  }
}

module.exports = {
  ensureDir,
  readJsonSafe,
  writeJsonSafe,
};
