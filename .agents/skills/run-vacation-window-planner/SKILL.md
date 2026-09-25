---
name: run-vacation-window-planner
description: Start, verify, or troubleshoot this repository's local Docker Compose app when asked to run Vacation Window Planner locally. Not for deployment.
---

# Run Vacation Window Planner locally

Work from this repository's root, identified by `compose.yaml`. Read the current README's **Run locally** section before acting; it is the source of truth for commands and host ports.

If the user asks only how to run the app, give the README steps without starting containers. If asked only for status, inspect the current Compose state and health without starting or stopping services. For an explicit request to start the app, continue below.

1. Check that Docker Compose can reach the Docker daemon. If it cannot, explain that Docker Desktop or the user's Docker Engine must be started.
2. Preserve an existing `.env`. If it is absent, create it from `.env.example` without overwriting another file. Treat its contents as secrets and do not print them.
3. Start the Compose app in detached mode with a build. Confirm the database and API become healthy and the frontend is running using `docker compose ps`.
4. Confirm the frontend's `/api/health` response through its mapped local port. Derive the port from `docker compose ps` or `docker compose port frontend 5173`, so a `WEB_PORT` override still works.
5. If startup or health fails, inspect only the relevant service's recent Compose logs, report the concrete failure, and make the smallest in-scope repair if asked. Leave existing data volumes intact.

Report the verified local URL and that the current app is only the foundation health screen. Stop after that result. If asked to stop the app, use `docker compose down` without deleting volumes.
