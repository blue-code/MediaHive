const path = require("path");
require("dotenv").config();

const ROOT_DIR = path.join(__dirname, "..");

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "local-dev-secret",
  dataDir: process.env.DATA_DIR || path.join(ROOT_DIR, "data"),
  storageDir: process.env.STORAGE_DIR || path.join(ROOT_DIR, "storage"),
  libraryDir: process.env.LIBRARY_DIR || path.join(ROOT_DIR, "library"),
  thumbnailDir: process.env.THUMBNAIL_DIR || path.join(ROOT_DIR, "storage", "thumbnails"),
  archiveExtractDir:
    process.env.ARCHIVE_EXTRACT_DIR || path.join(ROOT_DIR, "storage", "extracted"),
  transcodedDir: process.env.TRANSCODED_DIR || path.join(ROOT_DIR, "storage", "transcoded"),
  cacheTtlHours: Number.parseInt(process.env.CACHE_TTL_HOURS || "6", 10),
  cacheCleanupIntervalMinutes: Number.parseInt(
    process.env.CACHE_CLEANUP_INTERVAL_MINUTES || "30",
    10,
  ),
};
