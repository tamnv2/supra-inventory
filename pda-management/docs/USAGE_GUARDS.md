# D164 Usage Guards

- No heartbeat.
- No Android background polling.
- No Firestore/RTDB for MVP.
- One lightweight config/version read on login/foreground, locally throttled.
- Full list only when authoritative revision changes.
- Borrow/return/status = one idempotent mutation each.
- Sheet mirroring stays off the operator critical response path.
- Registry reads are bounded and on-demand/revision-driven.
- Retry uses exponential backoff with a hard attempt ceiling.
- Any new cron/listener/poll/write cadence requires explicit usage-impact review.
