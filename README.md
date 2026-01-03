# MediaHive

Local-first media API server with simple ID/password login and on-disk storage.  
No S3 or external services are required—content and metadata live in the local `data/` and `storage/` directories.

## Quick start

```bash
npm install
npm run seed    # optional: creates demo user and sample content entry
npm run dev     # or: npm start
```

- Server runs at `http://localhost:4000`
- Static media files are served from `/media/*` (stored in `./storage/media`)

## Environment

Copy `.env.example` to `.env` and adjust as needed:

```
PORT=4000
JWT_SECRET=your-secret
DATA_DIR=./data
STORAGE_DIR=./storage
LIBRARY_DIR=./library   # folder containing epubs, videos, zip comics, etc.
```

## API overview

- `POST /api/auth/register` — create user. Body: `{ "username": "...", "password": "..." }`
- `POST /api/auth/login` — login and receive JWT token.
- `GET /api/content` — list content (public).
- `GET /api/content/:id` — fetch content metadata by id.
- `POST /api/content` — create metadata entry (protected). Body: `{ "title": "...", "type": "video|image|epub|...", "description": "...", "readingMode": "paged|webtoon|archive-comic|archive-webtoon" }`
- `POST /api/content/upload` — upload a file to local disk (protected). Form-data: `file` + optional `title`, `type`, `description`, `readingMode`. Returns the created content record with file path.
- `DELETE /api/content/:id` — delete content and its file (protected).
- `PATCH /api/content/:id/navigation` — set a reading mode (`paged`, `webtoon`, `archive-comic`, or `archive-webtoon`) so keyboard shortcuts can be attached to compressed comics/webtoons (protected).
- `GET /api/content/:id/shortcuts` — fetch the derived keyboard shortcut mapping for a content item, including whether archive items still require a mode selection.
- `GET /api/library/browse?path=` — browse the configured library directory (mix of videos, epubs, zip comics, etc.). `path` is relative to `LIBRARY_DIR` (omit for root).
- `GET /api/library/stream?path=` — stream any file inside the library directory (supports HTTP Range for videos). Supply `path` relative to `LIBRARY_DIR`.

Authorization: send `Authorization: Bearer <token>` for protected routes.

## Notes

- Passwords are hashed with Node's built-in PBKDF2 before being stored in `data/users.json`.
- Seed script creates a `demo` user with password `password123` and a placeholder content row.
- Replace `scripts/lint-placeholder.js` with ESLint/TypeScript linting when expanding the project.

## Keyboard navigation (comics & webtoons)

- Arrow keys are reserved for navigation: `ArrowLeft` and `ArrowRight` move to the previous/next page.
- Webtoon reading modes also wire `ArrowUp`/`ArrowDown` to previous/next within the visible viewport so vertical scrolling only advances what is on screen.
- Compressed comics/webtoons (CBZ/ZIP archives) must pick a reading mode (`archive-comic` or `archive-webtoon`) via `PATCH /api/content/:id/navigation` before shortcuts can be attached. Regular entries default to `paged`, and types containing `webtoon` default to `webtoon`.
