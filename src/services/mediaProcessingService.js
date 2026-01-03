const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const { thumbnailDir, archiveExtractDir, transcodedDir } = require("../config");
const { ensureDir } = require("../utils/fileStore");

const SUPPORTED_IOS_VIDEO_EXTS = new Set([".mp4", ".m4v", ".mov"]);
const VIDEO_EXTS = new Set([...SUPPORTED_IOS_VIDEO_EXTS, ".mkv", ".avi", ".flv", ".wmv", ".webm"]);
const ARCHIVE_EXTS = new Set([".zip", ".cbz", ".cbr"]);
const SUBTITLE_EXTS = new Set([".srt", ".smi"]);

const PLACEHOLDER_VIDEO_THUMB =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAYAAAA/1nMpAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB90lEQVR4nO3aMW7DMAxEUU9h/n+ru0WkGpI1QXysdbsIBNeDXnRJZ9gO5nH8GXKsgNFYwIAAAAAAAAAwP+vjvKK63q6u61n4Y/12DdsU/YPH5kcP7v2CnRfL7jf2Ke+bQtfdy+9gex+7xmt2n7gDf1p9g13s9bCO1Lr7zrzQNzIr3pv+ELxPfZPvUNU+yH7gIfrPN7b7vGtPvka9xz/Ht3q9Rt9az8jNH1q+7gA72z+7g6z6xW3eZ7fB7Ub1ptG8bZGzh64A7606ru1n8rftz2o3t3O7r1F9sGvdbv2Nyz7Q913b7z+pcupZbTqy71r4R17qmUO+4fvtz1FurGTy7W+1n7RnepZbTbqvDb/6nLqWW02qrdPf7jT3n0bxbqse5T7uvSvdY67Odb9rc2uQSjIVskhWSSpJFkkqSRZJKkkWSSpJFkkqSRZJKkkWSSpJFkkqSRZJKkkWSSpJFkkqSRZJKkkWSSpJFkkqSRZJKkkWSSpJFlEb6SFZJKkkWSSpJFkkqSRZJKkkWSSpJFkkqSRZJKkkWSSpJFkkqSRZJKkkWSSpJFkkqSRZJKkkWSSpJFlEX4nu6Gr7Xfxz7i/9c+q83hdbv4eAAAAAAAAAAD8esYLRG7zNRAAAAAASUVORK5CYII=";
const PLACEHOLDER_ARCHIVE_THUMB =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAYAAAA/1nMpAAAACXBIWXMAAAsTAAALEwEAmpwYAAABxElEQVR4nO3csW7CMBAF0VjB/v+ra1Ekp5GWkHQMMX8WsDvQe7SLPWAywGkLFwAAAAAAAAAA+D2+23frrtsZ/GP46PbVPp+/7nxf70B9o1E9MPbFvmHYX/39KHtzefEfFgcWfdfbXYK9+2m2M1efM77nuTzi+tdwZt6/S+38LrXcGbWv0vu/B2t90n+m9Pu0wrf077p9Z1r9XbuvGfZ7Wu/79tGrVvv06Ln5Ir3m7R9/ZJr66+eXfYbvevQ/54w75r9F/qdD99Yb223+qP31nVzr6R32PffqTfbP6nQ/fWG9tt/qj99Z1c6+kd9j336k32z+p0P31hvb7P6kv34bZ2dOzs2umlmPnzH7Lxnx/+yKXUrllJZZSaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUUllQvOSWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWUWllJpZRaWU+mgu/oarv5b/G5zd/7H9rmzwVwAAAAAAAAAA/mkz2XnXbKqeAAAAAElFTkSuQmCC";
const IOS_MIME_MAP = {
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".mov": "video/quicktime",
};

function hashPath(relativePath, libraryId = "default") {
  return crypto.createHash("md5").update(`${libraryId}:${relativePath}`).digest("hex");
}

function ensureMediaDirs() {
  ensureDir(thumbnailDir);
  ensureDir(archiveExtractDir);
  ensureDir(transcodedDir);
}

function detectMediaKind(entryPath, dirent) {
  if (dirent.isDirectory()) return "directory";
  const ext = path.extname(entryPath).toLowerCase();
  if (VIDEO_EXTS.has(ext)) return "video";
  if (ARCHIVE_EXTS.has(ext)) return "archive";
  if (SUBTITLE_EXTS.has(ext)) return "subtitle";
  return "file";
}

function hasFfmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch (_err) {
    return false;
  }
}

function isIosFriendlyVideo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_IOS_VIDEO_EXTS.has(ext);
}

function iosContentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IOS_MIME_MAP[ext] || "video/mp4";
}

function writePlaceholder(kind, targetPath) {
  const source =
    kind === "archive" ? PLACEHOLDER_ARCHIVE_THUMB : PLACEHOLDER_VIDEO_THUMB;
  fs.writeFileSync(targetPath, Buffer.from(source, "base64"));
}

function touchPath(targetPath) {
  try {
    const now = new Date();
    fs.utimesSync(targetPath, now, now);
  } catch (_err) {
    // best-effort
  }
}

function ensureThumbnail(kind, relativePath, libraryId = "default") {
  ensureMediaDirs();
  const hashed = hashPath(relativePath, libraryId);
  const targetPath = path.join(thumbnailDir, `${hashed}-${kind}.png`);
  if (!fs.existsSync(targetPath)) {
    writePlaceholder(kind, targetPath);
  } else {
    touchPath(targetPath);
  }
  return targetPath;
}

function ensureVideoThumbnail(absolutePath, relativePath, libraryId = "default") {
  ensureMediaDirs();
  const hashed = hashPath(relativePath, libraryId);
  const targetPath = path.join(thumbnailDir, `${hashed}-video.png`);

  if (fs.existsSync(targetPath)) {
    touchPath(targetPath);
    return targetPath;
  }

  if (hasFfmpeg()) {
    const result = spawnSync(
      "ffmpeg",
      ["-y", "-ss", "00:00:01", "-i", absolutePath, "-vframes", "1", "-vf", "scale=480:-1", targetPath],
      { stdio: "ignore" },
    );
    if (result.status === 0 && fs.existsSync(targetPath)) {
      return targetPath;
    }
  }

  writePlaceholder("video", targetPath);
  return targetPath;
}

function ensureArchiveThumbnail(relativePath, libraryId = "default") {
  return ensureThumbnail("archive", relativePath, libraryId);
}

function findSidecarSubtitles(absolutePath, libraryRoot) {
  const parsed = path.parse(absolutePath);
  if (!fs.existsSync(parsed.dir)) return [];
  return fs
    .readdirSync(parsed.dir)
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return SUBTITLE_EXTS.has(ext) && path.parse(file).name === parsed.name;
    })
    .map((file) => path.relative(libraryRoot.path, path.join(parsed.dir, file)));
}

function ensureIosReadyVideo(
  absolutePath,
  relativePath,
  libraryId = "default",
  forceTranscode = false,
) {
  if (isIosFriendlyVideo(absolutePath) && !forceTranscode) {
    return { path: absolutePath, contentType: iosContentTypeFor(absolutePath) };
  }

  if (!hasFfmpeg()) {
    return { error: "ffmpeg is required for on-the-fly iOS transcoding" };
  }

  ensureMediaDirs();
  const output = path.join(transcodedDir, `${hashPath(relativePath, libraryId)}.mp4`);
  if (!fs.existsSync(output)) {
    const result = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        absolutePath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-ac",
        "2",
        "-b:a",
        "160k",
        output,
      ],
      { stdio: "ignore" },
    );
    if (result.status !== 0 || !fs.existsSync(output)) {
      return { error: "Failed to transcode source into an iOS-friendly stream" };
    }
  } else {
    touchPath(output);
  }

  return { path: output, contentType: "video/mp4" };
}

function getArchiveExtractionTarget(relativePath, libraryId = "default") {
  return path.join(archiveExtractDir, hashPath(relativePath, libraryId));
}

function ensureArchiveExtracted(absolutePath, relativePath, libraryId = "default") {
  ensureMediaDirs();
  const targetDir = getArchiveExtractionTarget(relativePath, libraryId);
  ensureDir(targetDir);

  const result = spawnSync("unzip", ["-qq", "-o", absolutePath, "-d", targetDir]);
  if (result.status !== 0) {
    throw new Error(
      result.error
        ? `Failed to extract archive: ${result.error.message}`
        : "Failed to extract archive; ensure the file is a supported zip/CBZ and `unzip` is available.",
    );
  }

  touchPath(targetDir);
  return targetDir;
}

module.exports = {
  detectMediaKind,
  ensureArchiveExtracted,
  ensureArchiveThumbnail,
  ensureIosReadyVideo,
  ensureMediaDirs,
  ensureVideoThumbnail,
  getArchiveExtractionTarget,
  findSidecarSubtitles,
  hashPath,
  isIosFriendlyVideo,
  touchPath,
};
