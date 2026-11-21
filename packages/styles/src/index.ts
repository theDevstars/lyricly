import type { LyricState, LyricStyle, StyleMeta } from '@verseglow/engine';

export const STYLE_CATALOG: StyleMeta[] = [
  { id: 'constellation', name: 'Constellation', group: 'Motion scenes', description: 'Every word becomes a small star in a drifting night sky.', gradient: ['#1f285a', '#b5a4ff'], supports: { colors: true, fonts: true, effects: ['parallax', 'drift'] } },
  { id: 'messages', name: 'Messages', group: 'Native design', description: 'A lyric thread, one phrase at a time.', gradient: ['#102d4c', '#2684ff'], supports: { colors: false, fonts: true, effects: ['phrase'] } },
  { id: 'fisheye', name: 'Fisheye', group: 'Kinetic type', description: 'Three words glide through a soft typographic lens.', gradient: ['#54174b', '#ff9a63'], supports: { colors: true, fonts: true, effects: ['lens'] } },
  { id: 'karaoke-sweep', name: 'Karaoke Sweep', group: 'Kinetic type', description: 'A clean, precise highlight follows each word.', gradient: ['#142a43', '#42dfc0'], supports: { colors: true, fonts: true, effects: ['word-fill'] } },
];

export class ConstellationStyle implements LyricStyle {
  readonly meta = STYLE_CATALOG[0];
  private container?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  private frame = 0;
  private state?: LyricState;
  private resizeObserver?: ResizeObserver;

  mount(container: HTMLElement): void {
    this.dispose();
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'constellation-canvas';
    container.append(this.canvas);
    this.context = this.canvas.getContext('2d') ?? undefined;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();
  }

  update(state: LyricState): void { this.state = state; }

  resize(): void {
    if (!this.canvas || !this.container || !this.context) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, rect.width * dpr);
    this.canvas.height = Math.max(1, rect.height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.canvas?.remove();
    this.canvas = undefined;
    this.context = undefined;
    this.container = undefined;
    this.state = undefined;
  }

  private loop = (): void => {
    this.draw();
    this.frame = requestAnimationFrame(this.loop);
  };

  private draw(): void {
    const ctx = this.context;
    const canvas = this.canvas;
    const state = this.state;
    if (!ctx || !canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    if (!state || state.activeLineIndex < 0) return;
    const line = state.lines[state.activeLineIndex];
    const words = line.words;
    const seed = state.activeLineIndex + 103;
    const points = words.map((word, index) => {
      const hash = Math.sin(seed * 127.1 + index * 311.7) * 43_758.5453;
      const x = width * (0.16 + ((hash - Math.floor(hash)) * 0.68));
      const yHash = Math.sin(seed * 269.5 + index * 183.3) * 12_345.678;
      const y = height * (0.3 + ((yHash - Math.floor(yHash)) * 0.4));
      return { word, x, y };
    });
    ctx.strokeStyle = 'rgba(245,235,210,.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
    ctx.stroke();
    points.forEach(({ word, x, y }, index) => {
      const active = index === state.activeWordIndex;
      ctx.fillStyle = active ? '#fff0c4' : 'rgba(245,235,210,.62)';
      ctx.font = active ? '700 clamp(32px, 6vw, 72px) Inter, sans-serif' : '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = active ? 'rgba(255,222,153,.75)' : 'transparent';
      ctx.shadowBlur = active ? 22 : 0;
      const label = word.text;
      const safeX = Math.max(ctx.measureText(label).width / 2 + 8, Math.min(width - ctx.measureText(label).width / 2 - 8, x));
      ctx.fillText(label, safeX, y);
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(safeX, y - 15);
      ctx.lineTo(safeX + 4, y - 11);
      ctx.lineTo(safeX, y - 7);
      ctx.lineTo(safeX - 4, y - 11);
      ctx.closePath();
      ctx.fill();
    });
  }
}

export const STYLE_REGISTRY = new Map<string, () => LyricStyle>([
  ['constellation', () => new ConstellationStyle()],
]);
