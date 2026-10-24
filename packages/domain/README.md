# Domain package

Framework-independent pregnancy dating, permissions, content-status, and synchronization rules live here. No React Native, Expo, Supabase client, UI, or implicit current-clock access is allowed in domain functions.

`derivePregnancyDating` accepts the clock and IANA timezone at its boundary. It treats `YYYY-MM-DD` values as calendar dates, derives an initial EDD as LMP + 280 calendar days, lets a clinician date override that estimate, and freezes gestational age at `endedAt` for ended pregnancies. It intentionally permits negative weeks and weeks beyond 40 so callers can explain edited/future dates and post-EDD dates without silently clipping source facts.
