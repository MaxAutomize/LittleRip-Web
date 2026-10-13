# LittleRip Metal — self-hosting handoff

Recorded **2026-10-13 UTC**. Read this first for a fresh session or an outage report.

## Two different workspaces

| Workspace | Purpose |
|---|---|
| This repository's root | Existing Next.js/Vercel web application. Do not replace its runtime or push unrelated local edits as part of documentation work. |
| `~/littlerip-metal` on the owner's Mac | Separate, optimized self-hosted storefront, with private local Stripe test preview at `http://localhost:4317`. |

**This documentation-only change does not upload the self-hosted application source, credentials, personal images/artwork, customer data, logs, or local archives.** Commands in these documents refer to the separate `~/littlerip-metal` workspace, not this repository's root. These notes are context, not a complete disaster-recovery backup of that workspace.

At the time of this handoff, no public DNS cutover had been performed. Always inspect the actual current hosting target before acting; do not infer a migration from the existence of these documents.

## Owner's instructions

- Storefront: centered LittleRip name and supplied robot mascot, product images, and prices. No slogans, decorative marketing text, descriptions, numbered steps, or extra footer clutter on the storefront.
- Image/price click opens checkout. Checkout itself has **no LittleRip/robot header**. The photo sits alongside the form on wide screens or becomes a compact thumbnail on mobile. The first entry fields are visible without scrolling; the photo and form reveal together rather than showing the photo first.
- Remove AI, account systems, and hosted database dependencies from the self-hosted copy. Keep the storefront, Stripe payments, and transactional confirmations.
- Buyer and owner should receive the same order reference. Say **order confirmed**, not **shipped/on its way**, until shipment actually happens.
- **Recovery is on demand:** the owner says “LittleRip is down,” and the assistant investigates/restarts the correct process. Do not install auto-start/login items, watchdogs, automatic restart services, notifications, or desktop recovery buttons without a new explicit request. A briefly installed recovery service/button was removed.
- The ordinary website server still has to be running to serve visitors. That is different from a separate recovery/monitoring service.
- Only an explicit launch instruction authorizes enabling real purchases and moving the domain. Do not hide a test badge to make sandbox payments look live.

## Where to find the details

- [Setup, architecture, product editing, storage, migration](SETUP.md)
- [On-demand recovery procedure](ON_DEMAND_RECOVERY.md)
- [Production launch/cutover checklist](LAUNCH.md)
- [Measured tests, performance, concurrency, and limitations](VALIDATION.md)
- [Hardware, domain ownership, ongoing costs, sleep/outage behavior](HOSTING_AND_HARDWARE.md)

## Fresh-session starting point

A useful request is:

> LittleRip Metal is down. Read the self-hosting handoff and on-demand recovery notes in LittleRip-Web, then inspect `~/littlerip-metal` and recover the correct site.

On the Mac, the primary recovery file is `~/littlerip-metal/docs/ON_DEMAND_RECOVERY.md`. No full chat transcript is needed if the assistant can access the actual project and these notes. Do not assume access to a sleeping, powered-off, or disconnected Mac.

## State and launch blockers

- Local test checkout, real Stripe sandbox payment/webhook tests, and local email previews have been exercised.
- The permanent production payment keys, live webhook, and real transactional-email sender still need configuration/verification.
- A private `.env.live` was staged with `PAYMENT_MODE=live`, **`CHECKOUT_ENABLED=false` and `LIVE_APPROVED=false`**. It is deliberately not published here. The public template is `.env.live.example` in the separate workspace.
- `npm run live:check` is a read-only local configuration check. It is not proof of Stripe account pairing, mail delivery, HTTPS, or a successful real payment.
- The original five images and $10 prices are placeholders. Products, shipping/returns terms, inventory approach, and tax treatment must be reviewed before live orders.
- HTTP localhost can disable Chrome's saved-card autofill even when Stripe's iframe uses HTTPS. Use sandbox cards locally; configure valid HTTPS before live use. Never disable browser security protections.

## Local artifacts and source provenance

The editable workspace has its own local Git history, most recently `e9bd813` at this handoff. That local commit is **not** an application-source commit in this GitHub repository.

- Source workspace: `~/littlerip-metal`
- Lean runtime directory: `~/littlerip-metal/artifacts/runtime`
- Source archive: `~/Downloads/LittleRip-Metal-Starter-20261013-033828.tar.gz`
- Runtime archive: `~/Downloads/LittleRip-Metal-Runtime-20261013.tar.gz`
- Test/report artifacts: the local workspace's `artifacts/` directory

Artifact contents and process IDs change with revisions. Verify dates/hashes and rebuild packages when needed; never treat these notes as live health telemetry. Move the complete private data directory and environment securely when changing computers—source-only archives omit those intentionally.

## Git/deployment caution

This repository's `main` branch auto-deploys through Vercel. The Mac's existing `~/littlerip` checkout had unrelated uncommitted application changes, so these documents were prepared in an isolated checkout on **`docs/littlerip-metal-operations-20261013`**, not by pushing that dirty working tree.

Before merging documentation into a deployment-connected branch, verify that its application source matches the intended production state. Do not accidentally redeploy an older application merely to publish notes. No automatic merge, DNS change, or production deployment is authorized by this handoff.
