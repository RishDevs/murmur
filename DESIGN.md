# Murmur — DESIGN

**Feel:** hushed, alive, decisive.

## Direction A — Dusk Field (building this)
- **Sky:** A vertical sky graded from deep ink `#141826` to dusk ember `#C9714A` at the horizon, with a thin dark ridge line at the bottom. The gradient is the scene itself, not decoration.
- **Birds:** Starlings drawn as dark ink silhouettes `#0E0F14`, 2-segment wings that flap. Each bird is a 7–10 px stroke.
- **Type:**
  - Answer labels: large serif small-caps in warm paper `#F3E9DC` (stack: "Iowan Old Style", "Palatino", Georgia, serif).
  - Counts: tabular numerals.
  - Question: italic serif, top-left.
- **Accent:** Exactly one, ember `#E8A15A`. It is used only for the leading answer's underline and for the migration trail.

## Direction B — Paper Atlas (alternative, not built)
Cream paper with graphite birds and red-pencil labels, like a field notebook. It's calmer, but less broadcast punch.

## Signature action: the migration
1. A viewer changes their answer. Their birds peel off the old flock as one ribbon and arc across the sky (~1.6 s, eased) to the new flock.
2. During the flight the trail is ember, and a small caption shows `name changed their mind`.
3. If the lead flips, the old leader's label dims and the new leader's label rises and grows, with a 600 ms crossfade.

Nothing else animates loudly.

## 1920×1080 composition
- The leader's flock and label sit in the center third. The label is 96–140 px tall.
- Up to 4 other flocks sit along the lower arc, with 44 px labels. Anything more goes to a quiet "+N more" line.
- Question top-left at 40 px. Status bottom-right: LIVE dot + "Chat's opinion — not a fact."
- Safe margins of 64 px.

## States
- **Idle:** The question waits, with a few drifting birds.
- **Open:** "Type your answer in chat".
- **Paused:** A label reading "Paused".
- **Empty:** A hint for the first answer.
- **Reconnecting:** Amber status.
- **SIMULATED:** A permanent red-ink stamp.

## Accessibility
- Paper-on-ink contrast is ≥ 7:1.
- Counts are shown as numbers, never by flock size alone.
- `prefers-reduced-motion` turns migrations into short crossfades.

## Forbidden
Purple-blue SaaS gradients, glassmorphism cards, pill badges, emoji confetti, neon glow, Inter-on-white dashboards, fake viewer counts, decorative particles that carry no data.
