# Word Up Platform

Word Up is a two-sided marketplace connecting creative writers and businesses.

## Current Scope

- Authentication (email/password + Google OAuth session bridge)
- Writer and business dashboards
- Writer profile and sample upload
- Business discovery flow with swipe interactions
- Credit-based sample purchasing
- Account, settings, and help pages

## Repository Structure

- frontend/: React + CRACO application
- backend/: FastAPI + MongoDB API service
- backend_test.py: API integration smoke test script
- test_result.md: Testing protocol and shared test tracker template

## Local Setup

### Backend

1. Create and activate a virtual environment.
2. Install requirements from backend/requirements.txt.
3. Ensure backend/.env contains MONGO_URL, DB_NAME, JWT_SECRET, JWT_ALGORITHM.
4. Start the API:

```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

1. Install dependencies.
2. Ensure frontend/.env points REACT_APP_BACKEND_URL to your backend.
3. Start the app:

```bash
cd frontend
npm start
```

## Validation Commands

### Backend syntax checks

```bash
python -m py_compile backend/server.py backend_test.py
```

### Frontend build

```bash
cd frontend
npm run build
```

### Frontend tests

No test files are currently present. To run test command safely:

```bash
cd frontend
npm run test -- --watchAll=false --passWithNoTests
```

## Notes

- AI assistance endpoint is currently disabled in backend/server.py.
- Discovery responses are privacy-aware and redact unpurchased full sample content.
