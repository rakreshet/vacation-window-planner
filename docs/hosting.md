# Free public demo on Vercel and Neon

This setup uses one Vercel Hobby project for the React frontend and FastAPI API,
and one Neon Free PostgreSQL project. Users visit one `vercel.app` URL. Vercel
Hobby is for personal, non-commercial use; review eligibility before using it
for a business. Both providers impose free usage quotas. AI and flight-provider
usage are separate from hosting.

## Current deployment

Deployed and verified on October 4, 2026:

- Public URL: [Vacation Window Planner](https://vacation-window-planner.vercel.app).
- Vercel project: `vacation-window-planner` in `guy-s-team1`, Hobby plan.
- Production deployment: `dpl_9oPH5PBvcyASajsgqwA5KPuhJYQr`, status READY.
- Neon project: `fancy-surf-80289035`, Free plan, PostgreSQL 18 in Frankfurt.
- Production branch: `br-dark-rice-b1jai0zg`; preview branch:
  `br-royal-shape-b1r9m9o7`. Both are at migration `20260926_09`.
- The API runs in Vercel region `fra1`; production and preview each use their
  own pooled database URL. AI provider keys are absent.

The first live deployment was published from local source. This PR puts the
hosting configuration on top of the latest GitHub code so future deployments
can use the repository's default branch without replacing newer app changes.

## Git deployment setup

The existing Vercel project is connected to
`rakreshet/vacation-window-planner`, with Git deployments enabled and `main` as
the production branch (this repository has no `master` branch). The build root
is the repository root. `vercel.json` selects FastAPI and supplies the build
settings; there is no Output Directory override.

Each successful build from a merge or push to `main` updates the public
production URL. Other branches and PRs produce preview
deployments with the separate preview database. The GitHub CI workflow runs the
backend and frontend checks; Vercel runs its build separately, so CI does not by
itself delay a production deployment. Review the CI and preview checks before
merging. Failed builds keep the previous production deployment live.

The hosting files must be merged before Git builds can serve the app. No database
migration is added by this PR: both hosted branches already use the existing
`20260926_09` schema. Future schema changes still need explicit migrations against
the intended database before compatible app code is deployed. Ordinary builds
and application requests do not run migrations.

For a manual deployment after checks and any required migrations:

```sh
npm exec --package=vercel -- vercel deploy --prod --scope guy-s-team1
```

## Initial live verification

Unauthenticated HTTP checks passed for the homepage and built assets, database
health, session creation, search and opportunities, comparison, annual planning,
feedback, authentication errors, annual validation, and JSON 404s. The generated
snapshots were confirmed in PostgreSQL. Browser verification also passed for
search, saving an option, and reopening it after reload. The runtime error scan
returned no error logs. Calendar generation is covered by the frontend tests;
the in-app browser's download event could not be observed during the live check.

## How it runs

- Import the **repository root**, not `frontend/` or `backend/`.
- `vercel.json` selects FastAPI and builds React into `frontend/dist/`.
  `app.frontend()` serves this output and supports Vercel's CDN promotion.
  The files also remain in the Python bundle, so they are available when CDN
  promotion is not enabled. Confirm the actual deployment's asset routing.
- `app.py` exposes the existing API at `/api`. The frontend already uses this
  same-origin path, so no browser API URL or cross-origin setup is needed.
- Python 3.12 and the production dependencies exported from `backend/uv.lock`
  are pinned at the root. Runtime packaging includes `backend/src` and the built
  frontend. Local environment files and editor metadata are excluded.
- Database URLs from Neon are normalized to the installed psycopg driver. TLS
  connection parameters and encoded passwords are retained. Vercel function
  instances release database connections after use; Neon supplies pooling.
- Local Docker Compose continues to use its existing entrypoints and proxy.

## First deployment

1. Sign in to Vercel and Neon, keeping both on their free plans. Connecting their
   Codex integrations allows setup without pasting credentials into chat.
2. Create a **fresh demo database** in Neon, near the Vercel function region.
   Keep the local development database separate. Use the pooled connection URL
   for the app and a direct connection URL for migrations. Keep `sslmode=require`
   (or a stricter supplied TLS setting).
3. Apply the existing schema before publishing. From the repository root:

   ```sh
   uv run --directory backend python ../scripts/migrate_hosted.py
   ```

   The helper reads the direct URL at a hidden prompt, confirms the target host
   and database, then runs `alembic upgrade head`. It does not save the URL. Use
   only the new hosted demo database. This creates the schema, not local data.
4. Create a Vercel project from this repository's root. Let `vercel.json` provide
   the framework and build settings; leave Output Directory unset. A CLI deploy
   from the root can publish current local code; a Git import publishes committed
   remote code, so it will not include uncommitted local changes.
5. Set **server-side** `DATABASE_URL` to the pooled Neon URL in Vercel. Add
   `CORS_ORIGINS=[]` and `SOURCE_TEXT_RETENTION_DAYS=0`. Do not set a custom
   `VITE_API_BASE_URL`: its default `/api` is correct. Do not supply
   `GEMINI_API_KEY` or `XAI_API_KEY` for the first free demo.
6. Keep Preview and Production databases separate. Do not attach the production
   connection string to untrusted pull-request previews. Migrations run
   explicitly, never during ordinary app requests or preview builds.
7. Deploy, then check the production URL without signing into Vercel. If it
   requires a Vercel login, inspect the project's Deployment Protection settings;
   use the public production URL when sharing the demo.

Keep connection URLs and API keys out of Git, PR text, screenshots, terminal
history, and chat. `.gitignore` and `.vercelignore` exclude local environment
files and deployment metadata. Database connection strings belong in Vercel's
server-side environment variables, never frontend variables.

## Verification before sharing

- `/` loads the planner and its artwork/styles.
- `/api/health` returns HTTP 200 with `status: ok` and `database: connected`.
- A structured search creates an anonymous session and returns recommendations.
- Compare and annual planning work, including invalid-input errors.
- Saving and reloading options works in the same browser; calendar export works.
- `/api/unknown` returns a JSON 404, not the React page.
- Interpretation reports unavailable when no provider key is configured.

The hosted origin has its own browser storage. Localhost saved options do not
automatically appear on the hosted site. The database can sleep when idle;
allow for the first request to take longer. Monitor both free-plan quotas.

## Later changes

After changing backend dependencies, refresh the root export:

```sh
uv export --directory backend --locked --no-dev --no-emit-project --no-hashes --no-annotate --no-header --output-file ../requirements.txt
```

Run the normal backend checks, frontend tests, and production build. Before
deploying a schema change, review compatibility and apply migrations to the
intended database. A Vercel rollback restores code, not the database schema.

Official references: [FastAPI deployment](https://vercel.com/docs/frameworks/backend/fastapi),
[Python runtime](https://vercel.com/docs/functions/runtimes/python),
[Hobby plan](https://vercel.com/docs/plans/hobby),
[Neon plans](https://neon.com/pricing).
