# Rays Diner Self-Service Food Ordering System

Full-stack food ordering system for in-cafe self-ordering (mobile QR + kiosk), kitchen realtime operations, and staff management.

## Tech Stack

- Frontend: React, Tailwind CSS, Axios
- Backend: Node.js, Express
- Database: PostgreSQL
- Realtime: Socket.io
- Auth: JWT
- Deployment: Docker + Docker Compose

## Project Structure

- `frontend`
  - `src/pages`
  - `src/components`
  - `src/services`
  - `src/context`
- `backend`
  - `controllers`
  - `routes`
  - `models`
  - `middleware`
  - `config`
  - `sql`

## Features

- Customer
  - Browse menu by category
  - Select item extras
  - Add to cart, adjust quantity, remove line items
  - Place order with customer name + optional table number
  - Track order status in realtime (`Pending -> Preparing -> Ready -> Completed`)
- Staff
  - Staff login via `/staff-login`
  - Dashboard at `/staff-dashboard`
  - Menu management at `/staff-menu-management`
  - Create/delete categories
  - Add/edit/delete extras
  - Add/edit/delete menu items and assign allowed extras
  - Order view at `/staff-orders`
- Kitchen
  - Realtime incoming orders dashboard (`/kitchen`)
  - Notification sound for new orders
  - Preparation timer per order
  - Status updates pushed live via Socket.io

## API Endpoints

- Auth
  - `POST /api/auth/login`
- Menu
  - `GET /api/menu`
  - `POST /api/menu` (admin)
  - `PUT /api/menu/:id` (admin)
  - `DELETE /api/menu/:id` (admin)
  - `GET /api/menu/categories`
  - `POST /api/menu/categories` (admin)
  - `DELETE /api/menu/categories/:id` (admin)
  - `GET /api/menu/extras`
  - `POST /api/menu/extras` (admin)
  - `PUT /api/menu/extras/:id` (admin)
  - `DELETE /api/menu/extras/:id` (admin)
- Orders
  - `POST /api/orders`
  - `GET /api/orders` (kitchen/admin)
  - `GET /api/orders/:id`
  - `PUT /api/orders/:id/status` (kitchen/admin)

## Database Tables

- `users`
- `categories`
- `menu_items`
- `extras`
- `menu_item_extras`
- `orders` (includes auto-generated `order_number`)
- `order_items`
- `order_item_extras`

Schema file: `backend/sql/schema.sql`

## Seeded Menu

`npm run db:init` seeds your requested categories and items when `menu_items` is empty:

- Burgers & Baps
  - Cheese Burger
  - Beef Burger
  - Egg Sausage Bap
  - Bacon Egg Sausage Bap
- Chips
  - Chips
  - Chips + Cheese
  - Chips + Curry
  - Chips + Chilli
- Jacket Potato
  - Jacket + Cheese
  - Jacket + Chilli
  - Jacket + Curry
- Kids Meals
  - Kids Cheese Burger Meal
  - Kids Chicken Chunk Meal
  - Kids Beef Burger Meal
  - Kids Cold Lunch Box Meal

## Local Run (Docker Recommended)

1. Start all services:

```bash
docker compose up --build
```

2. Open app:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`

## Local Run (Without Docker)

1. Create PostgreSQL database `rays_diner`
2. Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run db:init
npm run dev
```

3. Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## .env Examples

- Backend: `backend/.env.example`
- Frontend: `frontend/.env.example`

## Default Staff Accounts

- Admin
  - Email: `admin@raysdiner.local`
  - Password: `admin123`
- Kitchen
  - Email: `kitchen@raysdiner.local`
  - Password: `kitchen123`

## Route Map

- Customer
  - `/menu`
  - `/cart`
  - `/order-status`
- Kitchen
  - `/kitchen`
- Staff
  - `/staff-login`
  - `/staff-dashboard`
  - `/staff-menu-management`
  - `/staff-orders`

## Notes

- QR flow can point directly to `/menu`.
- Kitchen/admin routes are protected by JWT role checks.
- Uploads are served from `/uploads/*`.
