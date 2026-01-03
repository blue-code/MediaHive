const fs = require("fs");
const path = require("path");
const {
  thumbnailDir,
  archiveExtractDir,
  transcodedDir,
  cacheTtlHours,
  cacheCleanupIntervalMinutes,
} = require("../config");
const { ensureDir } = require("../utils/fileStore");

function removeStaleEntries(targetPath, cutoff, isRoot = false) {
  if (!fs.existsSync(targetPath)) return;
  const stats = fs.statSync(targetPath);

  if (stats.isDirectory()) {
    fs.readdirSync(targetPath).forEach((child) => {
      removeStaleEntries(path.join(targetPath, child), cutoff, false);
    });
    const refreshedStats = fs.statSync(targetPath);
    if (!isRoot && refreshedStats.mtimeMs < cutoff && fs.readdirSync(targetPath).length === 0) {
      fs.rmdirSync(targetPath);
    }
    return;
  }

  if (stats.mtimeMs < cutoff) {
    fs.unlinkSync(targetPath);
  }
}

function sweepCacheOnce() {
  const cutoff = Date.now() - cacheTtlHours * 60 * 60 * 1000;
  [thumbnailDir, archiveExtractDir, transcodedDir].forEach((dir) => {
    ensureDir(dir);
    removeStaleEntries(dir, cutoff, true);
  });
}

function startCacheCleanup() {
  sweepCacheOnce();
  const intervalMs = cacheCleanupIntervalMinutes * 60 * 1000;
  setInterval(sweepCacheOnce, intervalMs);
}

module.exports = {
  startCacheCleanup,
  sweepCacheOnce,
};
