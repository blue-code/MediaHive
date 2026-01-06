const express = require("express");
const { listDirectory } = require("../services/libraryService");

const router = express.Router();

router.get("/", (req, res) => {
  const libraryId = "public";
  const targetPath = req.query.path || "";

  try {
    const result = listDirectory(targetPath, libraryId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    
    return res.json({
      items: result.items,
      currentPath: result.currentPath,
      library: result.library
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;
