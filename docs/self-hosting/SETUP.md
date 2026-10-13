# LittleRip Metal — local workspace setup

> Documentation snapshot for the separate `~/littlerip-metal` workspace, not this repository's root application. Start with [the handoff index](README.md). Application source, credentials, private data, and generated artifacts are not included in this documentation-only change.

A separate, self-hosted storefront prepared for a future move off Vercel.

**Operation preference: on-demand help from the assistant only.** No auto-start/recovery service or desktop recovery button is installed. If the site is down, ask the assistant to diagnose/restart it using [the on-demand recovery notes](ON_DEMAND_RECOVERY.md). The ordinary website server still needs to be running to serve visitors.

The storefront intentionally shows **the centered LittleRip name and mascot, product images, and prices**. Product details remain in the editable catalogue and Stripe checkout; privacy/shipping pages still exist at their direct URLs. Essential payment/error messages only appear during checkout. The ordinary preview leaves payment disabled. The **interactive test preview** opens a compact, header-free checkout with the product photo and Stripe form appearing together, without real charges or outbound emails.

**The original site, Vercel deployment, littlerip.com DNS, existing tunnels, live Stripe configuration, and sending accounts have NOT been changed.** This project defaults to a private preview with checkout disabled. The five images and $10 prices are placeholders.

## Run the private preview

Requires Node.js 24+ and Python 3 on macOS/Linux. Python's OS file lock prevents two processes from sharing order storage and releases automatically after a crash.

```sh
cd ~/littlerip-metal
npm ci
npm run init
npm run build
npm start
```

Open **http://localhost:4317**. On this Mac the dependencies and build are already prepared. Stop with Control-C. This does not install an always-on service, change sleep settings, or expose your Mac publicly.

### Click images into real Stripe TEST checkout

Run `npm run preview:checkout`, or double-click **Start Preview.command**. Stop the ordinary preview first if it is already running on port 4317. This uses the existing Stripe CLI **test** login, starts a temporary signed-webhook listener, and enables the image/price checkout buttons. Credentials stay in memory: they are not copied to `.env`, source, or logs. It refuses live keys, live configuration, and public hostnames. Email confirmations remain private previews under `var/test/mail`.

Stripe clearly labels the payment form **TEST MODE** (or **Sandbox** in the hosted fallback). For a successful test, use card `4242 4242 4242 4242`, any future expiry and any three-digit CVC; use fictional contact/shipping details. No real money is charged. If the CLI test login expires, sign in with Stripe CLI again; this is not a permanent production credential. A normal `npm start` still respects the conservative `.env` defaults.

## What is deliberately absent

No React/Next.js browser runtime, Vercel functions, AI, accounts, analytics, shopping-cart service, hosted database, external web fonts, image CDNs, or monthly hosting software fee. Two runtime npm dependencies: Stripe's SDK and Nodemailer. Image processing and browser testing are development-only.

## The flow when enabled

1. The visitor clicks a product image or price. Checkout has no LittleRip/mascot header; the photo sits beside the form on wide screens and becomes a compact thumbnail on small screens, so the first fields are visible without scrolling.
2. Stripe.js, session creation, and the image load in parallel. The photo and form are revealed together rather than showing the photo first. Your server validates a signed, time-limited request and creates a server-priced embedded Checkout Session. Card details go directly to Stripe, never through this server. One item, quantity one per order. Without a publishable key or JavaScript, a hosted checkout fallback remains available.
3. Stripe collects email, full name, required shipping and billing details, and payment. Apartment/unit is optional, as it should be. Wallets can supply required details instead of forcing retyping. Currently US/USD only.
4. Only a verified **paid** Stripe session creates a local order. A signed webhook works even if the customer never returns to your site.
5. Customer and owner confirmation messages contain the **same order number**, product, total, and delivery address. Private durable jobs retry failed email attempts.
6. The browser confirmation verifies Stripe's payment state and shows no address/email. Adding `?status=success` cannot fake payment.

An order confirmation says **payment received / not shipped yet**. It does NOT promise the parcel is on its way. A shipping notification/tracking integration is a separate future addition when you actually dispatch a package; this copy does not buy labels, invent tracking numbers, or automatically mark anything shipped.

## Edit products and add images

Edit `catalog.json`. Prices are integer cents. Add JPEG/PNG/WebP originals to `public/source/`; each product supports 1–12 images. Update each image's alt text. Example:

```json
{
  "id": "product-1",
  "name": "Your product",
  "description": "Accurate product description.",
  "priceCents": 2500,
  "active": true,
  "images": [
    { "source": "front.jpg", "alt": "Front view of the product" },
    { "source": "back.jpg", "alt": "Back view of the product" }
  ]
}
```

Run `npm run build`, then restart. AVIF and WebP at 480/768/960 pixels plus JPEG fallbacks are generated once; EXIF metadata is stripped. Images have fixed layout dimensions, lazy loading, and immutable content-hashed URLs. Additional images use accessible gallery controls.

The current crop is centered 4:5. Review final product photos at both desktop and mobile sizes after replacing them. Do not change the catalogue while the production process is running; build a complete new release and restart during a planned update. Old built files are retained in `releases/` for rollback; the current pointer is replaced atomically.

## Production profile and HTTPS (staged, NOT activated)

`.env.live.example` is the public, secret-free production template. A private `.env.live` has been staged locally with `PAYMENT_MODE=live`, `CHECKOUT_ENABLED=false`, and `LIVE_APPROVED=false`. It does not contain permanent live Stripe credentials or a working mail sender yet. Run `npm run live:check` for a read-only list of launch blockers. `npm run start:live` is reserved for an explicitly approved, completed production configuration; it does not change DNS.

The Stripe test badge is not hidden or spoofed. It disappears only when the actual checkout uses matching live keys. The interactive local preview remains in test mode until activation is authorized. Real charges have not been enabled.

The current HTTP localhost preview can cause Chrome to disable saved-card autofill, even though Stripe's iframe is HTTPS. Use test cards only here. Valid HTTPS is required for the public/live checkout; never disable browser security or certificate checks as a workaround.

## Payment and email setup (NOT active yet)

See [the launch checklist](LAUNCH.md). A live launch is refused until all of these are explicit:

- Final product details, approved shipping/returns policies, and `placeholder: false`.
- Correct matching live Stripe server/publishable keys, the live webhook endpoint secret, and a stable signing secret. The publishable key enables embedded checkout.
- HTTPS public origin, `PAYMENT_MODE=live`, `CHECKOUT_ENABLED=true`, and `LIVE_APPROVED=true`.
- Working authenticated SMTP with owner/sender addresses.
- A separate private live data directory, e.g. `DATA_DIR=./var/live`.

Use a dedicated server credential, **not an expiring Stripe CLI credential**, for production. Never share secrets in chat or put them in source control. Secure native setup can be performed with Pi's secret-entry tool when you're ready. The local `.env` must remain mode 600; order folders must remain mode 700.

**Emails:** bring an existing SMTP account (for example Gmail with an app password, if your account supports it) or an email provider. This software requires no email subscription, but account rules, daily sending limits, and deliverability still apply. Custom-domain email requires a verified sender and correctly configured SPF/DKIM/DMARC. Cloudflare Email Routing alone is NOT an outgoing SMTP service. No sender has been authenticated or inbox-tested yet.

`MAIL_TRANSPORT=preview` writes private email previews instead of sending. It cannot consume live email jobs. Test/live directories are mode-bound and cannot be silently mixed. Stripe's separate customer payment receipts should also be enabled and checked before launch; a Stripe receipt is not a shipping confirmation.

## Tests

```sh
npm run check             # offline logic + local Chrome/browser checks
npm run test:stripe       # explicitly creates/expires a SANDBOX checkout
npm run test:stripe:e2e   # explicitly completes a SANDBOX card payment + signed webhook test
npm run test:load        # bounded local traffic test; Stripe mocked
COMPLETE_EMBEDDED_TEST=true npm run test:stripe:embedded  # actual sandbox embedded payment
npm run doctor           # safe configuration and queue report; never prints secrets
npm audit
```

Browser tests use the installed Google Chrome, not your signed-in profile. Set `CHROME_PATH` if different. External Stripe tests use a configured **test** key or the existing local Stripe CLI test login; they refuse live keys. E2E also requires `stripe` CLI for a temporary signed webhook listener. These tests send no real emails and use reserved example.com test identities. Test-mode transactions remain visible in the Stripe sandbox.

See [validation results](VALIDATION.md). Passing tests is not a promise of zero bugs, uptime, tax compliance, or email delivery.

## Lean runtime and concurrency

`npm run pack:runtime` builds `artifacts/runtime/`, currently about **7.1 MB** including both runtime libraries and all compiled image variants. It excludes source art, tests, build tools, credentials, orders, Node, and Python. Development-only type declarations/source maps are removed; executable vendor code is preserved. Startup, a mock SDK request, and local email rendering were tested from this runtime.

The anonymous embedded-mode storefront is rendered once and precompressed with Brotli/gzip; conditional requests can return 304. It contains no buyer tokens or cookies. Checkout/order pages and session responses remain private `no-store`. Image variants stream from disk, and only the checkout page loads Stripe.js.

Checkout work is asynchronous and isolated by unique intent/session IDs. Path-scoped confirmation cookies let multiple tabs coexist without exposing orders to another browser. Limits are intentional abuse/backpressure controls, NOT a promised throughput: **120 new sessions/IP/minute, 600 globally/minute, 300 total checkout requests/IP/minute; 12 Stripe creations in flight, 24 queued, 8-second maximum queue wait**. Reusing an existing session does not consume the new-session allowance. Correct `TRUST_CLOUDFLARE` setup is required behind the public tunnel. All visitors otherwise share the loopback IP allowance.

The local tests handled 1,000 mixed page/assets requests at 40-way concurrency with no HTTP failures, and 30 simultaneous independent checkout starts with a mocked Stripe service. Actual sandbox tests also verified separate browser contexts and multiple tabs. This is not a guarantee about internet bandwidth, Stripe limits, unlimited traffic, uptime, or a globally maximum speed. See the measured report.

## Order storage and recovery

There is no database server. Small, private JSON files under `DATA_DIR` hold checkout snapshots, paid orders, and notification state. Writes are atomic and fsynced. Treat the entire folder as sensitive customer data.

- Back up the **whole data directory plus .env** securely, not just source code.
- Use FileVault and encrypted backups. Do not store backups under a served/public folder or public Git repository.
- Run one server process per data directory; the OS lock enforces this.
- SMTP is **at-least-once**: a rare crash after a mail server accepts an email but before its local state is saved can produce a duplicate. A stable Message-ID helps but does not guarantee inbox deduplication.
- A corrupt record is reported without blocking healthy notifications. Monitor `email_record_error`, `email_mode_blocked`, and `email_retry` logs.
- `npm run doctor` reports the saved `.env` configuration and pending/retrying emails; it does not introspect the temporary interactive launcher's in-memory Stripe credentials or overrides. “Sent” means SMTP accepted the message, not that it reached the inbox.
- After a long outage, use `npm run reconcile -- --days=7` to inspect missed paid sessions. Stop the service, back up data, then use `--apply` to queue verified missing records and restart. This never guesses missing checkout snapshots or sends emails itself.
- Do not delete unsent orders or checkout snapshots. Establish a retention policy appropriate for accounting/disputes/privacy; deleting records blindly can break reconciliation/deduplication.

The app does not manage finite stock, discounts, quantity selection, tax calculation, international shipping, returns processing, or refunds. Payment approval does not guarantee that a postal address is deliverable. Decide the real tax/shipping obligations before taking live orders.

## Move to a newer computer

Copy this project (excluding `node_modules`), the private live `.env`, and **the entire live data directory** using encrypted transfer. Install Node/Python, run `npm ci` and `npm run build`, review the on-demand startup instructions, test, then move the dedicated tunnel after approval. Stop the old writer before starting the new writer. The domain stays the same; it isn't tied to this Mac.

Keep Vercel available for a DNS rollback, but understand that Vercel will not automatically receive the self-hosted server's private order queue. Keep the old webhook receiver running until outstanding payments are reconciled. See the launch checklist for the ordered cutover.
