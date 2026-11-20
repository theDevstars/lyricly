import { useEffect } from "react";
import { allStyles } from "../../data/styles";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export default function EasterEggs() {
  useEffect(() => {
    let position = 0;
    let cleanupConfetti: (() => void) | null = null;

    const isTyping = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return Boolean(
        element?.closest("input, textarea, select, [contenteditable='true']"),
      );
    };

    const confetti = () => {
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.motion === "reduced"
      ) return;
      cleanupConfetti?.();
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:120";
      document.body.appendChild(canvas);
      const context = canvas.getContext("2d");
      if (!context) {
        canvas.remove();
        return;
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const resize = () => {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      window.addEventListener("resize", resize);

      const colors = ["#ff5c8a", "#ffb38a", "#3fd6c8", "#8f7bff", "#ffffff"];
      const particles = Array.from({ length: 90 }, (_, index) => ({
        x: window.innerWidth * (0.2 + Math.random() * 0.6),
        y: window.innerHeight * 0.42 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 9,
        vy: -4 - Math.random() * 9,
        size: 3 + Math.random() * 6,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.2,
        color: colors[index % colors.length],
      }));

      let frame = 0;
      const started = performance.now();
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
        particles.forEach((particle) => {
          particle.vy += 0.18;
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.rotation += particle.spin;
          context.save();
          context.translate(particle.x, particle.y);
          context.rotate(particle.rotation);
          context.fillStyle = particle.color;
          context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.55);
          context.restore();
        });
        if (now - started > 3200) cleanup();
      };

      const cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        canvas.remove();
        cleanupConfetti = null;
      };
      cleanupConfetti = cleanup;
      frame = requestAnimationFrame(tick);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      if (/^[1-9]$/.test(event.key)) {
        const index = Math.min(allStyles.length - 1, Number(event.key) - 1);
        window.dispatchEvent(
          new CustomEvent("lyrica:cycle-style", { detail: { index, slug: allStyles[index]?.slug } }),
        );
      }

      const expected = KONAMI[position];
      if (event.key.toLowerCase() === expected.toLowerCase()) {
        position += 1;
        if (position === KONAMI.length) {
          position = 0;
          confetti();
        }
      } else {
        position = event.key === KONAMI[0] ? 1 : 0;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cleanupConfetti?.();
    };
  }, []);

  return null;
}
