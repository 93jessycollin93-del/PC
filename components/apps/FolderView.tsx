/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import { DesktopItem } from '../../types';
import { FileText, ArrowDownAz, Calendar, Type } from 'lucide-react';

interface FolderViewProps {
    folder: DesktopItem;
}

export const FolderView: React.FC<FolderViewProps> = ({ folder }) => {
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'type'>('name');

    const sortedContents = useMemo(() => {
        if (!folder.contents) return [];
        return [...folder.contents].sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'type') {
                const typeA = a.type === 'folder' ? 'folder' : (a.appId || 'app');
                const typeB = b.type === 'folder' ? 'folder' : (b.appId || 'app');
                return typeA.localeCompare(typeB);
            } else if (sortBy === 'date') {
                // Fallback to fake date or just order if no date available
                const dateA = (a as any).createdAt || a.name.length; 
                const dateB = (b as any).createdAt || b.name.length;
                return dateB - dateA;
            }
            return 0;
        });
    }, [folder.contents, sortBy]);

    return (
        <div className="h-full w-full bg-zinc-50 flex flex-col text-zinc-800 p-4 overflow-y-auto overscroll-y-contain">
             {/* Simulated random text */}
            <div className="mb-6 p-4 bg-white border border-zinc-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-zinc-500 font-medium uppercase text-[10px] tracking-wider">
                    <FileText size={14} /> README.txt
                </div>
                <p className="text-zinc-600 text-sm leading-relaxed">
                    This folder contains project assets and documentation. 
                    Ensure all sensitive data is encrypted before sharing.
                    Updated: Oct 26, 2023.
                </p>
            </div>

            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Contents ({folder.contents?.length || 0})
                </h3>
                <div className="flex items-center gap-2 bg-zinc-200/50 p-1 rounded-md">
                    <button 
                        onClick={() => setSortBy('name')} 
                        className={`p-1.5 rounded flex items-center justify-center transition-colors ${sortBy === 'name' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
                        title="Sort by Name"
                    >
                        <ArrowDownAz size={14} />
                    </button>
                    <button 
                        onClick={() => setSortBy('date')} 
                        className={`p-1.5 rounded flex items-center justify-center transition-colors ${sortBy === 'date' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
                        title="Sort by Date"
                    >
                        <Calendar size={14} />
                    </button>
                    <button 
                        onClick={() => setSortBy('type')} 
                        className={`p-1.5 rounded flex items-center justify-center transition-colors ${sortBy === 'type' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
                        title="Sort by Type"
                    >
                        <Type size={14} />
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 content-start">
                {sortedContents.map(item => (
                    <div key={item.id} className="flex flex-col items-center gap-1.5 p-2 hover:bg-zinc-200/50 rounded-lg cursor-pointer transition-colors group">
                        {/* Gentler 3D effect for small icons */}
                        <div className={`relative w-12 h-12 ${item.bgColor || 'bg-zinc-500'} rounded-xl flex items-center justify-center text-white shadow-[0_1px_3px_-1px_rgba(0,0,0,0.2),inset_0_1px_0.5px_rgba(255,255,255,0.2),inset_0_-1px_2px_rgba(0,0,0,0.1)] group-hover:scale-105 transition-transform duration-200 ease-out border-t border-white/10 overflow-hidden`}>
                             {/* Gentler Glossy Overlay (Scaled down) */}
                            <div className="absolute inset-0 bg-[radial-gradient(at_top_left,_rgba(255,255,255,0.2)_0%,_transparent_70%)] pointer-events-none" />
                            <item.icon size={24} className="relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]" />
                        </div>
                        <span className="text-xs text-center truncate w-full font-medium text-zinc-700 group-hover:text-zinc-900">{item.name}</span>
                    </div>
                ))}
                {(!folder.contents || folder.contents.length === 0) && (
                     <div className="col-span-full text-zinc-400 italic py-4 text-center text-sm">
                        Empty
                    </div>
                )}
            </div>
        </div>
    );
};