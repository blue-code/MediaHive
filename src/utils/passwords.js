const crypto = require("crypto");

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const ITERATIONS = 120000;
const DIGEST = "sha512";

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, DIGEST);
  return `pbkdf2:${ITERATIONS}:${DIGEST}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith("pbkdf2:")) return false;
  const parts = stored.split(":");
  if (parts.length !== 5) return false;
  const [, iterStr, digest, saltHex, hashHex] = parts;
  const iterations = Number(iterStr);
  if (!iterations || !digest || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const derived = crypto.pbkdf2Sync(password, salt, iterations, hashHex.length / 2, digest);
  const storedHash = Buffer.from(hashHex, "hex");
  return crypto.timingSafeEqual(derived, storedHash);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
