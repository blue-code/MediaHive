const express = require("express");
const jwt = require("jsonwebtoken");
const { createUser, verifyCredentials } = require("../services/userService");
const { jwtSecret } = require("../config");

const router = express.Router();

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
    },
    jwtSecret,
    { expiresIn: "7d" },
  );
}

router.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  const result = createUser(username, password);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  return res.status(201).json({
    user: { id: result.user.id, username: result.user.username, createdAt: result.user.createdAt },
    token: issueToken(result.user),
  });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  const user = verifyCredentials(username, password);
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  return res.json({
    user: { id: user.id, username: user.username, createdAt: user.createdAt },
    token: issueToken(user),
  });
});

module.exports = router;
