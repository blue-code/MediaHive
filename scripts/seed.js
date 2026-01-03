#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { hashPassword } = require("../src/utils/passwords");

const DATA_DIR = path.join(__dirname, "..", "data");
const STORAGE_DIR = path.join(__dirname, "..", "storage");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");

function ensureDir(target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function seedUsers() {
  const defaultUser = {
    id: uuidv4(),
    username: "demo",
    passwordHash: hashPassword("password123"),
    createdAt: new Date().toISOString(),
  };

  writeJson(USERS_FILE, [defaultUser]);
  console.log(`Seeded user "demo" with password "password123" into ${USERS_FILE}`);
}

function seedContent() {
  const samples = [
    {
      id: uuidv4(),
      title: "Welcome to MediaHive",
      type: "text",
      description: "Placeholder content entry stored on local disk.",
      filePath: "",
      url: "",
      createdAt: new Date().toISOString(),
    },
  ];

  writeJson(CONTENT_FILE, samples);
  console.log(`Seeded sample content into ${CONTENT_FILE}`);
}

function main() {
  ensureDir(DATA_DIR);
  ensureDir(STORAGE_DIR);
  ensureDir(path.join(STORAGE_DIR, "media"));

  seedUsers();
  seedContent();
}

main();
