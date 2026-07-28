import { describe, it, expect } from 'vitest';
import { isMobileWidth, MOBILE_MAX_WIDTH } from './useViewport';

describe('the mobile breakpoint', () => {
  it('treats the breakpoint width itself as mobile', () => {
    // The bug this replaced: DraggableWindow used <= 768 and MobileStatusBar
    // used < 768, so at exactly 768 a window force-maximized as a phone
    // while the status bar rendered as a desktop. Pinning the boundary is
    // the point of the whole module.
    expect(isMobileWidth(MOBILE_MAX_WIDTH)).toBe(true);
  });

  it('treats one pixel wider as desktop', () => {
    expect(isMobileWidth(MOBILE_MAX_WIDTH + 1)).toBe(false);
  });

  it('matches the CSS media query it has to agree with', () => {
    // pc-themes.css switches on `@media (max-width: 768px)`; if these two
    // ever diverge the JS and the stylesheet disagree about the same screen.
    expect(MOBILE_MAX_WIDTH).toBe(768);
  });

  it.each([320, 390, 428, 600, 768])('calls %ipx mobile', (w) => {
    expect(isMobileWidth(w)).toBe(true);
  });

  it.each([769, 1024, 1280, 1920])('calls %ipx desktop', (w) => {
    expect(isMobileWidth(w)).toBe(false);
  });
});
