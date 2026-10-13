# On-demand recovery — owner preference

The owner wants to say “LittleRip is down” and have the assistant diagnose/restart it. **Do not install login items, LaunchAgents, watchdogs, automatic restart services, or desktop recovery buttons unless explicitly requested again.** The previously added recovery service and shortcut were removed.

The ordinary website server must run to serve visitors; that is not a separate monitoring or notification service. It is currently started manually as a detached preview process. There is no automatic startup/recovery job.

## Assistant procedure when asked

1. Determine which hosting target is actually in use and whether this Mac is awake/online. Do not assume a domain/DNS migration has happened.
2. For this local copy, inspect port 4317, `artifacts/preview.pid`, process command and working directory, and `/healthz`. Never kill an arbitrary Node process or anything merely matching a broad name.
3. If the server is healthy, do not restart it unnecessarily. Check browser/checkout errors, internet, credentials, and the dedicated tunnel if one has actually been configured.
4. If down, inspect the safe private log at `var/test/logs/preview.log` (or the approved live log location) and the saved configuration. Do not print secrets or change test/live mode to get around a failure.
5. Start the existing approved code: `npm run preview:checkout` for the local Stripe test preview, or the already-approved production start command when applicable. An assistant may launch the verified script detached with stdout/stderr in a private log and update `artifacts/preview.pid`. Do not install an auto-start service.
6. Verify the actual HTTP response and, when relevant, public reachability. A dispatched start command alone is not proof of recovery.
7. Preserve `.env`, the complete data directory, checkout snapshots, order records, and email state. Do not repeat a charge, reset data, change DNS, roll back prices/code, or repurpose another tunnel as a shortcut.
8. After extended downtime, inspect Stripe and the reconciliation report for missed paid orders. Ask/confirm before any broader operational change. Existing pending order emails resume through the normal application worker.

Closing the browser does not stop a detached server. Sleep, shutdown, lid closure, or internet loss can stop reachability. The assistant cannot restore a powered-off/asleep/disconnected Mac until it is awake and reachable. A payment already opened in Stripe may complete during an outage; verify its status rather than paying again.
