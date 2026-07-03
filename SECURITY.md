# Security Policy

## Reporting a vulnerability

If you discover a security issue, please open a private report to the
maintainers rather than a public issue.

## Important: rotate previously committed secrets

Earlier revisions of this repository committed `backend/.env` (and
`frontend/.env`) containing live secrets. Those files are no longer tracked,
but they remain in the git history. Before deploying, you **must** rotate:

- `JWT_SECRET` — generate a new value (`python -c "import secrets; print(secrets.token_urlsafe(48))"`).
  All existing tokens/sessions become invalid, which is the desired effect.
- Any third-party API keys that were present (e.g. an `EMERGENT_LLM_KEY`) —
  revoke and reissue them from the provider.

Never commit real `.env` files. Use `backend/.env.example` and
`frontend/.env.example` as templates; the real files are gitignored.

## Production hardening built into the app

- `ENVIRONMENT=production` refuses to boot with a missing or known-default `JWT_SECRET`.
- Cookies are `HttpOnly` and forced `Secure`/`SameSite=None` in production.
- CORS only reflects credentials for origins explicitly listed in `CORS_ORIGINS`.
- Passwords are hashed with bcrypt; a password change invalidates existing tokens/sessions.
- Basic in-memory rate limiting guards the login and registration endpoints
  (replace with a shared store such as Redis for multi-instance deployments).
- Uploaded sample files are served only to the owner or a business that purchased them.
- Interactive API docs are disabled in production.
