# Murmur

**Watch chat change its mind.**

Murmur turns a Twitch chat into a living flock. The streamer asks a question, and every viewer who answers in chat gets their own small flock of birds that roosts on their answer. Each viewer holds exactly **one** active opinion. When someone changes their answer, their birds lift off and fly across the sky to the other flock, and the leading answer visibly changes as the community changes its mind.

Free-text word clouds already exist. Murmur is about the *movement*: how opinion shifts while chat argues it out.

> Murmur shows the audience's opinion. It never says the most popular answer is true. The overlay says so on screen.

## 60-second quickstart

Requirements: **Node.js 25+** and a Twitch account. There are no npm dependencies and no paid services.

```bash
git clone https://github.com/RishDevs/murmur.git
cd murmur
npm test          # unit tests, no network needed
npm run demo      # SIMULATED voters (clearly stamped), no Twitch account needed
```

Open http://localhost:4747/control and http://localhost:4747/overlay.

### Real Twitch chat
1. Turn on two-factor authentication on your Twitch account, which Twitch requires to register an app.
2. Register a free app at https://dev.twitch.tv/console with these settings:
   - Redirect URL: `https://localhost` (unused)
   - Category: Broadcaster Suite
   - **Client Type: Public**
3. `cp .env.example .env` and paste your Client ID into `MURMUR_TWITCH_CLIENT_ID`.
4. `npm start`, open http://localhost:4747/control, and click **Connect Twitch**. Enter the shown code at twitch.tv/activate. Murmur requests only `user:read:chat`.
5. Add http://localhost:4747/overlay to OBS as a 1920×1080 Browser Source. Ask a question, press **Start round**, and have viewers type short answers in your chat.

## How it works

```
Twitch EventSub WebSocket ─▶ server/eventsub.js ─▶ src/round.js (pure state) ─▶ SSE ─▶ overlay + control
   channel.chat.message           reconnect,          latest answer per viewer,
   message_delete / clear         keepalive            migrations, moderation
```

- **One opinion per viewer.** The latest short answer from each Twitch account counts once per round. A change emits a `migrate` event, which the overlay animates.
- **Conservative grouping.** Case, punctuation, spacing and accents are folded, so `Sir Neighs!` matches `sir neighs`. There's no semantic AI merging, so merges never surprise anyone.
- **Zero dependencies.** It uses Node built-ins only (`http`, `WebSocket`, `fetch`, `node:test`).

## Safety and responsible design
- **Untrusted input.** Chat text is treated as untrusted. It is drawn only with canvas `fillText`/`textContent`, is never evaluated, and is never sent to an AI model.
- **What counts as an answer.** Answers are at most 4 words. Commands, links and @mentions are ignored. Each viewer can change their answer at most once every 3 s.
- **Automatic filter.** A local filter drops hate speech, slurs, harassment ("kys", "kill yourself"), hate codes and profanity before they render. It also catches leetspeak, repeated letters, masked spellings (`f*ck`, `sh**`), spaced letters (`f u c k`) and compounds, and guards against known false positives ("Scunthorpe", "Nigeria", "grape", "raccoon"). **It is not perfect.**
- **Twitch moderation.** Twitch moderation counts: a deleted message, a timeout or ban, or a chat clear removes the matching birds.
- **Streamer controls.** **Pause**, **Hide answer** (blocked for the rest of the round), **Clear votes** and **Reset** act immediately.
- **Privacy.**
  - The OAuth token stays on the server in a gitignored `.murmur/` folder. It is never sent to the browser or logged.
  - Votes live only in memory.
  - Viewer names appear only briefly during a migration.
- **Labelled simulation.** Simulated voters exist only under `npm run demo` and are stamped **SIMULATED** on screen.
- **Not manipulation-proof.** One vote per account does not stop someone using several accounts. Murmur does not claim to prevent every kind of manipulation.

## Built with Codex
OpenAI Codex (CLI, signed in with ChatGPT) wrote the core of Murmur in a single main thread:
- the round engine
- Twitch device login and EventSub client
- the flocking overlay
- the control view
- the tests

Claude Code wrote the spec and briefs, reviewed each diff in a real browser, and sent back fixes. See [AGENT_ACTIVITY.md](AGENT_ACTIVITY.md).

**Main Codex session ID:** `01a19b00-27ba-7903-8e54-ce79935c0edc`

## Project team / AI-assisted build
1. **Rishi Kolluru ([@RishDevs](https://github.com/RishDevs)):** owner. Idea selection, art direction, Twitch account, demo.
2. **OpenAI Codex:** primary implementation agent.
3. **Claude (Claude Code):** chief of staff and orchestrator. Spec, design brief, review, docs.
4. **Cursor:** planned as a scoped reviewer, but its CLI was blocked at the workspace-trust prompt, so it did not contribute code. We did not bypass the prompt.
5. **Antigravity:** one independent visual QA pass on screenshots (curved migration paths, leader swap timing, bird shape), which Codex then fixed.

The AI tools are credited for their actual roles. They are not GitHub collaborators or co-owners.

## License
MIT © 2026 Rishi Kolluru. No third-party assets are used.
