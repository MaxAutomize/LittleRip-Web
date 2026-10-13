# Future launch — explicit approval required

This is a checklist, not a record of deployment. Nothing here has been applied to DNS or live accounts.

## Production profile

Use the secret-free `.env.live.example` template and the private `.env.live` on the target Mac. The staged profile deliberately keeps `CHECKOUT_ENABLED=false` and `LIVE_APPROVED=false`. Run `npm run live:check`; do not call missing credentials/email/HTTPS ready just because the code supports live Stripe. Only an explicit launch instruction authorizes enabling purchases and later moving DNS. Never hide Stripe's test badge to imitate a live checkout.

## Before taking orders

1. Replace placeholder images, names, descriptions, prices, and shipping timing. Confirm whether the five cards are distinct products or should become a single product with a gallery.
2. Define the real US shipping price, delivery expectations, returns/cancellations policy, support contact, inventory handling, and legal business information.
3. Resolve sales-tax obligations. This minimal release does **not** calculate tax or charge a separate tax amount. Do not assume it is correct for your business without review.
4. Choose and verify the outgoing email account. SMTP ports 465 (TLS) or 587 (mandatory STARTTLS) are supported. Use secure native secret entry when configuring credentials. Approve a test recipient, then verify actual delivery in both inboxes, including spam folders. No real sending tests have been done.
5. In Stripe, enable customer successful-payment receipts and merchant notifications as appropriate. Verify business details and receipt branding. Custom order emails are separate.
6. Obtain the correct matching production Stripe secret and publishable keys securely. Do not reuse the short-lived Stripe CLI test key.
7. Set up a **dedicated** Cloudflare Tunnel for this store. Do not repurpose existing Ollama/Pi tunnels, and do not open router ports. Keep the server bound to 127.0.0.1.
8. Use a temporary hostname first, e.g. preview.littlerip.com, in TEST mode. This creates a public preview only after explicit approval; it does not replace littlerip.com.
9. Create the matching Stripe webhook endpoint for `https://YOUR_HOST/webhooks/stripe`, subscribed to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Store that endpoint's signing secret securely. CLI listener secrets are temporary and NOT production endpoint secrets.
10. Confirm public HTTPS and browser saved-card autofill behavior. HTTP localhost warnings are expected during testing; do not disable browser security. Test a paid card, a decline, cancellation, duplicate webhooks, lost browser return, multiple independent browsers/tabs, restart, and SMTP outage/recovery. Check the embedded form on real HTTPS, mobile browsers, 3D Secure, and any desired wallets; wallet domain registration may be required. Re-run `npm run check` and the dependency audit close to launch.

## Example tunnel file (fill with actual identifiers later)

```yaml
tunnel: NEW_STORE_TUNNEL_UUID
credentials-file: /PRIVATE/PATH/NEW_STORE_TUNNEL_UUID.json
ingress:
  - hostname: preview.littlerip.com
    service: http://127.0.0.1:4317
    originRequest:
      httpHostHeader: preview.littlerip.com
  - service: http_status:404
```

Set `PUBLIC_ORIGIN=https://preview.littlerip.com` to match. The production hostname will replace this only at approved cutover. Set `TRUST_CLOUDFLARE=true` only with this dedicated local tunnel path; forwarded IP headers are otherwise ignored. The anonymous storefront may be conditionally cached/revalidated; it contains no user tokens or cookies. `/assets/*` is immutable cacheable content. Never cache `/buy/*`, `/order*`, `/checkout*`, health, or webhook responses. Do not place a Cloudflare Access login or bot challenge in front of Stripe's webhook path.

## On-demand operation — no automatic recovery service

The owner prefers to tell the assistant when the site is down. Do not install auto-start/login items, watchdogs, automatic recovery services, or desktop recovery buttons without a new explicit request. See [ON_DEMAND_RECOVERY.md](ON_DEMAND_RECOVERY.md).

The website server and, once configured, its dedicated tunnel must still be running normally to serve visitors. Closing a browser window is different from stopping those processes. The assistant can inspect/start the correct processes on request and verify recovery.

macOS sleep, lid closure, loss of power/network, or a failed tunnel can take self-hosting offline. A sleeping or powered-off Mac needs to be awake and reachable before the assistant can act. Power/sleep settings were not changed. Keep encrypted backups and review operational requirements before public hosting.

## Approved final cutover

1. Inspect the live Vercel deployment and DNS; preserve the current root/www targets and exact rollback instructions. Authentication may need to be renewed.
2. Check the final self-hosted build, domain HTTPS, SMTP delivery, data backup, and real webhook endpoint.
3. Use `PAYMENT_MODE=live`, a new `DATA_DIR=./var/live`, real credentials, approved catalogue/policies, and `LIVE_APPROVED=true`. Keep checkout disabled until the coordinated launch.
4. Point littlerip.com (and reviewed www behavior) at the new dedicated tunnel only after explicit user approval. Update the configured public origin and webhook URL consistently.
5. Verify the public storefront and checkout creation. A real charge is a separate explicit approval, not part of automated deployment.
6. Keep Vercel intact for rollback. Keep processing pending sessions/webhooks from the old site until settled.
7. Do not cancel or delete old services simply because the new storefront loads.

## Rollback / later hardware migration

Disable NEW checkout on the affected store without stopping processing of previously paid orders. Keep the live mode, live data directory, real webhook receiver, and SMTP worker available to reconcile in-flight payments. Restore the known-good DNS target if needed.

To migrate Macs, stop the old writer, copy the complete data/environment securely, verify permissions and payment mode, build and start on the new computer, then switch the dedicated tunnel. Do not run two machines from independently diverging copies of the order queue. Domain registration remains at Cloudflare unless you separately choose to transfer it.

## Costs and limitations

No paid hosting plan is required by this code. Domain renewal, payment processing fees, electricity, internet, and any optional email-provider charges still apply. Free services have terms and limits. A personal Mac is not equivalent to a redundant managed hosting platform.
