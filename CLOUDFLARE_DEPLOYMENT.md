# Cloudflare + Supabase Deployment

This project is migrated for:
- Frontend: Cloudflare Pages (`frontend`)
- Backend API: Cloudflare Workers (`worker-api`)
- Database: Supabase Postgres

## 1) Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `backend/sql/schema.sql`.
3. Create a public storage bucket named `menu-images`.
4. Seed default users/menu data (one-time) from your local machine:
   - Set `DATABASE_URL` to your Supabase connection string.
   - Run:

```powershell
cd backend
npm install
$env:DATABASE_URL="postgresql://..."
npm run db:init
```

This creates default staff users:
- `admin@raysdiner.local` / `admin123`
- `kitchen@raysdiner.local` / `kitchen123`

## 2) Cloudflare Worker API setup

1. Create a Worker (or use Wrangler deploy from `worker-api`).
2. Configure Worker variables/secrets:

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `CLIENT_URL` (comma-separated allowed origins, example: `https://your-pages.pages.dev,http://localhost:5173`)

Optional:
- `RECEIPTS_ENABLED` (`true` or `false`)
- `SUPABASE_MENU_BUCKET` (default `menu-images`)
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`

Important for email:
- Worker email uses Brevo HTTP API.
- SMTP-only credentials are not enough for Worker email sending.
- You need a Brevo API key in `BREVO_API_KEY`.

3. Deploy Worker:

```powershell
cd worker-api
npm install
npm run deploy
```

## 3) Cloudflare Pages setup

1. Create a Pages project from this GitHub repo.
2. Build settings:
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

3. Set Pages environment variables:
- `VITE_API_URL` = your Worker URL + `/api`
  - Example: `https://foodorder-api.your-subdomain.workers.dev/api`
- `VITE_ASSET_BASE_URL` = your Pages URL
  - Example: `https://your-pages.pages.dev`

Then redeploy Pages.

## 4) GitHub Actions auto deploy

Workflow file: `.github/workflows/deploy-render.yml` (now configured for Cloudflare)

Set repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`
- `CLOUDFLARE_WORKER_API_URL` (example: `https://foodorder-api.your-subdomain.workers.dev/api`)

On push to `main`, workflow deploys Worker + Pages.

## 5) Local development

Frontend (local):
```powershell
cd frontend
npm install
npm run dev
```

Worker API local:
```powershell
cd worker-api
npm install
Copy-Item .dev.vars.example .dev.vars
# Fill .dev.vars with real values
npm run dev
```

If running frontend locally against local worker, set `frontend/.env`:
```env
VITE_API_URL=http://127.0.0.1:8787/api
VITE_ASSET_BASE_URL=http://localhost:5173
```
