/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { LucideIcon } from 'lucide-react';

declare global {
    var html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
}

export type AppId = 'home' | 'mail' | 'slides' | 'snake' | 'folder' | 'notepad' | 'cybernetic_export' | 'github_sync' | 'flipper' | 'termstudio' | 'ollama' | 'openclaw' | 'coderabbit' | 'semantic_scholar' | 'research_rabbit' | 'papers_with_code' | 'langchain' | 'unreal_engine' | 'blender' | 'knowledge_compressor' | 'supersayen' | 'aiterm' | 'jacky' | 'app_connector' | 'data_pods' | 'pod_system' | 'cloud_deploy' | 'consensus_lab' | 'fleet_atlas' | 'llm_environment' | 'small_agent_fleet' | 'cloud_infrastructure';

export interface DesktopItem {
    id: string;
    name: string;
    type: 'app' | 'folder';
    icon: LucideIcon;
    appId?: AppId | string;
    contents?: DesktopItem[];
    bgColor?: string;
    notepadInitialContent?: string;
    url?: string;
    iconName?: string;
}

export interface Point {
    x: number;
    y: number;
}

export type Stroke = Point[];

export interface Email {
    id: number;
    from: string;
    subject: string;
    preview: string;
    body: string;
    time: string;
    unread: boolean;
}

export type ToolAction = 
    | { type: 'DELETE_ITEM'; itemId: string }
    | { type: 'EXPLODE_FOLDER'; folderId: string }
    | { type: 'EXPLAIN_ITEM'; itemId: string }
    | { type: 'NONE' };