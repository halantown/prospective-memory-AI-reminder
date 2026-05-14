# CookingForFriends — Production Readiness

This checklist covers system-level controls for running the study outside local
development. It intentionally does not track research-material completeness.

## Environment Modes

Select the environment explicitly when starting the backend. The default command
is `python main.py --env <environment>`, which loads `.env.<environment>` before
the config constants are read.

Production loads `.env.production`; `.env.production.example` is only a
template for new deployments.

| Environment | Intended use | Relaxed behavior | Production guards |
|-------------|--------------|------------------|-------------------|
| `development` | Local development, pilot testing, and thesis screenshots | Admin auth may be disabled, test sessions are enabled, wildcard CORS is allowed | None |
| `production` | Real participant data collection | No test-session shortcut, no runtime-plan edits, admin key required, wildcard CORS rejected | Enforced at startup/request time |

The backend rejects any `ENVIRONMENT` value outside `development`, `test`, and
`production`. Runtime configuration is maintained for `development` and
`production`; the internal `test` mode has no committed env template.

## Required Production Environment

Use production-specific values; do not copy the development config. Replace
every placeholder in `.env.production` before starting the backend.

```dotenv
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://<user>:<strong-password>@<host>:5432/<db>
CORS_ORIGINS=https://<participant-host>,https://<admin-host>
ADMIN_API_KEY=<long-random-secret>
MESSAGE_COOLDOWN_S=10
```

Production startup:

```bash
cd CookingForFriends/backend
python main.py --env production
```

Production startup fails if:

- Any required production value still contains a template placeholder.
- `ADMIN_API_KEY` is missing.
- `CORS_ORIGINS` contains `*`.
- `ENVIRONMENT` is not one of the supported modes.

## Development Hooks

These are intentional convenience hooks. They are allowed in `development` and
internal `test` mode, and disabled or guarded in `production`.

| Hook | Purpose | Development/test behavior | Production behavior |
|------|---------|-------------------|---------------------|
| `/api/admin/test-session` | Create an `is_test=true` session and jump to a phase | Enabled behind optional admin auth | Returns `403` |
| Runtime plan editor `PUT /api/admin/timelines/runtime-plan` | Edit active gameplay timing | Enabled behind optional admin auth | Returns `403` |
| Frontend waypoint controls | Floor-plan annotation aid | Vite dev-only via `import.meta.env.DEV` | Not present in production build |
| Admin auth disabled | Local admin convenience | If `ADMIN_API_KEY` unset, admin routes are open | Backend startup fails if unset |

## Admin Access

Admin endpoints use the `X-Admin-Key` header when `ADMIN_API_KEY` is configured.
The frontend admin pages prompt for the key on the first `401` response and keep
it in `sessionStorage` for the current browser tab.

Do not put `ADMIN_API_KEY` in frontend build-time environment variables.

## Participant Session Security

- REST participant endpoints require `X-Session-Token`.
- The game WebSocket requires the same token as a query parameter because browser
  WebSockets cannot set custom headers reliably.
- WebSocket connection logs must not print the raw URL, because query parameters
  can contain participant tokens.
- Mouse-tracking batches are authenticated against the submitted `session_id`
  before records are stored.

## Deployment Smoke Test

Before collecting production data:

1. Start backend with `ENVIRONMENT=production`, explicit `CORS_ORIGINS`, and a
   non-empty `ADMIN_API_KEY`.
2. Confirm backend starts without creating a hard-coded development participant.
3. Confirm backend refuses startup when `CORS_ORIGINS=*`.
4. Open `/admin`, enter the admin key when prompted, and create a real
   participant.
5. Confirm `/api/admin/test-session` returns `403`.
6. Confirm `PUT /api/admin/timelines/runtime-plan` returns `403`.
7. Start one participant session and verify reload/reconnect during main
   experiment restores runtime state.
8. Run `npm run build` and backend tests before using the build.
