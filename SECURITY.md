# Security policy for the public proof of concept

## Reporting

Do not open a public issue containing a credential, session token, user text, or exploitable payload. Contact the repository owner privately and include only the minimum reproduction data needed.

## Secret handling

- Keep `POSTGRES_PASSWORD`, `GEMINI_API_KEY`, and `XAI_API_KEY` in local `.env` files or deployment secret stores. `.env` is ignored; `.env.example` contains names and safe local defaults only.
- Never place provider keys in request bodies, logs, search snapshots, screenshots, fixtures, commits, pull-request text, or frontend `VITE_` variables.
- Request logging records method, path, status, and duration only. It intentionally excludes headers, query strings, and bodies.
- Before pushing, inspect staged changes and scan tracked files with a credential scanner such as Gitleaks. A minimal manual check is `git diff --cached` plus `git grep -n -I -E '(GEMINI_API_KEY|XAI_API_KEY|api[_-]?key|secret|token)[[:space:]]*[:=]' -- ':!SECURITY.md' ':!.env.example'`.
- If a secret enters Git history, revoke and rotate it immediately before rewriting history. Treat deletion from the latest commit as insufficient.

## Data retention

Anonymous sessions expire after 30 days by default. Raw conversational text older than the configured 30-day default is cleared during subsequent searches; there is no scheduled purge. Session expiry is an authorization limit, not automatic row deletion. Structured Search and comparison snapshots remain for reproducibility without provider credentials. Operators should lower retention where policy requires and delete the database when ending a disposable pilot.
