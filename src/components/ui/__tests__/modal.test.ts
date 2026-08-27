import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const file = readFileSync(join(__dirname, '..', 'Modal.tsx'), 'utf-8');

// Regression guards for the modal auto-close / dimmed-dialog bug.
// Root cause history: `.overlay` carries z-50 while the dialog card was only
// `relative` (z-auto), so the backdrop painted ABOVE the modal — dimming it
// and intercepting every click, which triggered overlay onClose.
describe('Modal stacking contract', () => {
  it('dialog card must declare a z-index above/level with the overlay', () => {
    expect(file).toMatch(/modal-card relative z-50/);
  });

  it('overlay must be a sibling rendered before the dialog card', () => {
    const overlayIdx = file.indexOf('overlay absolute');
    const cardIdx = file.indexOf('modal-card relative');
    expect(overlayIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(overlayIdx);
  });

  it('backdrop click closes only when dismissable', () => {
    expect(file).toMatch(/onClick=\{dismissable \? onClose : undefined\}/);
  });

  it('escape key closes only when dismissable', () => {
    expect(file).toMatch(/e\.key === 'Escape' && dismissable/);
  });
});