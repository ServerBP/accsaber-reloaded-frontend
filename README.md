# AccSaber Frontend

Web frontend for the AccSaber platform, an accuracy-based leaderboard system for Beat Saber. Built with Vue 3, TypeScript and Vite.

## Requirements

- Docker and Docker Compose (v2)
- Git
- Node.js 22+ (optional, for hot-reload dev server)

## Quick Start

```bash
git clone https://github.com/Tikugato/accsaber-reloaded-frontend.git accsaber-frontend
cd accsaber-frontend
cp .env.example .env
```

Edit `.env` with your target environment:

**Against production API** (default):
```
API_PROXY_TARGET=https://api.accsaber.com
VITE_ADMIN_URL=https://admin.accsaber.com
VITE_RANKING_URL=https://ranking.accsaber.com
```

**Against local backend**:
```
API_PROXY_TARGET=http://host.docker.internal:8080
VITE_ADMIN_URL=http://localhost/admin.html
VITE_RANKING_URL=http://localhost/ranking.html
```

```bash
docker compose up -d --build
```

Available at `http://localhost`. The container builds the frontend and serves it via nginx, which reverse-proxies `/v1/` requests to the `API_PROXY_TARGET`. No CORS issues since all requests go through the same origin.
Rebuild after changes: `docker compose up -d --build`. Tear down: `docker compose down`.

### Hot-Reload (Development Only)

For active development with hot-reload, use the Vite dev server directly instead of Docker:

```bash
npm install
npm run dev
```

Available at `http://localhost:5173`. The dev server proxies API requests based on `API_PROXY_TARGET` in `.env.development`:

```
API_PROXY_TARGET=https://api.accsaber.com
```

To proxy against a local backend instead:

```
API_PROXY_TARGET=http://localhost:8080
```

## Project Structure

```
src/
  api/              One file per domain (users.ts, maps.ts, leaderboards.ts)
  assets/           Static assets, fonts, logo, design tokens
  components/
    admin/          Admin-only components (AdminTable, MilestoneQueryBuilder)
    common/         Design system components (BaseButton, DataTable, StatBlock)
    domain/         Domain components (PlayerRow, MapCard, ScoreRow)
    layout/         AppNavbar, PageHeader
  composables/      Vue composables (useCountUp, useTiltEffect, useColorExtract)
  router/           Route definitions and guards
  stores/           Pinia stores (auth, theme, categories, modifiers)
  types/
    api/            TypeScript interfaces matching backend DTOs
    display.ts      Component prop types
    enums.ts        String union enums
  utils/            Pure helper functions (formatters, mappers, ranking, color)
  views/            Page-level components (one per route)
```

## Configuration Reference

| Variable | Both | Required | Description |
|---|---|---|---|
| `API_PROXY_TARGET` | Docker | Yes | Backend URL that `/v1/` is proxied to |
| `VITE_ADMIN_URL` | Both | Yes | Admin panel URL |
| `VITE_RANKING_URL` | Both | Yes | Ranking staff panel URL |
| `VITE_WS_BASE` | Vite | No | WebSocket URL (`.env.development` only) |

### Important Note on AI Usage
> *AccSaber's infrastructure, flow and core features are human-made. Tedious tasks were automated with the help of AI (tests, DTOs, some methods). The codebase is manually reviewed and edited, and all creative input is human-generated. I firmly believe that human creativity and intuition are irreplaceable in software development.*
> *If you do not agree with this approach and you are a vibe-coder OR you take a firm No-AI stance, please refrain from using or contributing to this project.*
