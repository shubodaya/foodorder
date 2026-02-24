# Woodlands Family Theme Park Food Ordering

This project runs a customer ordering portal, a live order board, and a staff portal for cafe operations.

## Start The Website

1. In project root, create `.env` from `.env.example` and fill SMTP values if you want email receipts.
2. Run:

```bash
docker compose up --build
```

3. Open in browser:

- Landing page: `http://localhost:5173/`
- Backend API health base: `http://localhost:5000/api`

## Run Online From GitHub

This repo includes GitHub Actions in `.github/workflows`:

- `ci.yml`: runs backend syntax checks + frontend production build on every push/PR
- `deploy-render.yml`: auto-deploys backend/frontend on push to `main` using Render deploy hooks

### One-time setup

1. Create 3 services on Render:
- PostgreSQL database
- Backend web service from `./backend/Dockerfile`
- Frontend web service from `./frontend/Dockerfile`

2. Set backend Render environment variables:
- `NODE_ENV=production`
- `PORT=5000`
- `DATABASE_URL=<render postgres internal url>`
- `JWT_SECRET=<strong-secret>`
- `CLIENT_URL=<your frontend public url>`
- `RECEIPTS_ENABLED=true`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

3. Set frontend Render environment variables:
- `VITE_API_URL=<your backend public url>/api`
- `VITE_SOCKET_URL=<your backend public url>`

4. In GitHub repo -> `Settings` -> `Secrets and variables` -> `Actions`, add:
- `RENDER_BACKEND_DEPLOY_HOOK`
- `RENDER_FRONTEND_DEPLOY_HOOK`

5. Push to `main`. GitHub Action will trigger online deploy automatically.

## Web Links (Customer)

- Choose cafe: `http://localhost:5173/`
- Rays Diner menu: `http://localhost:5173/raysdiner/menu`
- Loves Grove menu: `http://localhost:5173/lovesgrove/menu`
- Cosmic Cafe menu: `http://localhost:5173/cosmiccafe/menu`
- Rays Diner order board: `http://localhost:5173/raysdiner/order-board`
- Loves Grove order board: `http://localhost:5173/lovesgrove/order-board`
- Cosmic Cafe order board: `http://localhost:5173/cosmiccafe/order-board`

## Web Links (Staff)

- Staff login: `http://localhost:5173/staff-login`
- New orders: `http://localhost:5173/new-orders`
- Staff dashboard: `http://localhost:5173/staff-dashboard`
- Menu management: `http://localhost:5173/staff-menu-management`
- End of day receipt: `http://localhost:5173/end-of-day`

## Default Staff Accounts

- Admin: `admin@raysdiner.local` / `admin123`
- Kitchen: `kitchen@raysdiner.local` / `kitchen123`

## How Customers Use It

1. Open the cafe menu URL (or scan QR code linked to that URL).
2. Add items and extras, then open cart.
3. Enter name and optional email, place order.
4. A large order number popup is shown, then returns automatically to the menu.
5. Customer tracks progress on the live order board screen.

## How Staff Use It

1. Login at `/staff-login`.
2. Open `/new-orders` and select cafe filter.
3. Move incoming orders through kitchen flow (`Preparing` -> `Ready` -> `Completed`).
4. Completed orders are removed from active live queue.
5. Generate daily totals from `/end-of-day`.

## Email Receipts (Important)

Email receipts and order-ready notifications only send when SMTP is configured.

Set these in project root `.env`:

- `RECEIPTS_ENABLED=true`
- `SMTP_HOST=`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=`
- `SMTP_PASS=`
- `SMTP_FROM=` (optional, defaults to `SMTP_USER`)

If SMTP is missing, order placement still works, but receipt email cannot be sent.

## Mobile Access On Same Wi-Fi

1. Find your computer LAN IP (example `192.168.1.25`).
2. Open on mobile using the same links with that IP:

- `http://192.168.1.25:5173/`
- `http://192.168.1.25:5173/raysdiner/menu`

## End Of Day Receipt Files

Generated end-of-day reports are saved in `receipts/`.
