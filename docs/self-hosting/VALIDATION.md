# Validation — 2026-10-13 UTC

This is a measured report for the separate local copy, not a certification of production readiness, zero bugs, unlimited traffic, or an absolute maximum speed. Vercel and public DNS were not changed.

## Functional and safety checks

**51/51 Node tests passed**, plus isolated Chrome browser suites.

Coverage includes signed/expiring requests; server-only prices; exact amounts/currency/quantity; required checkout settings; duplicate clicks; persisted idempotent sessions; paid-state verification; signed/replayed/invalid webhooks; wrong mode/amount/address/email; disk failures; protected order pages; private file permissions; independent email retries; HTML escaping; live/test data separation; process-lock crash recovery; corrupt-record isolation; atomic releases; compression negotiation; and interactive preview fail-closed behavior.

Embedded-specific checks passed:
- Product HTML can be generated without creating a Stripe session. The revised checkout now waits to reveal the photo and form together; it does not show the photo first.
- Anonymous homepage is pre-rendered, compressible, conditionally cached, and contains no buyer token, cookie, secret, or publishable key.
- Checkout/session/order responses are no-store.
- Hosted and embedded session idempotency are separate.
- Thirty simultaneous independent requests behind one IP received thirty different sessions.
- Repeated retries reused one session and did not consume the new-session budget.
- The Stripe concurrency gate bounds in-flight work, queue depth, and waiting time.
- Two tabs in one browser retain their own path-scoped order grants. Another browser gets 403.
- SDK initialization timeout offers retry; a late obsolete initialization is destroyed instead of mounting.
- Repeated failed SDK loads leave no stale script nodes.
- No-JavaScript fallback retains the product photo and leads to hosted Stripe checkout.

Desktop, 390 px mobile, and 320 px mobile storefront checks found no horizontal overflow, page errors, or automated axe WCAG A/AA violations. This is not a full accessibility certification. Multi-image gallery behavior passed. Actual storefront/checkout screenshots were inspected.

## Performance: measured, bounded, reproducible

Same synthetic mobile profile: 390 px / DPR 2, 150 ms latency, 200,000 bytes/sec download, 4x CPU slowdown.

| Metric | Before AVIF | After AVIF |
|---|---:|---:|
| Main-content paint (LCP) | 2,560 ms | 1,312 ms |
| Loaded resource transfer | 676,094 bytes | 286,662 bytes |
| Layout shift (CLS) | 0 | 0 |

That sample reduced transferred data by about 58%. Timing varies between runs; these are emulated/local observations, not real-user field statistics. Final product images will have different compression characteristics.

Updated compact-checkout sandbox sample:
- Photo and embedded form revealed together in **1,653 ms**.
- No LittleRip/mascot header on checkout; the storefront branding remains.
- Email/contact entry is above the fold on desktop and 390 px mobile, at scroll position zero. Completing a long address/payment form can still require scrolling on a small display.
- No captured page/CSP errors.

Only first-party code sizes: storefront JS **1,903 bytes**, checkout JS **4,787 bytes**, CSS **5,198 bytes** before compression. Stripe's own SDK/iframe resources are additional and load only on checkout. No React hydration, AI, hosted database, or external fonts.

## Local traffic/concurrency test

`artifacts/load-report.json` records a bounded localhost run. Generator and test server share a Node process; this is NOT an internet/Cloudflare/Stripe benchmark.

- **1,000** mixed HTML/CSS/JS/mascot/AVIF requests.
- **40** concurrent request workers.
- **0** HTTP failures.
- p50 **5.2 ms**, p95 **11.7 ms**.
- Approximately 16.8 MB decoded response bodies consumed.
- **30 simultaneous checkout starts**, **30 unique sessions**, all successful; Stripe's network calls were mocked.
- Real sandbox checks separately verified three independent Stripe sessions, two browser contexts, and two tabs in one context.

Configured guards: 120 new checkouts/IP/minute; 600 globally/minute; 300 total checkout requests/IP/minute; 12 concurrent Stripe creations; 24 queued; maximum queue wait 8 seconds. These are ceilings/backpressure settings, not promised sustainable throughput. Correct tunnel client-IP handling and internet upload capacity still need public-environment validation.

## Lean runtime

`artifacts/runtime/` contains executable application code, compiled assets, Stripe SDK, and Nodemailer:
- Total **7,052,188 bytes**.
- Runtime dependencies **4,037,739 bytes**.
- All image variants/compiled assets **2,957,054 bytes**.
- Removed **13,995,444 bytes** of non-executable type declarations/source maps.
- No development dependencies, source artwork, credentials, customer orders, Node binary, or Python installation included.
- Runtime startup/render/shutdown passed.
- Mock Stripe SDK request and local-only Nodemailer rendering passed from the pruned runtime.

## Actual Stripe sandbox payments

Hosted checkout was tested earlier, including an actual decline, successful sandbox payment, and real signed webhook fulfillment with the landing request intentionally skipped.

The new embedded checkout was then tested against real Stripe:
- API accepted embedded-page mode, required name/billing/shipping data, and fixed amount.
- The storefront mascot remains centered. Checkout branding was removed, the photo sits alongside the form (or a compact mobile thumbnail), and image/form reveal together.
- Empty form could not pay.
- A successful test card completed payment and returned to a verified order page.
- Customer and owner confirmation previews shared the order reference.
- Opening a second tab did not invalidate the first order's confirmation.
- A separate browser could not read that order.
- Mobile iframe loaded without horizontal overflow.

No real money charged, real email sent, permanent webhook registered, or live-account setting changed. The separate automated test listeners/browsers and temporary data were cleaned up; sandbox transactions remain visible in Stripe. The interactive local test preview intentionally remains available until stopped.

## Dependency/source checks

- npm audit: **0 known vulnerabilities** at check time.
- Syntax checks, original-source fingerprint checks, and generated service-plist validation passed.
- An automatic recovery service and desktop shortcut were briefly installed, then unloaded/removed at the owner's request. No auto-start/recovery job or recovery button remains. Operation is assistant-directed on demand. Sleep/network/router settings were not changed.
- Original local site preserved; separate local Git history and secret-free portable copies prepared.

## Production staging and local HTTP warning

A separate private `.env.live` is staged with live mode selected but purchases and activation explicitly disabled. Permanent live keys, the live webhook, and a real mail sender remain missing. `npm run live:check` reports those blockers without sending payments or changing configuration. An authenticated Stripe CLI live login is not treated as a permanent production credential.

The HTTP localhost parent page can trigger Chrome's saved-card autofill warning despite Stripe's encrypted iframe. Valid HTTPS must be configured before public live use; browser security protections were not disabled. The test badge remains accurate until actual live activation.

## Still required before public launch

Approved products/images/prices, real policies/inventory/tax decisions, permanent matched live Stripe keys, live webhook, public HTTPS/tunnel setup, actual SMTP authentication and inbox-delivery tests, Stripe receipt/notification settings, backups/restore testing, log monitoring/rotation, power/sleep behavior, real-browser HTTPS/SCA/wallet tests, and explicit DNS cutover approval.

SMTP is at-least-once: a rare crash after remote acceptance but before local persistence can duplicate an email. SMTP acceptance is not inbox delivery. Extended outages require reconciliation; retries are finite. This build confirms orders but does not claim packages have shipped or fabricate tracking.
