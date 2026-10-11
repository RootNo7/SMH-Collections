# SMH Collections

A premium editorial-style ecommerce storefront with a Node.js/Express backend and a private SQLite database. The project is split into small, named files rather than a single monolithic page.

## Included

- 17 HTML pages: home, shop, product details, collections, cart, wishlist, checkout, account, orders, order details, about, contact, FAQs, privacy, terms, admin, and a custom 404 page.
- Responsive ivory/espresso/olive editorial design, reusable header/footer, mobile navigation and image fallbacks.
- Product catalogue and category/search/sort API, seeded with sample products.
- Guest cart and wishlist saved locally; account cart and wishlist stored server-side and merged after sign-in.
- Account registration, email verification, sign-in/out, profile editing, password change and single-use expiring password-reset links.
- Argon2id password hashes, server-side sessions in SQLite, HTTP-only cookies, CSRF token and Origin checks, rate limiting, security headers, server validation and session-version invalidation after password changes.
- Server-authoritative order totals and stock validation, COD checkout, order history and order-status transitions.
- Admin dashboard for product inventory, order status, contact messages and newsletter signups.
- Contact form, newsletter subscription endpoint, policy-page templates, manifest, robots and sitemap files.
- Tests and Windows setup instructions.

## Requirements

- Node.js 22.16 or newer in the Node 22 or 24 line; Node 24 LTS is recommended.
- npm (installed with Node.js).
- Windows 10/11 64-bit, macOS, or Linux. The store itself is intentionally lightweight; installation may take longer on older hardware.
- Internet connection for the remote Unsplash editorial/product photos and Google Fonts. If remote images fail, a local neutral SVG fallback is used.

## Run locally on Windows

**Beginner-friendly option:** double-click `setup-windows.bat` once to create `.env`, generate a session secret, and install dependencies. After setup finishes, double-click `start-windows.bat` whenever you want to run the shop. Both scripts need Node.js installed; setup also needs an internet connection to download packages.

Manual setup is available below.

1. Extract this directory and open Command Prompt or PowerShell **in the `SMH-Collections` project folder**.
2. Check Node and npm:

   ```bat
   node --version
   npm --version
   ```

3. Install dependencies:

   ```bat
   npm install
   ```

4. Create your local environment file:

   ```bat
   copy .env.example .env
   ```

5. Generate a fresh session secret:

   ```bat
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Copy the output and replace the `SESSION_SECRET` placeholder inside `.env`. Do not put the secret in screenshots or commit `.env` to a repository. Keep `NODE_ENV=development` and `APP_ORIGIN=http://localhost:3000` for local work.

6. Start the website:

   ```bat
   npm run dev
   ```

7. Open **http://localhost:3000/**. Use `localhost` exactly for the local origin check; do not open HTML files directly from File Explorer or switch to `127.0.0.1` mid-session.

8. Check the backend at **http://localhost:3000/api/health**. A working server returns `{"status":"ok","service":"SMH Collections API"}`.

To stop the development server, press `Ctrl+C` in its terminal.

## Create the first administrator

1. Start the server and open `account.html` through `http://localhost:3000/account.html`.
2. Register the account that should be the store administrator.
3. In development, open the verification link printed in the server terminal to verify that account.
4. Stop the server (`Ctrl+C`). In the project folder, run:

   ```bat
   npm run admin:create -- your-email@example.com
   ```

5. Restart the server and sign in with that account. Open **http://localhost:3000/admin.html**.

The public registration route can only create customer accounts; administrator privileges are assigned with this local command.

## Password recovery email

In development, the verification link is printed in the **server terminal** and expires after 24 hours; password reset links are printed there and expire after 30 minutes. These are local-development behaviors. For a production deployment, configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, and `MAIL_FROM` in the deployment's private environment and set `NODE_ENV=production`. The application refuses to start in production without a valid HTTPS `APP_ORIGIN`, a strong session secret and configured email delivery.

Never ship real SMTP credentials in this project folder or commit them to Git. Configure them using your hosting provider's secret/environment-variable settings.

## Test and check code

```bat
npm test
npm run check
```

`npm test` runs lightweight validation and project-structure tests. It is not a full penetration test or a substitute for end-to-end acceptance testing in a staging deployment.

## Main directory

```text
SMH-Collections/
├── setup-windows.bat          First-time Windows setup helper
├── start-windows.bat          Windows development launcher
├── server.js                  Express entry point, security middleware and static hosting
├── package.json               Dependencies and commands
├── .env.example               Safe configuration template
├── server/
│   ├── db.js                  SQLite schema and DB initialization
│   ├── seed.js                Sample product catalogue
│   ├── lib/
│   │   ├── mailer.js          SMTP / local reset-link handling
│   │   ├── security.js        CSRF and account/admin authorization
│   │   ├── sqlite-session-store.js  Server-side sessions in SQLite
│   │   └── validation.js      Reusable input validation helpers
│   └── routes/
│       ├── auth.routes.js     Accounts, sessions and password recovery
│       ├── store.routes.js    Products, cart, wishlist and orders
│       ├── admin.routes.js    Inventory and administration endpoints
│       └── contact.routes.js Contact form and newsletter endpoints
├── scripts/make-admin.js      Local administrator provisioning
├── tests/                     Lightweight automated tests
├── data/                       Private database data (ignored by Git)
└── public/
    ├── *.html                  Store pages
    ├── css/style.css           Editorial responsive design
    ├── js/                     Client interaction modules
    ├── images/placeholder.svg   Local fallback image
    ├── favicon.svg
    ├── manifest.webmanifest
    ├── robots.txt
    └── sitemap.xml
```

## Main APIs

- `GET /api/health`, `GET /api/security/csrf`
- `POST /api/auth/register`, `/login`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password`; `GET/PATCH /api/auth/me`
- `GET /api/products`, `GET /api/products/:id`
- `GET/POST/DELETE /api/cart`, cart item add/update/remove routes
- `GET/POST/DELETE /api/wishlist/:productId` and `GET /api/wishlist`
- `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`
- `GET /api/admin/summary`, `/orders`, `/products`, `/contact`, `/newsletter`, `/customers` and protected product/order mutation routes
- `POST /api/contact`, `POST /api/newsletter`

## Important boundaries before launch

This is a substantial local ecommerce starter, **not a claim of production certification or literal end-to-end encryption**. The server must read necessary account and order details to fulfil orders. Passwords are hashed; they are not end-to-end encrypted. The database/session files should be protected at the host and backups encrypted by the operator.

- Cash on delivery is the only payment method enabled. No card data is collected or stored. A real payment processor, webhook verification and reconciliation workflow are not included.
- Account deletion, full refund tooling, taxes, shipping-provider integration, audit logs and automated backups need business-specific implementation before opening the store publicly. Email verification is required before checkout and admin access.
- A policy template is not legal advice. Replace the example legal wording with policies that reflect the real operator and jurisdiction.
- Product photos are referenced from Unsplash URLs and are not bundled locally. The site includes a fallback image for environments where remote photo loading fails. Replace `example.com` in `public/robots.txt` and `public/sitemap.xml` with your real HTTPS domain before enabling search-engine indexing.
- Default products, prices, inventory and policy text are sample content. Verify product accuracy and stock before accepting real orders.
- Use HTTPS and configure trusted proxy settings correctly in a deployment. Do not expose the development server directly to the internet.

## Security design notes

Passwords use Argon2id with OWASP's baseline configuration (19 MiB memory, two iterations, one lane). Session IDs stay in an HttpOnly cookie and server-side session state is stored in SQLite; CSRF tokens and a same-origin check guard state-changing API calls. A version counter invalidates other sessions after a password reset or change. These measures reduce risk but do not make a web app invulnerable; keep dependencies updated and do a production security review.
