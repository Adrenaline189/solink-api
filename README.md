# Solink — Full Project

This zip contains two independent apps:

- **solink-api-fixed/** — Express + Prisma API (SQLite for local dev, easy to switch to Neon Postgres).
- **solink-dashboard/** — Next.js Dashboard hooked to the API (`/api/settings`).

## Quick Start (Local Dev)

### 1) Start API (SQLite)

```bash
cd solink-api-fixed
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

Test API:

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/health/db
curl -X POST http://localhost:4000/api/settings -H "Content-Type: application/json" -d '{"userId":"0x123","range":"7d","timezone":"Asia/Bangkok"}'
curl "http://localhost:4000/api/settings?userId=0x123"
```

### 2) Start Dashboard

```bash
cd ../solink-dashboard
echo 'NEXT_PUBLIC_API_BASE="http://localhost:4000"' > .env.local
npm install
npm run dev
```
Open http://localhost:3000

---

## Switch API to Neon Postgres (when ready)

1. Edit `solink-api-fixed/prisma/schema.prisma` to use Postgres (see the API README for the exact block).
2. Set `.env` with your Neon `DATABASE_URL` (pooled) and `DIRECT_URL` (direct host).
3. `npx prisma generate` and migrate/deploy accordingly.
4. Restart API and verify `GET /api/health/db` returns `{"db":"up"}`.

See **solink-api-fixed/README.md** for full instructions, Render deploy notes, and Cloudflare DNS tips.
