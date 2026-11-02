# Decisions

- **Name locked: Murmur** (founder, 2026-11-02). Repo `RishDevs/murmur`, private while building.
- **Concept: living consensus.** One active opinion per viewer, and birds migrate on change. This is our difference from existing word clouds. Chatwalk was rejected because of the Chat Jumper prior art.
- **Zero dependencies.** We use Node built-ins only (`http`, global `WebSocket`, `node:test`). No npm installs means no supply-chain risk and a simple setup for judges.
- **Auth: Twitch Device Code Flow, public client, scope `user:read:chat`.** There's no client secret to leak, and judges register their own free app.
- **The server owns state and the token.** The browser gets only sanitized round state over SSE.
- **Conservative normalization only** (case, punctuation, whitespace, diacritics). We do no semantic merging, so merges never surprise anyone.
- **Every short chat message is an answer.** Messages over 4 words, commands, links, and mentions are ignored. This keeps the viewer side friction-free.
- **Fixed birds per voter within a round,** so flock size stays honest.
- **Design: Direction A, Dusk Field.** Direction B, Paper Atlas, stays on file as an alternative.
- **License: MIT,** © 2026 Rishi Kolluru. No third-party assets.
