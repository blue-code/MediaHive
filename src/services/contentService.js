const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { dataDir, storageDir } = require("../config");
const { readJsonSafe, writeJsonSafe, ensureDir } = require("../utils/fileStore");

const CONTENT_FILE = path.join(dataDir, "content.json");
const MEDIA_DIR = path.join(storageDir, "media");

function ensureStore() {
  ensureDir(dataDir);
  ensureDir(MEDIA_DIR);
  const existing = readJsonSafe(CONTENT_FILE, null);
  if (!existing) {
    writeJsonSafe(CONTENT_FILE, []);
  }
}

function loadContent() {
  ensureStore();
  return readJsonSafe(CONTENT_FILE, []);
}

function saveContent(entries) {
  return writeJsonSafe(CONTENT_FILE, entries);
}

function listContent() {
  return loadContent();
}

function getContent(id) {
  return loadContent().find((c) => c.id === id);
}

function addContent({ title, type, description, filePath, url }) {
  const entries = loadContent();
  const item = {
    id: uuidv4(),
    title,
    type,
    description: description || "",
    filePath: filePath || "",
    url: url || "",
    createdAt: new Date().toISOString(),
  };
  entries.push(item);
  const ok = saveContent(entries);
  return ok ? { item } : { error: "Failed to persist content" };
}

function removeFileIfExists(targetPath) {
  if (targetPath && fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
}

function deleteContent(id) {
  const entries = loadContent();
  const idx = entries.findIndex((c) => c.id === id);
  if (idx === -1) return { error: "Content not found" };

  const [removed] = entries.splice(idx, 1);
  removeFileIfExists(removed.filePath);
  const ok = saveContent(entries);
  return ok ? { item: removed } : { error: "Failed to persist content" };
}

module.exports = {
  MEDIA_DIR,
  listContent,
  getContent,
  addContent,
  deleteContent,
};
