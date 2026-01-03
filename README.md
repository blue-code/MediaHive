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
```

## API overview

- `POST /api/auth/register` — create user. Body: `{ "username": "...", "password": "..." }`
- `POST /api/auth/login` — login and receive JWT token.
- `GET /api/content` — list content (public).
- `GET /api/content/:id` — fetch content metadata by id.
- `POST /api/content` — create metadata entry (protected). Body: `{ "title": "...", "type": "video|image|epub|...", "description": "..." }`
- `POST /api/content/upload` — upload a file to local disk (protected). Form-data: `file` + optional `title`, `type`, `description`. Returns the created content record with file path.
- `DELETE /api/content/:id` — delete content and its file (protected).

Authorization: send `Authorization: Bearer <token>` for protected routes.

## Notes

- Passwords are hashed with Node's built-in PBKDF2 before being stored in `data/users.json`.
- Seed script creates a `demo` user with password `password123` and a placeholder content row.
- Replace `scripts/lint-placeholder.js` with ESLint/TypeScript linting when expanding the project.
