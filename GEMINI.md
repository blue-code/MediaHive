# MediaHive

MediaHive is a local-first media API server designed to manage and stream personal media collections (videos, comics, images) without reliance on external cloud services or complex database setups. It uses a file-system-based approach for content library management and local JSON files for metadata storage.

## Project Overview

- **Type:** Node.js Web Application (Backend-heavy with simple static frontend)
- **Purpose:** Host and stream local media files with support for transcoding and archive reading (CBZ/ZIP).
- **Architecture:** Monolithic Express server with a service-layer architecture.
- **Data Storage:**
    - **Metadata:** Local JSON files in `data/` (`users.json`, `content.json`).
    - **Media:** Direct file system access to configured library paths.
    - **Cache/Derived:** `storage/` directory for thumbnails, extracted archives, and transcoded videos.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Authentication:** JWT (JSON Web Tokens) with PBKDF2 password hashing.
- **Key Libraries:**
    - `cors`, `morgan` (Middleware)
    - `multer` (File uploads)
    - `dotenv` (Configuration)
- **External Tools (Required):**
    - `ffmpeg`: For video thumbnails and transcoding (iOS compatibility).
    - `unzip`, `7z`, `bsdtar`, or `unrar`: For extracting comic archives.

## Key Features

- **Local Library Browsing:** Browse arbitrary directories on the host machine via the API.
- **Video Streaming:** Supports range requests for streaming. Automatically detects and transcodes non-iOS-friendly formats (if `ffmpeg` is available).
- **Comic/Archive Reading:** Extracts images from ZIP/CBZ/CBR archives on-the-fly for web-based reading.
- **Thumbnail Generation:** Automatically generates thumbnails for videos and archives.
- **User Management:** Simple signup/login flow with role-based access control (implied by protected routes).

## Setup & Usage

### Prerequisites

Ensure the following are installed on the host system:
1.  **Node.js** (v18+ recommended)
2.  **ffmpeg** (accessible via PATH)
3.  **unzip** or similar archive tool (accessible via PATH)

### Installation

```bash
# Install Node.js dependencies
npm install

# Initialize data and create a demo user
npm run seed
```

### Configuration (.env)

Copy `.env.example` to `.env` and configure:

```ini
PORT=4000
HOST=0.0.0.0
JWT_SECRET=your-secret-key
# Data Persistence
DATA_DIR=./data
STORAGE_DIR=./storage
# Media Libraries
LIBRARY_DIR=./library
LIBRARY_DIRS=./library-a,./library-b
```

### Running the Server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

## Project Structure

```text
/
├── data/                   # Persistent JSON data (users, content metadata)
├── public/                 # Static frontend assets (served at root)
├── scripts/                # Utility scripts (seeding, linting)
├── src/
│   ├── config.js           # Configuration loader
│   ├── server.js           # Application entry point
│   ├── routes/             # API Route definitions
│   ├── services/           # Business logic
│   │   ├── libraryService.js        # File system browsing & media info
│   │   ├── mediaProcessingService.js # Ffmpeg & Archive extraction wrappers
│   │   └── ...
│   └── utils/              # Helper functions (fileStore.js for JSON I/O)
└── storage/                # Generated assets (thumbnails, transcoded videos)
```

## API Endpoints (Brief)

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`
- **Content:** `GET /api/content`, `POST /api/content` (Metadata management)
- **Library:**
    - `GET /api/library/browse`: List files in configured directories.
    - `GET /api/library/stream`: Stream video/image files.
    - `POST /api/library/archive/extract`: Extract comic archives for reading.

## Development Conventions

- **Linting:** Run `npm run lint` (currently a placeholder, replace with ESLint if needed).
- **File System:** Operations are synchronous or spawned processes (`execSync`, `spawnSync`) for simplicity in this local-context app.
- **Error Handling:** Basic try/catch blocks; ensure `ffmpeg` failures are handled gracefully (usually falls back to placeholders).
