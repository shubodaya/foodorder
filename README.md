# Food Ordering Application

This README explains only how to use the live website.
Use your Cloudflare Pages domain in place of `<your-pages-domain>`.

## Main Portal

- `https://<your-pages-domain>/`
Choose your cafe and start ordering.

## Staff Login

- `https://<your-pages-domain>/staff-login`
Staff sign in page for kitchen/admin access.

Default staff users:
- Admin: `admin@raysdiner.local` / `admin123`
- Kitchen: `kitchen@raysdiner.local` / `kitchen123`

## Rays Diner Links

- `https://<your-pages-domain>/raysdiner/menu`
Customer menu for Rays Diner (browse categories and add food).
- `https://<your-pages-domain>/raysdiner/cart`
Customer cart and checkout for Rays Diner.
- `https://<your-pages-domain>/raysdiner/order-board`
Live order board screen for Rays Diner (preparing and ready numbers).

## Loves Grove Links

- `https://<your-pages-domain>/lovesgrove/menu`
Customer menu for Loves Grove.
- `https://<your-pages-domain>/lovesgrove/cart`
Customer cart and checkout for Loves Grove.
- `https://<your-pages-domain>/lovesgrove/order-board`
Live order board screen for Loves Grove.

## Cosmic Cafe Links

- `https://<your-pages-domain>/cosmiccafe/menu`
Customer menu for Cosmic Cafe.
- `https://<your-pages-domain>/cosmiccafe/cart`
Customer cart and checkout for Cosmic Cafe.
- `https://<your-pages-domain>/cosmiccafe/order-board`
Live order board screen for Cosmic Cafe.

## Staff Pages After Login

- `https://<your-pages-domain>/new-orders`
Realtime incoming customer orders for kitchen/staff.
- `https://<your-pages-domain>/staff-dashboard`
Staff dashboard (admin controls).
- `https://<your-pages-domain>/staff-menu-management`
Add/edit/delete categories, menu items, extras, and images.
- `https://<your-pages-domain>/end-of-day`
Generate end-of-day receipt and sales summary.

## Customer Usage Flow

1. Open `https://<your-pages-domain>/`.
2. Choose cafe: Rays Diner, Loves Grove, or Cosmic Cafe.
3. Add items from menu and open cart.
4. Enter name and place order (email is optional for receipt).
5. Note the large order number shown on screen.
6. Watch the matching cafe order-board page until the order is ready.

## Staff Usage Flow

1. Open `https://<your-pages-domain>/staff-login` and sign in.
2. Open `https://<your-pages-domain>/new-orders`.
3. Select cafe in staff view and process orders.
4. Move orders through statuses and mark completed.
5. Use `https://<your-pages-domain>/end-of-day` for daily totals.
