export interface Body {
  text: string;
  wordIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  spin: number;
  grounded: boolean;
  /** Set once the body has been thrown off screen. */
  gone: boolean;
}

const GRAVITY = 0.0022; // px per ms^2
const BOUNCE = 0.24;
const FRICTION = 0.86;

/** Small deterministic PRNG so a line always falls the same way. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

export const seedFrom = (text: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Creates one falling body per word, stacked above the floor. */
export function spawnBodies(
  texts: string[],
  widths: number[],
  height: number,
  width: number,
  seed: number,
): Body[] {
  const random = seeded(seed);
  return texts.map((text, wordIndex) => ({
    text,
    wordIndex,
    x: 40 + random() * Math.max(40, width - 160),
    y: -60 - wordIndex * (height / Math.max(2, texts.length)),
    vx: (random() - 0.5) * 0.02,
    vy: 0,
    width: widths[wordIndex] ?? 80,
    height: 46,
    rotation: (random() - 0.5) * 0.4,
    spin: (random() - 0.5) * 0.0006,
    grounded: false,
    gone: false,
  }));
}

/** One solver step. Bodies settle on the floor and on each other's tops. */
export function stepBodies(bodies: Body[], dtMs: number, floor: number, width: number): void {
  const dt = Math.min(48, Math.max(4, dtMs));

  for (const body of bodies) {
    if (body.gone) continue;
    if (!body.grounded) {
      body.vy += GRAVITY * dt;
      body.y += body.vy * dt;
      body.x += body.vx * dt;
      body.rotation += body.spin * dt;

      if (body.y + body.height >= floor) {
        body.y = floor - body.height;
        if (Math.abs(body.vy) < 0.35) {
          body.vy = 0;
          body.grounded = true;
          body.rotation *= 0.4;
        } else {
          body.vy = -body.vy * BOUNCE;
          body.vx *= FRICTION;
        }
      }
      if (body.x < 8) {
        body.x = 8;
        body.vx = Math.abs(body.vx) * 0.4;
      }
      if (body.x + body.width > width - 8) {
        body.x = width - 8 - body.width;
        body.vx = -Math.abs(body.vx) * 0.4;
      }
    }
  }

  // A cheap pile: a body rests on the nearest settled body underneath it.
  for (const body of bodies) {
    if (body.gone || body.grounded) continue;
    for (const other of bodies) {
      if (other === body || other.gone || !other.grounded) continue;
      const overlapX = body.x + body.width > other.x && body.x < other.x + other.width;
      const above = body.y + body.height >= other.y && body.y < other.y;
      if (overlapX && above && body.vy >= 0) {
        body.y = other.y - body.height;
        body.vy = 0;
        body.grounded = true;
        break;
      }
    }
  }
}

/** Throws every settled body off the screen; used when the next line starts. */
export function scatter(bodies: Body[], seed: number): void {
  const random = seeded(seed ^ 0x9e3779b9);
  for (const body of bodies) {
    body.grounded = false;
    body.vy = -(0.6 + random() * 0.9);
    body.vx = (random() - 0.5) * 1.6;
    body.spin = (random() - 0.5) * 0.004;
  }
}

/** True once every body has flown away. */
export const allGone = (bodies: Body[]): boolean =>
  bodies.every((body) => body.gone || body.y < -400);
