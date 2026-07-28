/**
 * useViewport — the single answer to "are we on a phone right now".
 *
 * This existed twice before, computed independently in DraggableWindow and
 * MobileStatusBar, and the two disagreed: one used `<= 768`, the other
 * `< 768`. At exactly 768px wide a window force-maximized as mobile while
 * the status bar rendered as desktop. Two definitions of one rule is how
 * that happens, so there is now one.
 *
 * The threshold matches the `@media (max-width: 768px)` blocks in
 * pc-themes.css, which is the visual source of truth — 768 itself counts as
 * mobile, so the JS and the CSS switch on the same pixel.
 */
import { useEffect, useState } from 'react';

export const MOBILE_MAX_WIDTH = 768;

/** Pure predicate, split out so the rule can be tested without React. */
export function isMobileWidth(width: number): boolean {
  return width <= MOBILE_MAX_WIDTH;
}

export interface Viewport {
  width: number;
  height: number;
  isMobile: boolean;
  isLandscape: boolean;
}

function read(): Viewport {
  // Guard for any non-browser render path; the desktop default keeps a
  // server-side or test render from claiming to be a phone.
  const width = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const height = typeof window === 'undefined' ? 768 : window.innerHeight;
  return { width, height, isMobile: isMobileWidth(width), isLandscape: width > height };
}

/** Full viewport state, for callers that also care about orientation. */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read);

  useEffect(() => {
    const onResize = () => setViewport(read());
    window.addEventListener('resize', onResize);
    // Orientation changes on iOS report the old size if read too early.
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return viewport;
}

/** The common case: callers that only need the phone/desktop split. */
export function useIsMobile(): boolean {
  return useViewport().isMobile;
}
