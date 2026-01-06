const express = require("express");
const fs = require("fs");
const path = require("path");
const { archiveExtractDir } = require("../config");
const {
  listDirectory,
  getFileInfo,
  parseRange,
  buildArchivePages,
  ensureArchiveExtracted,
  ensureIosReadyVideo,
  isIosFriendlyVideo,
  touchPath,
  browseArchiveContents,
} = require("../services/libraryService");

const IMAGE_MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
};

const router = express.Router();
const PUBLIC_LIB_ID = "public";

router.get("/", (req, res) => {
  const targetPath = req.query.path || "";
  try {
    const result = listDirectory(targetPath, PUBLIC_LIB_ID);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json({
      items: result.items,
      currentPath: result.currentPath,
      library: result.library,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.get("/stream", (req, res) => {
  const targetPath = req.query.path;
  if (!targetPath) {
    return res.status(400).json({ message: "path query parameter is required" });
  }

  let fileInfo;
  try {
    fileInfo = getFileInfo(targetPath, PUBLIC_LIB_ID);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  if (fileInfo.error) {
    return res.status(404).json({ message: fileInfo.error });
  }

  const { absolute, relativePath, mediaKind, library } = fileInfo;
  let { stats } = fileInfo;
  let streamPath = absolute;
  let contentType = req.query.contentType || "application/octet-stream";

  if (mediaKind === "video") {
    const forceTranscode =
      req.query.transcode === "true" ||
      req.query.ios === "true" ||
      req.query.optimize === "ios" ||
      !isIosFriendlyVideo(absolute);
    const prepared = ensureIosReadyVideo(absolute, relativePath, library.id, forceTranscode);
    if (prepared.error) {
      return res.status(500).json({ message: prepared.error });
    }
    streamPath = prepared.path;
    stats = fs.statSync(streamPath);
    contentType = prepared.contentType || "video/mp4";
    touchPath(streamPath);
  }

  if (mediaKind === "subtitle") {
    contentType = contentType || "text/plain";
  }

  if (mediaKind === "image") {
    const ext = path.extname(streamPath).toLowerCase();
    contentType = IMAGE_MIME_MAP[ext] || contentType;
  }

  const range = parseRange(req.headers.range, stats.size);

  if (range) {
    const { start, end } = range;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(streamPath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
    });
    return stream.pipe(res);
  }

  const options = {
    headers: {
      "Content-Length": stats.size,
      "Content-Type": contentType,
    },
  };
  return res.sendFile(path.basename(streamPath), {
    root: path.dirname(streamPath),
    ...options,
  });
});

router.post("/archive/extract", (req, res) => {
  const targetPath = req.body.path || req.query.path;
  if (!targetPath) {
    return res.status(400).json({ message: "path is required" });
  }

  let fileInfo;
  try {
    fileInfo = getFileInfo(targetPath, PUBLIC_LIB_ID);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  if (fileInfo.error) {
    return res.status(404).json({ message: fileInfo.error });
  }

  if (fileInfo.mediaKind !== "archive") {
    return res.status(400).json({ message: "Target is not an archive" });
  }

  try {
    const extracted = ensureArchiveExtracted(
      fileInfo.absolute,
      fileInfo.relativePath,
      fileInfo.library.id,
    );
    const relativeExtracted = path.relative(archiveExtractDir, extracted);
    return res.json({ extractedPath: relativeExtracted });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/archive/pages", (req, res) => {
  const targetPath = req.query.path;
  if (!targetPath) {
    return res.status(400).json({ message: "path query parameter is required" });
  }

  let fileInfo;
  try {
    fileInfo = getFileInfo(targetPath, PUBLIC_LIB_ID);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  if (fileInfo.error) {
    return res.status(404).json({ message: fileInfo.error });
  }

  if (fileInfo.mediaKind !== "archive") {
    return res.status(400).json({ message: "Target is not an archive" });
  }

  try {
    const { pages, extractedPath } = buildArchivePages(
      fileInfo.absolute,
      fileInfo.relativePath,
      fileInfo.library,
    );
    if (!pages.length || !extractedPath) {
      return res.status(404).json({ message: "No pages found in archive" });
    }
    return res.json({
      pages: pages.map((page) => `/extracted/${path.join(extractedPath, page)}`),
      extractedPath,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/archive/browse", (req, res) => {
  const archivePath = req.query.path;
  const scope = req.query.scope || "library";
  const subpath = req.query.subpath || "";
  const root = req.query.root;
  if (!archivePath) {
    return res.status(400).json({ message: "path query parameter is required" });
  }

  try {
    const listing = browseArchiveContents({
      archivePath,
      libraryId: PUBLIC_LIB_ID,
      scope,
      subpath,
      root,
    });
    return res.json(listing);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;