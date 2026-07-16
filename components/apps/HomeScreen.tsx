/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { DesktopItem } from '../../types';
import { Monitor } from 'lucide-react';
import { usePCThemeOptional } from '../../src/pc-themes/PCThemeContext';
import { PCDesktopIcon } from '../../src/pc-themes/components/PCDesktopIcon';

interface HomeScreenProps {
    items: (DesktopItem | null)[];
    onLaunch: (item: DesktopItem) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ items, onLaunch }) => {
    // PC theme system: when a Windows theme is active, desktop icons render
    // as era-correct classic icons (pixel SVGs / tiles). Launch behavior is
    // identical — only the visual wrapper changes. Default theme: untouched.
    const pcTheme = usePCThemeOptional();
    const themed = !!pcTheme && !pcTheme.isDefault;
    return (
        <div className="h-full w-full p-10 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-8 content-start justify-items-center overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth"
            style={{
                scrollBehavior: 'smooth',
                scrollPaddingTop: '20px',
            }}>
            {items.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center h-[50vh] text-center max-w-sm mx-auto select-none p-6 bg-zinc-950/40 backdrop-blur-md rounded-3xl border border-zinc-800/40 shadow-2xl self-center justify-self-center mt-12">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-4">
                        <Monitor className="text-indigo-400 w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-zinc-200 font-bold text-lg mb-2">Pristine Desktop</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        All applications are safely organized in the Floating Library. Click the layout editor in the top-right menu to place apps on the screen.
                    </p>
                </div>
            )}
            {items.map((item, index) => {
                if (!item) {
                    // Render an invisible placeholder to maintain grid gap
                    return <div key={`gap-${index}`} className="w-28 h-[7rem]" />;
                }
                if (themed) {
                    return (
                        <PCDesktopIcon
                            key={item.id}
                            item={item}
                            pack={pcTheme!.theme.iconPack}
                            onLaunch={onLaunch}
                        />
                    );
                }
                return (
                    <button
                        key={item.id}
                        onClick={() => onLaunch(item)}
                        className="flex flex-col items-center justify-start gap-3 p-2 w-32 rounded-2xl hover:bg-white/15 transition-all duration-300 group active:scale-95"
                        title={item.name}
                    >
                        {/* Enhanced 3D Effect with better depth */}
                        <div className={`relative w-24 h-24 ${item.bgColor || 'bg-zinc-700'} rounded-[28px] flex items-center justify-center shadow-[0_8px_16px_-4px_rgba(0,0,0,0.4),inset_0_1px_0.5px_rgba(255,255,255,0.2),inset_0_-1px_2px_rgba(0,0,0,0.15)] group-hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.5),inset_0_1px_0.5px_rgba(255,255,255,0.2),inset_0_-1px_2px_rgba(0,0,0,0.15)] group-hover:scale-110 transition-all duration-300 ease-out border-t border-white/15 overflow-hidden`}>
                             {/* Enhanced Glossy Overlay */}
                            <div className="absolute inset-0 bg-[radial-gradient(at_top_left,_rgba(255,255,255,0.2)_0%,_transparent_60%)] pointer-events-none" />

                            {/* Subtle background glow effect */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(at_center,_rgba(255,255,255,0.1)_0%,_transparent_70%)]" />

                            <item.icon className="w-12 h-12 text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] group-hover:drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] transition-all duration-300" />
                        </div>
                        <span className="text-sm text-white font-semibold text-center line-clamp-2 break-words w-full px-1 drop-shadow-lg [text-shadow:_0_1px_3px_rgb(0_0_0_/_50%)]">
                            {item.name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};