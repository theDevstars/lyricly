import { describe, expect, it } from 'vitest';
import { STYLES, getStyle } from './registry';
import { STATES } from './contract/fakeState';
import { FakeContext, asContext } from './contract/fakeCanvas';
import { effectsFor, safeEffects, EFFECTS } from '../effects/registry';
import { postEffects, preEffects } from '../effects/apply';

describe('style contract', () => {
  it('has at least the 39 styles', () => {
    expect(STYLES.length).toBeGreaterThanOrEqual(39);
  });

  it('resolves unknown ids to the first style', () => {
    expect(getStyle('does-not-exist')).toBe(STYLES[0]);
  });

  for (const style of STYLES) {
    describe(style.id, () => {
      for (const variant of STATES) {
        it(`renders: ${variant.name}`, () => {
          const fake = new FakeContext();
          const ctx = asContext(fake);
          const state = {
            ...variant.state,
            palette: {
              ...variant.state.palette,
              accent: style.palette.accent,
            },
          };

          expect(() => style.render(ctx, state)).not.toThrow();

          // Everything painted must be finite and inside a generous frame, so a
          // broken layout cannot silently push words off the stage.
          const limit = Math.max(state.width, state.height) * 4;
          for (const paint of fake.paint) {
            expect(Number.isFinite(paint.x)).toBe(true);
            expect(Number.isFinite(paint.y)).toBe(true);
            expect(Math.abs(paint.x)).toBeLessThan(limit);
            expect(Math.abs(paint.y)).toBeLessThan(limit);
          }
        });
      }

      it('renders with every effect enabled', () => {
        const fake = new FakeContext();
        const ctx = asContext(fake);
        const state = STATES[4].state;
        const enabled: Record<string, string> = {};
        for (const effect of EFFECTS) enabled[effect.id] = 'on';

        const effects = safeEffects(effectsFor(style, enabled), state);
        expect(() => {
          preEffects(ctx, state, effects);
          style.render(ctx, state);
          postEffects(ctx, state, effects);
        }).not.toThrow();
      });

      it('has gallery metadata', () => {
        expect(style.id).toMatch(/^[a-z0-9-]+$/);
        expect(style.name.length).toBeGreaterThan(1);
        expect(style.description.length).toBeGreaterThan(10);
        expect(style.gradient).toHaveLength(2);
        expect(style.palette.accent).toMatch(/^#/);
        expect(['kinetic', 'scenes', 'native', 'lyrics']).toContain(style.group);
      });
    });
  }
});
