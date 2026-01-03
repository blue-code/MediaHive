const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { dataDir, storageDir } = require("../config");
const { readJsonSafe, writeJsonSafe, ensureDir } = require("../utils/fileStore");

const CONTENT_FILE = path.join(dataDir, "content.json");
const MEDIA_DIR = path.join(storageDir, "media");
const VALID_READING_MODES = ["paged", "webtoon", "archive-comic", "archive-webtoon"];

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

function isArchiveType(type = "") {
  const normalized = type.toLowerCase();
  return (
    normalized.includes("archive") ||
    normalized.includes("zip") ||
    normalized === "cbz" ||
    normalized === "cbr"
  );
}

function isWebtoonMode(readingMode) {
  return readingMode === "webtoon" || readingMode === "archive-webtoon";
}

function defaultReadingMode(type = "") {
  const normalized = type.toLowerCase();
  if (isArchiveType(normalized)) {
    return null;
  }
  if (normalized.includes("webtoon")) {
    return "webtoon";
  }
  return "paged";
}

function validateReadingMode(type, readingMode) {
  if (!readingMode) {
    return { error: "readingMode is required", status: 400 };
  }
  if (!VALID_READING_MODES.includes(readingMode)) {
    return {
      error: `readingMode must be one of: ${VALID_READING_MODES.join(", ")}`,
      status: 400,
    };
  }
  if (isArchiveType(type) && !readingMode.startsWith("archive-")) {
    return {
      error: "Archive content must use archive-comic or archive-webtoon reading modes",
      status: 400,
    };
  }
  if (!isArchiveType(type) && readingMode.startsWith("archive-")) {
    return {
      error: "Non-archive content cannot use archive-specific reading modes",
      status: 400,
    };
  }
  return { readingMode };
}

function buildKeyboardShortcuts(readingMode) {
  const shortcuts = {
    ArrowLeft: { action: "previousPage" },
    ArrowRight: { action: "nextPage" },
  };

  if (isWebtoonMode(readingMode)) {
    shortcuts.ArrowUp = { action: "previousSegment", scope: "visibleViewport" };
    shortcuts.ArrowDown = { action: "nextSegment", scope: "visibleViewport" };
  }

  return shortcuts;
}

function decorateContent(item) {
  const readingMode = item.readingMode || defaultReadingMode(item.type);
  const requiresModeSelection = isArchiveType(item.type) && !readingMode;
  const keyboardShortcuts = readingMode ? buildKeyboardShortcuts(readingMode) : null;

  return {
    ...item,
    readingMode: readingMode || null,
    navigation: {
      readingMode: readingMode || null,
      keyboardShortcuts,
      requiresModeSelection,
      scope: isWebtoonMode(readingMode) ? "visibleViewport" : "page",
    },
  };
}

function addContent({ title, type, description, filePath, url, readingMode }) {
  const entries = loadContent();
  if (readingMode) {
    const validation = validateReadingMode(type, readingMode);
    if (validation.error) {
      return { error: validation.error, status: validation.status };
    }
  }

  const item = {
    id: uuidv4(),
    title,
    type,
    description: description || "",
    filePath: filePath || "",
    url: url || "",
    readingMode: readingMode || null,
    createdAt: new Date().toISOString(),
  };
  entries.push(item);
  const ok = saveContent(entries);
  return ok
    ? { item: decorateContent(item) }
    : { error: "Failed to persist content", status: 500 };
}

function removeFileIfExists(targetPath) {
  if (targetPath && fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
}

function deleteContent(id) {
  const entries = loadContent();
  const idx = entries.findIndex((c) => c.id === id);
  if (idx === -1) return { error: "Content not found", status: 404 };

  const [removed] = entries.splice(idx, 1);
  removeFileIfExists(removed.filePath);
  const ok = saveContent(entries);
  return ok ? { item: removed } : { error: "Failed to persist content", status: 500 };
}

function updateReadingMode(id, readingMode) {
  const entries = loadContent();
  const idx = entries.findIndex((c) => c.id === id);
  if (idx === -1) return { error: "Content not found", status: 404 };

  const target = entries[idx];
  const validation = validateReadingMode(target.type, readingMode);
  if (validation.error) {
    return { error: validation.error, status: validation.status };
  }

  const updated = { ...target, readingMode: validation.readingMode };
  entries.splice(idx, 1, updated);
  const ok = saveContent(entries);
  return ok
    ? { item: decorateContent(updated) }
    : { error: "Failed to persist content", status: 500 };
}

function getContentWithNavigation(id) {
  const item = getContent(id);
  if (!item) return null;
  return decorateContent(item);
}

function listContentWithNavigation() {
  return listContent().map((item) => decorateContent(item));
}

module.exports = {
  MEDIA_DIR,
  listContent,
  listContentWithNavigation,
  getContent,
  getContentWithNavigation,
  addContent,
  deleteContent,
  updateReadingMode,
};
