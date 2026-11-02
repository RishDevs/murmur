const SKY_STOPS = [
  { y: 0, color: [20, 24, 38] },
  { y: 626.4, color: [52, 48, 58] },
  { y: 1080, color: [201, 113, 74] },
];
const PAPER = [233, 220, 203];
const INK = [14, 15, 20];

function linearChannel(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
  const [red, green, blue] = color.map(linearChannel);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function skyColorAt(y) {
  // The ridge is dark; its upper edge is approximately at y=1000.
  if (y >= 1000) return [23, 25, 35];
  const height = Math.max(0, Math.min(1080, y));
  const upper = height <= SKY_STOPS[1].y ? SKY_STOPS[0] : SKY_STOPS[1];
  const lower = height <= SKY_STOPS[1].y ? SKY_STOPS[1] : SKY_STOPS[2];
  const fraction = (height - upper.y) / (lower.y - upper.y);
  return upper.color.map((channel, index) => channel + (lower.color[index] - channel) * fraction);
}

export function birdAppearance(y) {
  const sky = skyColorAt(y);
  const paperOnSky = PAPER.map((channel, index) => channel * 0.85 + sky[index] * 0.15);
  const skyLuminance = luminance(sky);
  const paperContrast = contrast(luminance(paperOnSky), skyLuminance);
  const inkContrast = contrast(luminance(INK), skyLuminance);
  return paperContrast >= inkContrast
    ? { color: '#E9DCCB', opacity: 0.85 }
    : { color: '#0E0F14', opacity: 1 };
}
