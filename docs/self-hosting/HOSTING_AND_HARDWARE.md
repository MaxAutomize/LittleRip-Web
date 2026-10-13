# Hosting, hardware, domains, and outages

## What runs where

The self-hosted option serves LittleRip's storefront on a Mac or Linux computer. A dedicated Cloudflare Tunnel can provide the public HTTPS route without opening router ports. Stripe still processes payments on Stripe's infrastructure. An outgoing mail account/provider handles delivery of transactional messages.

There is no hosted database server, AI backend, Vercel runtime, or required hosting subscription in the separate Metal implementation. Small private files hold checkout snapshots, paid orders, and retryable notification state.

This is a design prepared for a future cutover, not a statement that the public domain already points to the Mac.

## Hardware

The owner's existing Mac (8 GB RAM, 6 CPU cores) was sufficient for the bounded local tests. One observed idle Node-server reading was about 44 MB RAM; this is **not** the total Mac memory usage or a peak-load guarantee.

A reasonable small dedicated setup is an Apple-silicon Mac with 8 GB RAM, or a Linux mini-PC with roughly 2–4 CPU cores, 4 GB RAM, and an SSD. These are practical recommendations, not formally certified minimums. No powerful GPU is needed.

The current lean runtime is approximately 7.1 MB, excluding the installed Node.js/Python runtimes, private order data, logs, and backups. Development files/build dependencies are larger and need not be deployed. The code requires Node.js 24+ and Python 3 on macOS/Linux; other platforms need an appropriate process-lock/service adaptation.

Reliable electricity, internet/upload capacity, Ethernet where practical, backups, and remaining awake matter more than buying a larger computer at the tested scale. Actual public traffic must be measured before making capacity claims.

## Costs that remain

Self-hosting removes the need for a paid website-hosting plan, but not all costs:

- Domain registration renewals.
- Stripe transaction fees.
- Electricity and internet access.
- Any optional paid email, monitoring, backup, or other provider services.

Cloudflare Tunnel has a free option. Existing SMTP accounts may avoid an additional email subscription, but provider terms, sending limits, sender authentication, and deliverability still apply. Cloudflare Email Routing alone is not an outgoing SMTP service.

## Domain control

Domain registration and website hosting are separate. A domain registered through Cloudflare can point to Vercel, this Mac, or a replacement server. Moving the website to another computer does not require changing its domain name.

Registration gives the registrant control for the paid term, subject to registration rules; it is not perpetual ownership without renewal. The owner reported purchasing about ten years of registration. The actual expiry date was not independently checked in this work; verify it and renew before expiry.

Cloudflare Registrar requires its authoritative DNS while the domain remains registered there. The registration can be transferred to another registrar, subject to applicable transfer locks such as 60-day restrictions. This is not a requirement to host the website on Cloudflare.

For `.com`, Verisign operates the registry. Cloudflare pays registry and applicable ICANN fees and advertises at-cost registration/renewal without a registrar markup. Verisign does not own the internet; its registry role covers the `.com` naming infrastructure.

References:
- [Cloudflare Registrar overview](https://developers.cloudflare.com/registrar/)
- [Cloudflare Registrar FAQ and transfer rules](https://developers.cloudflare.com/registrar/faq/)
- [Verisign registry role](https://www.verisign.com/what-we-do/verisign-registry/)

## Closing the browser, closing the lid, or losing power

- Closing a browser window does not stop an independently running website server.
- Closing a laptop lid can put the Mac to sleep. Sleep, shutdown, power loss, or internet loss makes the self-hosted origin unreachable. Cached pages/assets may still appear, but a new checkout cannot reliably start without its server.
- The assistant cannot repair a sleeping, powered-off, or disconnected Mac until it is awake and reachable. Logging in after a FileVault reboot may also be necessary.
- A Stripe checkout already loaded in a visitor's browser may still complete a payment while the Mac is offline. The payment remains recorded in Stripe. Do not ask a buyer to pay again merely because the local confirmation page failed.
- Durable order/email state survives ordinary restarts. Production webhook retries and, after longer outages, reconciliation help recover missed events. Retry windows are finite; no claim is made that all outages recover automatically.
- Disk failure is different from sleep: retain encrypted backups of the complete private data directory and configuration, not just application source.

The owner's preference is **assistant-directed recovery on request**, not an always-running watchdog, auto-start service, notification monitor, or recovery button. See [the recovery notes](ON_DEMAND_RECOVERY.md).
