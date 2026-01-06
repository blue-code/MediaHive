const express = require("express");
const fs = require("fs");
const path = require("path");
const { archiveExtractDir } = require("../config");
const {
  listDirectory,
  getFileInfo,
  ensureIosReadyVideo,
  isIosFriendlyVideo,
  touchPath,
  ensureArchiveExtracted,
  buildArchivePages,
  browseArchiveContents,
} = require("../services/libraryService");

const router = express.Router();
const PUBLIC_LIB_ID = "public";

router.get("/", (req, res) => {
  const targetPath = req.query.path || "";
  try {
    const result = listDirectory(targetPath, PUBLIC_LIB_ID);
    if (result.error) return res.status(400).json({ message: result.error });
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
  if (!targetPath) return res.status(400).json({ message: "path is required" });

  let fileInfo;
  try {
    fileInfo = getFileInfo(targetPath, PUBLIC_LIB_ID);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  if (fileInfo.error) return res.status(404).json({ message: fileInfo.error });

  const { absolute, relativePath, mediaKind, library } = fileInfo;
  let streamPath = absolute;
  let contentType = req.query.contentType;

  // 비디오 트랜스코딩 처리
  if (mediaKind === "video") {
    const forceTranscode = !isIosFriendlyVideo(absolute);
    const prepared = ensureIosReadyVideo(absolute, relativePath, library.id, forceTranscode);
    if (prepared.error) return res.status(500).json({ message: prepared.error });
    streamPath = prepared.path;
    contentType = "video/mp4";
    touchPath(streamPath);
  }

  // 확장자에 따른 기본 Content-Type 설정
  if (!contentType) {
    const ext = path.extname(streamPath).toLowerCase();
    const mimeMap = {
      ".epub": "application/epub+zip",
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".srt": "text/plain",
      ".vtt": "text/vtt"
    };
    contentType = mimeMap[ext] || "application/octet-stream";
  }

  // res.sendFile을 사용하여 Range 요청 자동 처리
  res.status(200).setHeader("Content-Type", contentType);
  res.sendFile(streamPath, { acceptRanges: true }, (err) => {
    if (err && !res.headersSent) {
      console.error("File send error:", err);
      res.status(err.status || 500).end();
    }
  });
});

// 나머지 archive 관련 라우트는 기존 유지 (생략 가능하나 완전성을 위해 포함)
router.post("/archive/extract", async (req, res) => {
  const targetPath = req.body.path || req.query.path;
  try {
    const fileInfo = getFileInfo(targetPath, PUBLIC_LIB_ID);
    const extracted = ensureArchiveExtracted(fileInfo.absolute, fileInfo.relativePath, PUBLIC_LIB_ID);
    res.json({ extractedPath: path.relative(archiveExtractDir, extracted) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/archive/pages", (req, res) => {
  const targetPath = req.query.path;
  try {
    const fileInfo = getFileInfo(targetPath, PUBLIC_LIB_ID);
    const { pages, extractedPath } = buildArchivePages(fileInfo.absolute, fileInfo.relativePath, fileInfo.library);
    res.json({ pages: pages.map(p => `/extracted/${path.join(extractedPath, p)}`), extractedPath });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/archive/browse", (req, res) => {
  try {
    const listing = browseArchiveContents({ archivePath: req.query.path, libraryId: PUBLIC_LIB_ID, scope: req.query.scope || "library", subpath: req.query.subpath || "", root: req.query.root });
    res.json(listing);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
