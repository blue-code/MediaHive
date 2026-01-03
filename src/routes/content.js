const express = require("express");
const multer = require("multer");
const path = require("path");
const { MEDIA_DIR, listContent, getContent, addContent, deleteContent } = require("../services/contentService");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({ storage });

router.get("/", (_req, res) => {
  res.json({ items: listContent() });
});

router.get("/:id", (req, res) => {
  const item = getContent(req.params.id);
  if (!item) return res.status(404).json({ message: "Content not found" });
  return res.json({ item });
});

router.post("/", authMiddleware, (req, res) => {
  const { title, type, description, filePath, url } = req.body;
  if (!title || !type) {
    return res.status(400).json({ message: "title and type are required" });
  }

  const result = addContent({ title, type, description, filePath, url });
  if (result.error) return res.status(500).json({ message: result.error });
  return res.status(201).json({ item: result.item });
});

router.post("/upload", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "file is required" });
  }

  const { title = req.file.originalname, type = "file", description = "" } = req.body;
  const filePath = path.join(MEDIA_DIR, req.file.filename);
  const url = `/media/${req.file.filename}`;
  const result = addContent({ title, type, description, filePath, url });
  if (result.error) return res.status(500).json({ message: result.error });

  return res.status(201).json({ item: result.item });
});

router.delete("/:id", authMiddleware, (req, res) => {
  const result = deleteContent(req.params.id);
  if (result.error) return res.status(404).json({ message: result.error });
  return res.json({ item: result.item });
});

module.exports = router;
