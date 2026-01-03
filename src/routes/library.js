const express = require("express");
const fs = require("fs");
const path = require("path");
const { archiveExtractDir, libraryRoots } = require("../config");
const {
  listDirectory,
  getFileInfo,
  parseRange,
  ensureArchiveExtracted,
  ensureIosReadyVideo,
  isIosFriendlyVideo,
  touchPath,
} = require("../services/libraryService");

const router = express.Router();

const libraryList = libraryRoots.map((root) => ({
  id: root.id,
  name: root.name,
  path: root.path,
}));

router.get("/browse", (req, res) => {
  const targetPath = req.query.path || "";
  const libraryId = req.query.library;
  try {
    const result = listDirectory(targetPath, libraryId);
    if (result.error) {
      return res.status(400).json({ message: result.error, libraryRoots: libraryList });
    }
    return res.json({
      libraryRoot: result.library,
      libraryRoots: libraryList,
      currentPath: result.currentPath,
      items: result.items,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message, libraryRoots: libraryList });
  }
});

router.get("/stream", (req, res) => {
  const targetPath = req.query.path;
  const libraryId = req.query.library;
  if (!targetPath) {
    return res.status(400).json({ message: "path query parameter is required" });
  }

  let fileInfo;
  try {
    fileInfo = getFileInfo(targetPath, libraryId);
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
  const libraryId = req.body.library || req.query.library;
  if (!targetPath) {
    return res.status(400).json({ message: "path is required" });
  }

  let fileInfo;
  try {
    fileInfo = getFileInfo(targetPath, libraryId);
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

module.exports = router;
