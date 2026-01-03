const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const { port, storageDir } = require("./config");
const { ensureDir } = require("./utils/fileStore");
const { ensureMediaDirs } = require("./services/mediaProcessingService");
const { startCacheCleanup } = require("./services/cacheService");
const authRoutes = require("./routes/auth");
const contentRoutes = require("./routes/content");
const libraryRoutes = require("./routes/library");

function bootstrap() {
  ensureDir(storageDir);
  ensureDir(path.join(storageDir, "media"));
  ensureMediaDirs();

  const app = express();
  const publicDir = path.join(__dirname, "..", "public");

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/media", express.static(path.join(storageDir, "media")));
  app.use("/thumbnails", express.static(path.join(storageDir, "thumbnails")));
  app.use("/extracted", express.static(path.join(storageDir, "extracted")));
  app.use(express.static(publicDir));
  app.use("/api/auth", authRoutes);
  app.use("/api/content", contentRoutes);
  app.use("/api/library", libraryRoutes);

  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.path} not found` });
  });

  app.listen(port, () => {
    console.log(`MediaHive server listening on http://localhost:${port}`);
  });

  startCacheCleanup();
}

bootstrap();
