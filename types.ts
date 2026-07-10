/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { LucideIcon } from 'lucide-react';

declare global {
    var html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
}

export type AppId = 'home' | 'mail' | 'snake' | 'folder' | 'notepad' | 'cybernetic_export' | 'github_sync' | 'flipper' | 'termstudio' | 'ollama' | 'openclaw' | 'coderabbit' | 'papers_with_code' | 'langchain' | 'unreal_engine' | 'blender' | 'knowledge_compressor' | 'supersayen' | 'aiterm' | 'jacky' | 'app_connector' | 'data_pods' | 'cloud_deploy' | 'consensus_lab' | 'model_router' | 'agent_builder' | 'claude_assistant' | 'codex' | 'grok_terminal' | 'system_settings' | 'archiver' | 'api_keys' | 'cross_ai_lab';

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