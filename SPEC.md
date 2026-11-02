# Murmur — SPEC

**Thesis.** Free-text word clouds already exist (StreamAlive Wonder Words, Sound Alerts Trending Words). Murmur is *living consensus*: each viewer holds exactly one active opinion, drawn as their own small flock of birds. When a viewer changes their mind, their birds physically fly from one flock to another, and the leading answer visibly changes as the community changes its mind.

**Users.** Streamer (asks, controls, moderates). Viewers (type a short answer in normal Twitch chat; no extension, no command).

## 60-second demo
1. Streamer types "Name my horse?" in the control view and presses Start.
2. Viewer A types `sir neighs`. A flock appears and settles behind the label SIR NEIGHS · 1.
3. Viewer B types `Sir Neighs!`. Normalization merges it; the flock doubles and takes the lead.
4. Viewer C types `biscuit`. A second, smaller flock appears.
5. Viewer A types `biscuit`. A's birds lift off and stream across the sky ("A changed their mind"); the lead becomes a 2–1 for BISCUIT and the flocks swap places.
6. Streamer presses Reset and asks a new question.

## Must-haves (max 3)
1. **Real Twitch → round.** EventSub WebSocket `channel.chat.message` messages become answers. Each account's latest answer counts once per round.
2. **Flocks + migration.** Every voter = a fixed number of birds. Answers group by conservative normalization. Changing an answer triggers a visible migration, and the leader is restaged.
3. **Safe streamer control.** Start/Pause/Clear/Reset, Hide one answer, automatic content filter, honoring Twitch moderator deletions.

## Excluded
Voice, semantic/AI matching, accounts/DB, extension, leaderboards, history, paid services, fake votes.

## Data flow
Twitch EventSub WS → `server/eventsub.js` → `src/round.js` (pure state) → SSE `/events` → `public/overlay` (canvas) + `public/control`. Control → `POST /api/*`. Only the server ever holds the token.

## Auth and scopes
Device Code Grant Flow, public client, **no client secret** (VERIFIED: dev.twitch.tv getting-tokens-oauth). Scope `user:read:chat` only. The token goes in a gitignored `.murmur/token.json`, is refreshed, and is validated on start. The app reads chat in the signed-in user's own channel. Subscriptions: `channel.chat.message`, `channel.chat.message_delete`, `channel.chat.clear_user_messages`, `channel.chat.clear` (condition `broadcaster_user_id`, `user_id`; VERIFIED in the EventSub reference).

## Failure behavior
Keepalive timeout and `session_reconnect` are handled. Reconnect uses backoff, and the control view shows LIVE / RECONNECTING / OFFLINE. Round state survives reconnects. A 401 triggers one refresh, then a "sign in again" state.

## Safety (acceptance-tested)
- Chat text is untrusted. It is rendered only via canvas `fillText` and `textContent`, never HTML or eval, and is never passed to an agent.
- Input is capped at 80 chars. An answer is at most 4 words / 28 chars. Commands (`!`), links, and @mentions are ignored.
- A blocklist with leetspeak/repeat folding drops abusive answers before render. Moderation is not perfect.
- A mod delete or user clear removes that viewer's vote. A chat clear empties the round.
- Rate limit: one answer change per viewer per 3 s.
- Memory only. Names are shown transiently. Logs never print tokens or message text.
- The overlay always says "Chat's opinion — not a fact."
- Simulated input exists only with `npm run demo` and stamps SIMULATED on overlay and control.

## Claim-to-proof matrix
| Claim | Module | Action → result | Test | BUILT/VERIFIED/DEMOED |
|---|---|---|---|---|
| Latest answer once | src/round.js | 2 msgs same user → 1 vote | test/round.test.js | –/–/– |
| Migration | src/round.js + public/overlay.js | change answer → `migrate` event → birds travel | round test + manual | –/–/– |
| Normalization | src/normalize.js | `Sir Neighs!` ≡ `sir neighs` | test/normalize.test.js | –/–/– |
| Filter | src/moderation.js | slur/leet → rejected | test/moderation.test.js | –/–/– |
| Mod delete honored | src/round.js | delete event → vote removed | round test | –/–/– |
| Real Twitch | server/eventsub.js | real chat → flock | fixture test + live | BUILT/VERIFIED (02:07 ET)/– |

## Done
`npm test` passes. A cold start via README works. Two real accounts can complete the 60-second demo twice. Reset works without a restart.
