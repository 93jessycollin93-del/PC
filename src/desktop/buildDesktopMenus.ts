/**
 * buildDesktopMenus — the actual menu contents, as data.
 *
 * Kept apart from both the menu component (which only renders) and the
 * App shell (which only owns state), so "what's on the menu" is one list
 * you can read top to bottom and change without touching either.
 *
 * Entries mirror a desktop OS's right-click menu, minus the items that are
 * meaningless in a browser tab (drive properties, "Run as administrator",
 * real filesystem paths). Anything listed here does something real — no
 * placeholder rows that show a toast saying "coming soon".
 */
import {
  FolderPlus, FileText, ArrowUpDown, RefreshCw, ClipboardPaste, Scissors,
  Copy, Image, Monitor, Palette, Terminal, Trash2, Pencil, FolderInput,
  Info, Star, StarOff, ExternalLink, SortAsc, Shapes, CopyPlus,
  Maximize2, Minus, SendToBack, XSquare, Upload, Download,
} from 'lucide-react';
import { DesktopItem } from '../../types';
import { MenuEntry } from './ContextMenu';
import { SortKey } from './desktopOps';

/** Everything the desktop menu can do. The App shell supplies these; this
 *  module never reaches for state itself. */
export interface DesktopMenuActions {
  newFolder: () => void;
  newDocument: () => void;
  sortBy: (key: SortKey) => void;
  refresh: () => void;
  paste: () => void;
  /** Null when the clipboard is empty — drives the disabled state. */
  clipboardName: string | null;
  changeWallpaper: () => void;
  openDisplaySettings: () => void;
  openPersonalize: () => void;
  openTerminal: () => void;
  /** Bring an item in from an exported .pcapp.json file. */
  importItem: () => void;
}

export interface ItemMenuActions {
  open: (item: DesktopItem) => void;
  openInNewWindow: (item: DesktopItem) => void;
  rename: (item: DesktopItem) => void;
  cut: (item: DesktopItem) => void;
  copy: (item: DesktopItem) => void;
  duplicate: (item: DesktopItem) => void;
  moveToFolder: (item: DesktopItem) => void;
  toggleFeatured: (item: DesktopItem) => void;
  exportItem: (item: DesktopItem) => void;
  remove: (item: DesktopItem) => void;
  properties: (item: DesktopItem) => void;
  /** Folders that exist to move into; empty disables the entry. */
  folderCount: number;
}

export function buildDesktopMenu(a: DesktopMenuActions): MenuEntry[] {
  return [
    {
      id: 'new',
      label: 'New',
      icon: Shapes,
      submenu: [
        { id: 'new-folder', label: 'Folder', icon: FolderPlus, onSelect: a.newFolder },
        { id: 'new-doc', label: 'Text Document', icon: FileText, onSelect: a.newDocument },
      ],
    },
    {
      id: 'sort',
      label: 'Sort by',
      icon: ArrowUpDown,
      submenu: [
        { id: 'sort-name', label: 'Name', icon: SortAsc, onSelect: () => a.sortBy('name') },
        { id: 'sort-type', label: 'Type', icon: Shapes, onSelect: () => a.sortBy('type') },
      ],
    },
    { id: 'refresh', label: 'Refresh', icon: RefreshCw, shortcut: 'F5', onSelect: a.refresh },
    {
      id: 'paste',
      label: a.clipboardName ? `Paste "${a.clipboardName}"` : 'Paste',
      icon: ClipboardPaste,
      shortcut: 'Ctrl+V',
      disabled: !a.clipboardName,
      separatorBefore: true,
      onSelect: a.paste,
    },
    { id: 'import', label: 'Import item…', icon: Upload, onSelect: a.importItem },
    { id: 'wallpaper', label: 'Change wallpaper', icon: Image, separatorBefore: true, onSelect: a.changeWallpaper },
    { id: 'personalize', label: 'Personalize (themes)', icon: Palette, onSelect: a.openPersonalize },
    { id: 'display', label: 'Display settings', icon: Monitor, onSelect: a.openDisplaySettings },
    { id: 'terminal', label: 'Open Terminal', icon: Terminal, separatorBefore: true, onSelect: a.openTerminal },
  ];
}

/** Window management, from a taskbar button — the menu a real taskbar has. */
export interface WindowMenuActions {
  restore: () => void;
  minimize: () => void;
  sendToBack: () => void;
  close: () => void;
  minimized: boolean;
}

export function buildWindowMenu(a: WindowMenuActions): MenuEntry[] {
  return [
    a.minimized
      ? { id: 'restore', label: 'Restore', icon: Maximize2, onSelect: a.restore }
      : { id: 'bring-front', label: 'Bring to front', icon: Maximize2, onSelect: a.restore },
    { id: 'minimize', label: 'Minimize', icon: Minus, disabled: a.minimized, onSelect: a.minimize },
    { id: 'send-back', label: 'Send to back', icon: SendToBack, disabled: a.minimized, onSelect: a.sendToBack },
    { id: 'close-win', label: 'Close window', icon: XSquare, danger: true, separatorBefore: true, onSelect: a.close },
  ];
}

export function buildItemMenu(item: DesktopItem, a: ItemMenuActions): MenuEntry[] {
  const isFolder = item.type === 'folder';
  return [
    { id: 'open', label: isFolder ? 'Open folder' : 'Open', icon: ExternalLink, onSelect: () => a.open(item) },
    { id: 'open-new', label: 'Open in new window', icon: Monitor, onSelect: () => a.openInNewWindow(item) },
    { id: 'rename', label: 'Rename', icon: Pencil, shortcut: 'F2', separatorBefore: true, onSelect: () => a.rename(item) },
    { id: 'cut', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X', onSelect: () => a.cut(item) },
    { id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C', onSelect: () => a.copy(item) },
    { id: 'duplicate', label: 'Duplicate', icon: CopyPlus, onSelect: () => a.duplicate(item) },
    {
      id: 'move',
      label: 'Move to folder',
      icon: FolderInput,
      disabled: a.folderCount === 0,
      onSelect: () => a.moveToFolder(item),
    },
    {
      id: 'featured',
      label: item.featured ? 'Unpin from featured' : 'Pin as featured',
      icon: item.featured ? StarOff : Star,
      separatorBefore: true,
      onSelect: () => a.toggleFeatured(item),
    },
    { id: 'export', label: 'Export…', icon: Download, onSelect: () => a.exportItem(item) },
    { id: 'properties', label: 'Properties', icon: Info, onSelect: () => a.properties(item) },
    {
      id: 'delete',
      label: 'Remove from desktop',
      icon: Trash2,
      shortcut: 'Del',
      danger: true,
      separatorBefore: true,
      onSelect: () => a.remove(item),
    },
  ];
}
