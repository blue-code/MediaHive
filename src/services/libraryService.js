const fs = require("fs");
const path = require("path");
const { archiveExtractDir, libraryDir } = require("../config");
const {
  detectMediaKind,
  ensureArchiveExtracted,
  ensureArchiveThumbnail,
  ensureIosReadyVideo,
  ensureMediaDirs,
  ensureVideoThumbnail,
  findSidecarSubtitles,
  getArchiveExtractionTarget,
  isIosFriendlyVideo,
  touchPath,
} = require("./mediaProcessingService");

const DEFAULT_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB

function resolveLibraryPath(requestedPath = "") {
  const normalized = requestedPath.startsWith("/")
    ? requestedPath.slice(1)
    : requestedPath;
  const absolutePath = path.resolve(libraryDir, normalized || ".");
  const relative = path.relative(path.resolve(libraryDir), absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid path");
  }
  return absolutePath;
}

function describeEntry(entryPath, dirent) {
  const stats = fs.statSync(entryPath);
  const relativePath = path.relative(libraryDir, entryPath);
  const mediaKind = detectMediaKind(entryPath, dirent);
  const base = {
    name: dirent.name,
    path: relativePath,
    type: dirent.isDirectory() ? "directory" : "file",
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };

  if (mediaKind === "video") {
    const thumbnailPath = ensureVideoThumbnail(entryPath, relativePath);
    return {
      ...base,
      mediaKind,
      iosOptimized: isIosFriendlyVideo(entryPath),
      supportsAutoTranscode: true,
      thumbnail: `/thumbnails/${path.basename(thumbnailPath)}`,
      subtitles: findSidecarSubtitles(entryPath),
    };
  }

  if (mediaKind === "archive") {
    const thumbPath = ensureArchiveThumbnail(relativePath);
    return {
      ...base,
      mediaKind,
      thumbnail: `/thumbnails/${path.basename(thumbPath)}`,
      extractionTarget: path.relative(
        archiveExtractDir,
        getArchiveExtractionTarget(relativePath),
      ),
    };
  }

  return {
    ...base,
    mediaKind,
  };
}

function listDirectory(targetPath = "") {
  const absolute = resolveLibraryPath(targetPath);
  if (!fs.existsSync(absolute)) {
    return { error: "Path not found" };
  }
  const stats = fs.statSync(absolute);
  if (!stats.isDirectory()) {
    return { error: "Path is not a directory" };
  }

  ensureMediaDirs();
  const entries = fs
    .readdirSync(absolute, { withFileTypes: true })
    .map((dirent) => describeEntry(path.join(absolute, dirent.name), dirent));

  return {
    items: entries,
    currentPath: path.relative(libraryDir, absolute),
  };
}

function getFileInfo(targetPath = "") {
  const absolute = resolveLibraryPath(targetPath);
  if (!fs.existsSync(absolute)) {
    return { error: "File not found" };
  }
  const stats = fs.statSync(absolute);
  if (!stats.isFile()) {
    return { error: "Not a file" };
  }
  const relativePath = path.relative(libraryDir, absolute);
  const mediaKind = detectMediaKind(absolute, {
    isDirectory: () => false,
  });
  return { absolute, stats, relativePath, mediaKind };
}

function parseRange(rangeHeader, fileSize) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : Math.min(start + DEFAULT_CHUNK_SIZE, fileSize - 1);
  if (Number.isNaN(start) || start < 0 || start >= fileSize) return null;
  return { start, end: Math.min(end, fileSize - 1) };
}

module.exports = {
  listDirectory,
  getFileInfo,
  parseRange,
  ensureArchiveExtracted,
  ensureIosReadyVideo,
  isIosFriendlyVideo,
  touchPath,
};
