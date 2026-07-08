# Word Up Platform

Word Up is a two-sided marketplace that connects creative writers with
businesses looking for writing talent. Writers build profiles, upload writing
samples, and apply to projects; businesses discover writers, purchase sample
access with credits, post projects, and review applications.

- **Frontend:** React 19 + Create React App (via CRACO), Tailwind CSS, shadcn/ui, React Router.
- **Backend:** FastAPI + Motor (async MongoDB), JWT + session-cookie auth.

---

## Live demo (no backend required)

The published site runs in **demo mode**: the entire API is emulated in the
browser (backed by `localStorage`), so the full app works with no server —
sign up, log in, upload documents, discover writers, purchase samples with
credits, and download files. Demo data lives only in your browser and can be
reset from the banner at the top of the page.

- Deployed via GitHub Pages: `https://marshall-007.github.io/word-up-platform/`
- Try the seeded accounts (password `demo1234`): `demo.writer@wordup.app`,
  `demo.business@wordup.app` — or just sign up fresh.

Demo mode is controlled by the `REACT_APP_DEMO_MODE` build flag. When a real
backend is hosted, set the `REACT_APP_BACKEND_URL` repo secret and the deploy
workflow automatically builds against the live API instead.

---

## Features

- Email/password authentication with bcrypt hashing and JWT + HttpOnly session cookies
- Optional third-party (Google) OAuth sign-in (disabled unless configured)
- Profile pictures (uploaded, resized client-side) with an initials fallback
- Writer profiles, genres, and up to two writing samples (paste text or upload a document)
- Document uploads are validated to contain real readable text — empty files,
  scanned-image-only PDFs, and gibberish are rejected
- Business discovery feed with a credit-based paywall; full content and file
  download unlock after purchase (buyers keep permanent access via a snapshot)
- Writer "Sales" view showing who bought each sample and credits earned
- Project posting (budgets in South African rand), applications, and accept/reject workflow
- A 4-step guided walkthrough on first login (replayable from the account menu)
- Account, settings, and help pages

---

## Repository structure

```
backend/     FastAPI application (server.py), seed scripts, Dockerfile
frontend/    React application (CRACO + Tailwind + shadcn/ui)
tests/       Backend API integration tests (pytest, in-memory Mongo)
docs/        Additional developer notes
```

---

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- MongoDB 5+ (local install or a hosted cluster such as MongoDB Atlas)

---

## Local development

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # or requirements-dev.txt to run tests
cp .env.example .env                      # then edit values as needed
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API is served under the `/api` prefix (e.g. `GET /api/health`).
Interactive docs are available at `http://localhost:8000/docs` in development.

Required environment variables are documented in `backend/.env.example`. At a
minimum set `MONGO_URL`, `DB_NAME`, and `JWT_SECRET`.

### 2. Frontend

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env                      # point REACT_APP_BACKEND_URL at the backend
npm start
```

The app runs at `http://localhost:3000`.

### 3. (Optional) Seed sample data

```bash
cd backend
python seed_test_users.py     # creates demo writer/business accounts
python seed_projects.py       # adds a few open projects
```

Seed scripts refuse to run when `ENVIRONMENT=production` unless `ALLOW_SEED=1`
is set. `seed_projects.py` only wipes existing projects when `SEED_RESET=1`.

---

## Testing and validation

```bash
# Backend API tests (uses an in-memory MongoDB, no server required)
pip install -r backend/requirements-dev.txt
python -m pytest -q

# Backend syntax check
python -m py_compile backend/server.py

# Frontend production build
cd frontend && npm run build
```

CI runs the backend tests and a frontend build on every push and pull request
(`.github/workflows/ci.yml`).

---

## Deployment

### Frontend — GitHub Pages

`.github/workflows/deploy.yml` builds the frontend and publishes it to GitHub
Pages on every push to `main`. The app is served from a sub-path
(`/word-up-platform`), configured via the `homepage` field in
`frontend/package.json`; React Router uses `PUBLIC_URL` as its `basename`, and
`public/404.html` provides SPA fallback routing.

Set the repository secret `REACT_APP_BACKEND_URL` to your deployed backend URL
so the published frontend can reach the API.

### Backend — any container/PaaS host

The backend ships with a `Dockerfile` and a `railway.toml`/`Procfile` for
Railway-style hosts. It listens on `$PORT` (default 8000).

```bash
cd backend
docker build -t word-up-backend .
docker run -p 8000:8000 --env-file .env word-up-backend
```

For production set `ENVIRONMENT=production`, a strong `JWT_SECRET`, and
`CORS_ORIGINS` to your frontend origin(s). See `SECURITY.md` for the full
hardening checklist — including rotating any secrets that were committed in
earlier revisions.

---

## License

MIT — see [LICENSE](./LICENSE).
