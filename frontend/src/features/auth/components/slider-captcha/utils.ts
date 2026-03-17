import { BG_THEMES, HEIGHT, PI, PIECE_LENGTH, PIECE_RADIUS, PIECE_SIZE, WIDTH } from './constants';

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: () => number, min: number, max: number) {
  return Math.floor(min + rng() * (max - min));
}

export function drawPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  operation: 'fill' | 'clip'
) {
  context.beginPath();
  context.moveTo(x, y);
  context.arc(x + PIECE_LENGTH / 2, y - PIECE_RADIUS + 2, PIECE_RADIUS, 0.72 * PI, 2.26 * PI);
  context.lineTo(x + PIECE_LENGTH, y);
  context.arc(x + PIECE_LENGTH + PIECE_RADIUS - 2, y + PIECE_LENGTH / 2, PIECE_RADIUS, 1.21 * PI, 2.78 * PI);
  context.lineTo(x + PIECE_LENGTH, y + PIECE_LENGTH);
  context.lineTo(x, y + PIECE_LENGTH);
  context.arc(x + PIECE_RADIUS - 2, y + PIECE_LENGTH / 2, PIECE_RADIUS + 0.4, 2.76 * PI, 1.24 * PI, true);
  context.lineTo(x, y);
  context.lineWidth = 2;
  context.fillStyle = 'rgba(0, 0, 0, 0.25)';
  context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  context.stroke();
  context.globalCompositeOperation = 'destination-over';
  if (operation === 'fill') {
    context.fill();
  } else {
    context.clip();
  }
}

export function paintBackground(context: CanvasRenderingContext2D, seed: number) {
  const rng = mulberry32(seed + 9999);
  const theme = BG_THEMES[seed % BG_THEMES.length];
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, theme.colors[0]);
  gradient.addColorStop(0.5, theme.colors[1]);
  gradient.addColorStop(1, theme.colors[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  for (let index = 0; index < 18; index += 1) {
    context.beginPath();
    context.arc(rng() * WIDTH, rng() * HEIGHT, 8 + rng() * 50, 0, PI * 2);
    context.fillStyle = `rgba(255,255,255,${(0.02 + rng() * 0.06).toFixed(3)})`;
    context.fill();
  }

  for (let index = 0; index < 4; index += 1) {
    const baseX = rng() * WIDTH;
    const baseY = rng() * HEIGHT;
    const baseRadius = 20 + rng() * 60;
    const radialGradient = context.createRadialGradient(baseX, baseY, 0, baseX, baseY, baseRadius);
    radialGradient.addColorStop(0, `${theme.accent}18`);
    radialGradient.addColorStop(1, 'transparent');
    context.fillStyle = radialGradient;
    context.fillRect(baseX - baseRadius, baseY - baseRadius, baseRadius * 2, baseRadius * 2);
  }

  context.fillStyle = 'rgba(255,255,255,0.025)';
  for (let gridX = 0; gridX < WIDTH; gridX += 20) {
    for (let gridY = 0; gridY < HEIGHT; gridY += 20) {
      context.fillRect(gridX, gridY, 1, 1);
    }
  }
}

export function getPieceTarget(seed: number) {
  const rng = mulberry32(seed);
  return {
    x: randRange(rng, PIECE_SIZE + 10, WIDTH - PIECE_SIZE - 10),
    y: randRange(rng, PIECE_RADIUS * 2 + 10, HEIGHT - PIECE_SIZE - 10),
  };
}
