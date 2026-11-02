# Tasks

| # | Task | Owner | Files | Acceptance | Limit | Status |
|---|---|---|---|---|---|---|
| T1 | Core round engine, normalization, moderation | Codex | src/*, test/* | `npm test` green; latest-once, migrate events, hide/clear/reset/pause, mod delete, rate limit | 60m | todo |
| T2 | Twitch device auth + EventSub WS + server/SSE/API | Codex | server/*, test/eventsub.test.js | fixture messages → round; reconnect + keepalive handled; token never sent to browser | 60m | todo |
| T3 | Overlay canvas: flocks, labels, migration, states | Codex | public/overlay.* | 3 voters legible at 1080p; migration visible; reduced motion | 90m | todo |
| T4 | Control view + labeled simulated mode | Codex | public/control.*, server demo flag | all controls work; SIMULATED stamped | 45m | todo |
| T5 | Review, integrate, push | Claude | any (small fixes) | tests + manual run + secret scan; pushed | 30m | todo |
| T6 | Twitch app registration + device login + 2 real chatters | Human | — | real chat moves birds | 20m | todo |
| T7 | One visual QA pass on screenshots | Antigravity (read-only) | — | P0/P1 list | 20m | todo |
| T8 | README, RUN_DEMO.md, script, capture checklist | Claude | docs | cold start works | 40m | todo |

## Safety acceptance tests (T1/T2/T4)
- [ ] Profanity, slurs, and leetspeak variants are rejected before render (moderation.test).
- [ ] HTML/script text renders inert. No innerHTML is used for chat text (grep check + overlay test string `<img onerror>`).
- [ ] Commands, links, @mentions, and >4-word messages are ignored.
- [ ] Only the latest answer per account counts. Rate limit holds at one change per 3 s.
- [ ] `message_delete` / `clear_user_messages` remove that vote, and `chat.clear` empties the round.
- [ ] Hide removes the answer and blocks it for the rest of the round. Clear, Reset, and Pause work instantly.
- [ ] The token is absent from SSE payloads, logs, and the repo (`git grep` scan).
- [ ] Simulated votes always show the SIMULATED stamp and are impossible without `npm run demo`.
- [ ] The overlay shows "Chat's opinion — not a fact."
