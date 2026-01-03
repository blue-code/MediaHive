const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { dataDir } = require("../config");
const { readJsonSafe, writeJsonSafe, ensureDir } = require("../utils/fileStore");
const { hashPassword, verifyPassword } = require("../utils/passwords");

const USERS_FILE = path.join(dataDir, "users.json");

function ensureStore() {
  ensureDir(dataDir);
  const existing = readJsonSafe(USERS_FILE, null);
  if (!existing) {
    writeJsonSafe(USERS_FILE, []);
  }
}

function loadUsers() {
  ensureStore();
  return readJsonSafe(USERS_FILE, []);
}

function saveUsers(users) {
  return writeJsonSafe(USERS_FILE, users);
}

function findByUsername(username) {
  const users = loadUsers();
  return users.find((u) => u.username === username);
}

function createUser(username, password) {
  const users = loadUsers();
  if (users.some((u) => u.username === username)) {
    return { error: "Username already exists" };
  }

  const user = {
    id: uuidv4(),
    username,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  const ok = saveUsers(users);
  return ok ? { user } : { error: "Failed to persist user" };
}

function verifyCredentials(username, password) {
  const user = findByUsername(username);
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? user : null;
}

module.exports = {
  loadUsers,
  createUser,
  verifyCredentials,
};
