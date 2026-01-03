const express = require("express");
const fs = require("fs");
const path = require("path");
const { libraryDir } = require("../config");
const { listDirectory, getFileInfo, parseRange } = require("../services/libraryService");

const router = express.Router();

router.get("/browse", (req, res) => {
  const targetPath = req.query.path || "";
  try {
    const result = listDirectory(targetPath);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json({
      libraryRoot: libraryDir,
      currentPath: result.currentPath,
      items: result.items,
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
    fileInfo = getFileInfo(targetPath);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  if (fileInfo.error) {
    return res.status(404).json({ message: fileInfo.error });
  }

  const { absolute, stats } = fileInfo;
  const range = parseRange(req.headers.range, stats.size);

  if (range) {
    const { start, end } = range;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(absolute, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": req.query.contentType || "application/octet-stream",
    });
    return stream.pipe(res);
  }

  const options = {
    headers: {
      "Content-Length": stats.size,
    },
  };
  return res.sendFile(path.basename(absolute), { root: path.dirname(absolute), ...options });
});

module.exports = router;
