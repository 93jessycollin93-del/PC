import React from 'react';
import { Footer } from './Footer';
import { LocalAiIndexFinder } from './LocalAiIndexFinder';

interface BottomBarProps {
  apps: { id: string; name: string; appId?: string }[];
  onLaunchApp: (appId: string) => void;
}

/**
 * A single slim strip pinned to the very bottom of the screen that holds
 * the Credits trigger and the Index-01 Local AI trigger side by side, so
 * neither one floats on top of the chat composer above it. Both keep their
 * full expanded panels — those just pop open *upward* from this bar now.
 */
export const BottomBar: React.FC<BottomBarProps> = ({ apps, onLaunchApp }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[4000] h-8 bg-black/95 backdrop-blur-md border-t border-zinc-900 flex items-center justify-between px-2">
      <Footer />
      <LocalAiIndexFinder apps={apps} onLaunchApp={onLaunchApp} />
    </div>
  );
};
