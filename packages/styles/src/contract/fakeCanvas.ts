export interface Paint {
  text: string;
  x: number;
  y: number;
}

/**
 * A CanvasRenderingContext2D stand-in good enough to run every style: it records
 * drawn text and measures glyphs from the current font size. Nothing is drawn.
 */
export class FakeContext {
  font = '500 20px sans-serif';
  fillStyle: string | CanvasGradient = '#000';
  strokeStyle: string | CanvasGradient = '#000';
  lineWidth = 1;
  globalAlpha = 1;
  shadowColor = 'transparent';
  shadowBlur = 0;
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  filter = 'none';
  direction: CanvasDirection = 'ltr';
  canvas = { width: 1280, height: 720 };
  paint: Paint[] = [];
  calls = 0;

  private size(): number {
    const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
    return match ? Number(match[1]) : 20;
  }

  measureText(text: string): TextMetrics {
    const width = text.length * this.size() * 0.56;
    return { width } as TextMetrics;
  }

  fillText(text: string, x: number, y: number): void {
    this.calls += 1;
    this.paint.push({ text, x, y });
  }

  strokeText(text: string, x: number, y: number): void {
    this.fillText(text, x, y);
  }

  fillRect(): void {
    this.calls += 1;
  }

  strokeRect(): void {
    this.calls += 1;
  }

  clearRect(): void {
    this.calls += 1;
  }

  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  arc(): void {}
  arcTo(): void {}
  roundRect(): void {}
  ellipse(): void {}
  rect(): void {}
  quadraticCurveTo(): void {}
  bezierCurveTo(): void {}
  fill(): void {}
  stroke(): void {}
  clip(): void {}
  save(): void {}
  restore(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  setTransform(): void {}
  resetTransform(): void {}
  setLineDash(): void {}

  createLinearGradient(): CanvasGradient {
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }

  createRadialGradient(): CanvasGradient {
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
}

export const asContext = (fake: FakeContext): CanvasRenderingContext2D =>
  fake as unknown as CanvasRenderingContext2D;
