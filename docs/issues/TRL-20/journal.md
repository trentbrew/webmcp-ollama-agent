## 2026-09-01 — Impl fix (executor)

- Fixed Playwright `webServer` — vite now binds `--host 127.0.0.1` (IPv6-only localhost caused probe failure on `127.0.0.1`).
- `pnpm test:e2e e2e/questionnaire.spec.ts`: 3/3 pass (includes invalid-date Next block).
