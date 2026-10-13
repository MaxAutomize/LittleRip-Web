# LittleRip Web project context

For self-hosting, local storefront, checkout-readiness, or outage/recovery tasks, read [docs/self-hosting/README.md](docs/self-hosting/README.md) and its linked runbooks first.

The optimized self-hosted application is a separate local workspace at `~/littlerip-metal`; these documents do not replace the Next.js app in this repository's root or publish the Metal application source.

Owner preference: on-demand assistance only. Do not install automatic startup/recovery services, watchdogs, notifications, or desktop recovery buttons without a new explicit request. Preserve credentials, order data, and the current hosting target. Verify real health rather than assuming a command succeeded.

`main` is connected to automatic Vercel deployment. Avoid mixing unrelated local application edits into documentation changes or deploying an older source snapshot inadvertently. Live payments and DNS cutover require explicit approval and completed production setup.
