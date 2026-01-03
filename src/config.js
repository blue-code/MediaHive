const path = require("path");
require("dotenv").config();

const ROOT_DIR = path.join(__dirname, "..");

function parseList(value = "") {
  return value
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildLibraryRoots(rawPaths) {
  const seen = new Set();

  return rawPaths.map((dir, index) => {
    const resolved = path.resolve(ROOT_DIR, dir);
    const baseName = path.basename(resolved) || `library-${index + 1}`;
    const baseSlug = slugify(baseName) || `library-${index + 1}`;

    let id = baseSlug;
    let counter = 1;
    while (seen.has(id)) {
      counter += 1;
      id = `${baseSlug}-${counter}`;
    }
    seen.add(id);

    return {
      id,
      name: baseName,
      path: resolved,
    };
  });
}

const libraryDirList = parseList(process.env.LIBRARY_DIRS || "");
const legacyLibraryDir = process.env.LIBRARY_DIR;
const libraryDirs = libraryDirList.length ? libraryDirList : [legacyLibraryDir || "library"];
const libraryRoots = buildLibraryRoots(libraryDirs);

function getLibraryRoot(libraryId) {
  if (!libraryId) return libraryRoots[0];
  const found = libraryRoots.find((root) => root.id === libraryId);
  if (!found) {
    const available = libraryRoots.map((root) => root.id).join(", ");
    throw new Error(`Unknown library: ${libraryId}. Available: ${available}`);
  }
  return found;
}

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "local-dev-secret",
  dataDir: process.env.DATA_DIR || path.join(ROOT_DIR, "data"),
  storageDir: process.env.STORAGE_DIR || path.join(ROOT_DIR, "storage"),
  libraryDir: libraryRoots[0]?.path || path.join(ROOT_DIR, "library"),
  libraryRoots,
  getLibraryRoot,
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
