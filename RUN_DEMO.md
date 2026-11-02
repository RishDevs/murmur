# Running the Murmur demo

## Before recording (one time, about 10 minutes)
- [ ] `.env` has `MURMUR_TWITCH_CLIENT_ID`.
- [ ] Run `npm start`. The terminal prints the control URL.
- [ ] Open http://localhost:4747/control and click **Connect Twitch**. Go to twitch.tv/activate, enter the code, and approve. The status should show **LIVE**.
- [ ] Line up 2–3 viewers (friends, or your own second account on a phone) who are signed in to Twitch and have your channel's chat open: `twitch.tv/<your channel>/chat`. Your channel does not need to be live for chat to work.
- [ ] macOS: turn on Do Not Disturb, close private tabs, and make sure no `.env` or terminal with tokens is visible.

## Windows to capture
1. **Overlay:** http://localhost:4747/overlay, full screen at 1920×1080 (or as an OBS Browser Source). This is the hero shot.
2. **Control:** http://localhost:4747/control, used to show Start, Hide and Reset.
3. **Twitch chat:** shows the real messages arriving.
4. **Codex:** the terminal or Codex app showing the main session, plus `AGENT_ACTIVITY.md`.

## The hero run (rehearse twice)
| Step | Who | Action | Expected result |
|---|---|---|---|
| 1 | Streamer | Type "Name my horse?" and press **Start round** | The question appears, and a hint says to answer in chat |
| 2 | Viewer A | types `sir neighs` | A flock forms on SIR NEIGHS · 1 |
| 3 | Viewer B | types `Sir Neighs!` | The same flock grows to · 2 |
| 4 | Viewer C | types `biscuit` | A second flock, BISCUIT · 1 |
| 5 | Viewer A | types `biscuit` | **A's birds fly across** and "A changed their mind" appears. The lead flips to BISCUIT · 2, with SIR NEIGHS · 1 |
| 6 | Streamer | **Hide answer** on any answer | Its birds disappear at once |
| 7 | Streamer | **Reset** | Clean sky, ready to repeat |

## Recovery
- **The status shows RECONNECTING.** Wait 5 s. If it's still stuck, restart `npm start`. The round state resets, so press Start again.
- **No birds appear.** Check that the viewer's message is 4 words or fewer, isn't a command or link, and that the round isn't **Paused**.
- **A viewer's change is ignored.** The rate limit allows one change per 3 s. Wait and retype.
- **"Sign in again".** Click **Connect Twitch** again.
