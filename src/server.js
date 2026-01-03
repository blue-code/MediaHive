const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const { port, storageDir } = require("./config");
const { ensureDir } = require("./utils/fileStore");
const authRoutes = require("./routes/auth");
const contentRoutes = require("./routes/content");
const libraryRoutes = require("./routes/library");

function bootstrap() {
  ensureDir(storageDir);
  ensureDir(path.join(storageDir, "media"));

  const app = express();

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/media", express.static(path.join(storageDir, "media")));
  app.use("/api/auth", authRoutes);
  app.use("/api/content", contentRoutes);
  app.use("/api/library", libraryRoutes);

  app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.path} not found` });
  });

  app.listen(port, () => {
    console.log(`MediaHive server listening on http://localhost:${port}`);
  });
}

bootstrap();
