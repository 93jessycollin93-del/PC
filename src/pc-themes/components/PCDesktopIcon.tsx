import React from 'react';
import type { DesktopItem } from '../../../types';
import type { PCIconPack } from '../types';
import { PCAppIcon } from '../icons/PCIcon';

/**
 * PCDesktopIcon — the classic desktop icon used while a Windows theme is
 * active: era icon on top, white label with drop shadow underneath, and a
 * selection highlight on hover/focus (styled per family in pc-themes.css).
 *
 * HomeScreen swaps to this ONLY when a non-default theme is active; the
 * launch callback is passed straight through, so behavior is identical to
 * the original glossy tiles. Single-click launches (kept from the existing
 * shell for mobile friendliness — real Win95 double-click noted in README).
 */
export const PCDesktopIcon: React.FC<{
  item: DesktopItem;
  pack: PCIconPack;
  onLaunch: (item: DesktopItem) => void;
}> = ({ item, pack, onLaunch }) => (
  <button className="pc-desktop-icon" onClick={() => onLaunch(item)} title={item.name}>
    <PCAppIcon item={item} pack={pack} size={48} />
    <span className="pc-desktop-icon-label">{item.name}</span>
  </button>
);

export default PCDesktopIcon;
