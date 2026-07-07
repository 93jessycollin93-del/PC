/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { DesktopItem } from '../../types';
import { Monitor } from 'lucide-react';

interface HomeScreenProps {
    items: (DesktopItem | null)[];
    onLaunch: (item: DesktopItem) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ items, onLaunch }) => {
    return (
        <div className="h-full w-full p-8 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-6 content-start justify-items-center overflow-y-auto overscroll-y-contain">
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
                return (
                    <button
                        key={item.id}
                        onClick={() => onLaunch(item)}
                        className="flex flex-col items-center justify-start gap-3 p-2 w-28 rounded-xl hover:bg-white/10 transition-colors group"
                        title={item.name}
                    >
                        {/* Gentler 3D Effect: Reduced shadow opacity/spread, subtler inner shadows, lighter border */}
                        <div className={`relative w-20 h-20 ${item.bgColor || 'bg-zinc-700'} rounded-[22px] flex items-center justify-center shadow-[0_4px_8px_-4px_rgba(0,0,0,0.2),inset_0_1px_0.5px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.1)] group-hover:scale-105 transition-transform duration-300 ease-out border-t border-white/10 overflow-hidden`}>
                             {/* Gentler Glossy Overlay */}
                            <div className="absolute inset-0 bg-[radial-gradient(at_top_left,_rgba(255,255,255,0.15)_0%,_transparent_70%)] pointer-events-none" />
                            
                            <item.icon className="w-10 h-10 text-white relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
                        </div>
                        <span className="text-sm text-white font-medium text-center truncate w-full px-1 drop-shadow-md [text-shadow:_0_1px_2px_rgb(0_0_0_/_40%)]">
                            {item.name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};