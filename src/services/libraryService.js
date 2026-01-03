const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { archiveExtractDir, getLibraryRoot, libraryRoots } = require("../config");
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
  tryExtractArchive,
  touchPath,
} = require("./mediaProcessingService");
const { ensureDir } = require("../utils/fileStore");

const DEFAULT_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp"]);
const ALLOWED_MEDIA_KINDS = new Set(["directory", "video", "archive", "image"]);
const ARCHIVE_EXTS = new Set([".zip", ".cbz", ".cbr"]);

function buildArchivePages(entryPath, relativePath, root) {
  try {
    const existingTarget = getArchiveExtractionTarget(relativePath, root.id);
    ensureDir(existingTarget);

    let extractedDir = existingTarget;
    let pages = listExtractedImages(existingTarget);

    if (!pages.length) {
      extractedDir = ensureArchiveExtracted(entryPath, relativePath, root.id);
      pages = listExtractedImages(extractedDir);
    }

    const extractedPath = path.relative(archiveExtractDir, extractedDir);

    return {
      pages,
      extractedPath,
      thumbnail: pages.length ? `/extracted/${path.join(extractedPath, pages[0])}` : null,
    };
  } catch (_err) {
    return { pages: [], extractedPath: null, thumbnail: null };
  }
}

function resolveLibraryPath(requestedPath = "", libraryId) {
  const root = getLibraryRoot(libraryId);
  const normalized = requestedPath.startsWith("/")
    ? requestedPath.slice(1)
    : requestedPath;
  const absolutePath = path.resolve(root.path, normalized || ".");
  const relative = path.relative(path.resolve(root.path), absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid path");
  }
  return { absolutePath, root };
}

function describeEntry(entryPath, dirent, root) {
  const stats = fs.statSync(entryPath);
  const relativePath = path.relative(root.path, entryPath);
  const mediaKind = detectMediaKind(entryPath, dirent);
  const base = {
    name: dirent.name,
    path: relativePath,
    libraryId: root.id,
    type: dirent.isDirectory() ? "directory" : "file",
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };

  if (mediaKind === "video") {
    const thumbnailPath = ensureVideoThumbnail(entryPath, relativePath, root.id);
    return {
      ...base,
      mediaKind,
      iosOptimized: isIosFriendlyVideo(entryPath),
      supportsAutoTranscode: true,
      thumbnail: `/thumbnails/${path.basename(thumbnailPath)}`,
      subtitles: findSidecarSubtitles(entryPath, root),
    };
  }

  if (mediaKind === "archive") {
    const { thumbnail, pages, extractedPath } = buildArchivePages(entryPath, relativePath, root);
    const fallbackThumb = ensureArchiveThumbnail(relativePath, root.id);
    return {
      ...base,
      mediaKind,
      thumbnail: thumbnail || `/thumbnails/${path.basename(fallbackThumb)}`,
      pageCount: pages.length,
      extractionTarget:
        extractedPath ||
        path.relative(archiveExtractDir, getArchiveExtractionTarget(relativePath, root.id)),
    };
  }

  return {
    ...base,
    mediaKind,
  };
}

function listDirectory(targetPath = "", libraryId) {
  const { absolutePath: absolute, root } = resolveLibraryPath(targetPath, libraryId);
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
    .map((dirent) => describeEntry(path.join(absolute, dirent.name), dirent, root))
    .filter((entry) => ALLOWED_MEDIA_KINDS.has(entry.mediaKind));

  return {
    items: entries,
    currentPath: path.relative(root.path, absolute),
    library: root,
    libraryRoots: libraryRoots.map((entry) => ({ id: entry.id, name: entry.name, path: entry.path })),
  };
}

function getFileInfo(targetPath = "", libraryId) {
  const { absolutePath: absolute, root } = resolveLibraryPath(targetPath, libraryId);
  if (!fs.existsSync(absolute)) {
    return { error: "File not found" };
  }
  const stats = fs.statSync(absolute);
  if (!stats.isFile()) {
    return { error: "Not a file" };
  }
  const relativePath = path.relative(root.path, absolute);
  const mediaKind = detectMediaKind(absolute, {
    isDirectory: () => false,
  });
  return { absolute, stats, relativePath, mediaKind, library: root };
}

function parseRange(rangeHeader, fileSize) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : Math.min(start + DEFAULT_CHUNK_SIZE, fileSize - 1);
  if (Number.isNaN(start) || start < 0 || start >= fileSize) return null;
  return { start, end: Math.min(end, fileSize - 1) };
}

function listExtractedImages(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const files = [];
  extractNestedArchives(baseDir);

  function walk(target) {
    const entries = fs.readdirSync(target, { withFileTypes: true });
    entries.forEach((entry) => {
      const next = path.join(target, entry.name);
      if (entry.isDirectory()) {
        walk(next);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTS.has(ext)) {
          files.push(path.relative(baseDir, next));
        }
      }
    });
  }

  walk(baseDir);
  return files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function extractNestedArchives(baseDir) {
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    entries.forEach((entry) => {
      const entryPath = path.join(baseDir, entry.name);
      if (entry.isDirectory()) {
        extractNestedArchives(entryPath);
        return;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!ARCHIVE_EXTS.has(ext)) return;

      const targetDir = path.join(baseDir, path.parse(entry.name).name);
      const extraction = tryExtractArchive(entryPath, targetDir);
      if (extraction.success) {
        extractNestedArchives(targetDir);
      }
    });
  } catch (_err) {
    // best-effort; ignore nested archives we can't read
  }
}

module.exports = {
  listDirectory,
  getFileInfo,
  parseRange,
  ensureArchiveExtracted,
  ensureIosReadyVideo,
  isIosFriendlyVideo,
  touchPath,
  listExtractedImages,
  buildArchivePages,
};
