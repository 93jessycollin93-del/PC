/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import { MousePointer2, PenLine, Play, Mail, Presentation, Folder, Loader2, FileText, Image as ImageIcon, Gamepad2, Eraser } from 'lucide-react';
import { Modality } from "@google/genai";
import { AppId, DesktopItem, Stroke, Email } from './types';
import { HomeScreen } from './components/apps/HomeScreen';
import { MailApp } from './components/apps/MailApp';
import { SlidesApp } from './components/apps/SlidesApp';
import { SnakeGame } from './components/apps/SnakeGame';
import { FolderView } from './components/apps/FolderView';
import { DraggableWindow } from './components/DraggableWindow';
import { InkLayer } from './components/InkLayer';
import { getAiClient, HOME_TOOLS, MAIL_TOOLS, MODEL_NAME, SYSTEM_INSTRUCTION } from './lib/gemini';
import { NotepadApp } from './components/apps/NotepadApp';
import { CyberneticExportApp } from './components/apps/CyberneticExportApp';
import { AuthButton } from './components/AuthButton';
import { Share2 } from 'lucide-react';

const INITIAL_DESKTOP_ITEMS: DesktopItem[] = [
    { id: 'export_os', name: 'Export OS', type: 'app', icon: Share2, appId: 'cybernetic_export', bgColor: 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500' },
    { id: 'mail', name: 'Mail', type: 'app', icon: Mail, appId: 'mail', bgColor: 'bg-gradient-to-br from-blue-400 to-blue-700' },
    { id: 'slides', name: 'Slides', type: 'app', icon: Presentation, appId: 'slides', bgColor: 'bg-gradient-to-br from-orange-400 to-orange-700' },
    { id: 'snake', name: 'Game', type: 'app', icon: Gamepad2, appId: 'snake', bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-800' },
    { 
        id: 'how_to_use', 
        name: 'how_to_use.txt', 
        type: 'app', 
        icon: FileText, 
        appId: 'notepad', 
        bgColor: 'bg-gradient-to-br from-pink-500 to-pink-700',
        notepadInitialContent: `GEMINI INK - GESTURE GUIDE

Navigate your computer using natural hand-drawn sketches.

GLOBAL / DESKTOP
----------------
1. Delete Item: 
   Draw an "X" or a cross over any app icon or folder to delete it.

2. Explode Folder: 
   Draw outward pointing arrows coming out of a folder to "explode" it and reveal its contents on the desktop.

3. Get Info / Summarize: 
   Draw a question mark "?" over an item.
   - If it's a folder, it lists contents.
   - If it's a text file, it reads and summarizes the text.

4. Generate Wallpaper: 
   Draw a sketch on the empty background (mountains, flowers, abstract shapes) to generate a new AI wallpaper based on your drawing.

MAIL APP
--------
1. Delete Email: 
   Draw a horizontal line (strike-through) or an "X" over an email row.

2. Summarize Email: 
   Draw a question mark "?" over an email row or highlight it to get a one-sentence summary of the email body.

TIPS
----
- Ensure your ink contrasts with the background.
- Distinct shapes work best.`
    },
    { 
        id: 'notes', 
        name: 'notes.txt', 
        type: 'app', 
        icon: FileText, 
        appId: 'notepad', 
        bgColor: 'bg-gradient-to-br from-zinc-400 to-zinc-600',
        notepadInitialContent: `TODO LIST:
- Buy milk, eggs, and bread
- Call mom on weekend
- Finish Gemini Ink demo
- Schedule dentist appointment
- Water the plants

RANDOM THOUGHTS:
The universe is vast and full of mysteries. 
Why do cats purr? 
Is time travel possible?`
    },
    { 
        id: 'project_specs', 
        name: 'novel.txt', 
        type: 'app', 
        icon: FileText, 
        appId: 'notepad', 
        bgColor: 'bg-gradient-to-br from-indigo-400 to-indigo-600',
        notepadInitialContent: `THE BOND

Elara lived in a small cottage at the edge of the Whispering Woods, a place where the trees murmured secrets to those willing to listen. Her only companion was Barnaby, a scruffy terrier mix with one ear that stood at attention and another that flopped lazily over his brow. 

They were a pair, Elara and Barnaby. Where she went, he trotted behind, his nails clicking a familiar rhythm on the cobblestones of the village or sinking silently into the moss of the forest floor. He was her shadow, her confidant, and her anchor in a world that often felt too large and too loud.

One bitter winter evening, a storm rolled in, fierce and howling. The wind rattled the windowpanes like an angry spirit demanding entry. Elara sat by the hearth, knitting a scarf, while Barnaby dozed at her feet, chasing dream-rabbits with twitching paws. Suddenly, the power cut, plunging the cottage into darkness.

Barnaby was up in an instant. He didn't whine. He simply pressed his warm flank against Elara's leg, a sturdy, living presence in the void. He guided her, step by step, to the kitchen where the candles were kept, his low woof signaling obstacles she couldn't see. 

As they sat together by candlelight, the storm raging outside, Elara buried her face in his fur. He smelled of pine needles and rain. "You're a good boy, Barnaby," she whispered. He licked her hand, a rough, wet sandpaper kiss that said, clearer than any words, "I am here. We are safe."

Years passed, and Barnaby's muzzle turned gray. His walks became slower, his naps longer. But the look in his eyes—that adoration, that absolute, unwavering trust—never dimmed. And when the day came that he could no longer stand, Elara sat with him on the floor, holding his paw as he drifted away. 

The cottage felt empty afterwards, the silence deafening. But sometimes, when the wind blew through the Whispering Woods, Elara could swear she heard the click-click-click of nails on the floorboards, and felt a phantom warmth against her leg, reminding her that love, once given, never truly leaves.`
    },
    { id: 'docs', name: 'Documents', type: 'folder', icon: Folder, bgColor: 'bg-gradient-to-br from-sky-400 to-sky-700', contents: [
        { id: 'doc1', name: 'Report.docx', type: 'app', icon: FileText, bgColor: 'bg-gradient-to-br from-blue-500 to-blue-700' },
        { id: 'img1', name: 'Vacation.png', type: 'app', icon: ImageIcon, bgColor: 'bg-gradient-to-br from-purple-500 to-purple-700' }
    ] },
    { id: 'projects', name: 'Projects', type: 'folder', icon: Folder, bgColor: 'bg-gradient-to-br from-indigo-400 to-indigo-700', contents: [
        { id: 'p1', name: 'Gemini_Demo.ts', type: 'app', icon: FileText, bgColor: 'bg-gradient-to-br from-cyan-500 to-cyan-700' }
    ]}
];

const INITIAL_EMAILS: Email[] = [
    { id: 1, from: 'Thoms M.', subject: 'Project Deadline Updated!', preview: 'We need to push the launch date by two weeks due to...', body: 'Hi Team,\n\nWe need to push the launch date by two weeks due to pending QA approvals. Please update your roadmaps accordingly.\n\nThanks,\nBoss', time: '10:45 AM', unread: true },
    { id: 2, from: 'HR Department', subject: 'Annual Leave Policy', preview: 'Please review the attached changes to our annual leave policy...', body: 'Dear Employees,\n\nPlease review the attached changes to our annual leave policy effective next month. The main change concerns rollover days.\n\nRegards,\nHR', time: 'Yesterday', unread: false },
    { id: 3, from: 'Newsletter', subject: 'Tech Trends 2024', preview: 'Top 10 AI trends you need to watch out for this year...', body: 'Welcome to this week\'s newsletter! Here are the Top 10 AI trends:\n1. Multimodal Models\n2. Agentic AI\n3. ... [Click to read more]', time: 'Yesterday', unread: false },
    { id: 4, from: 'Jane', subject: 'Dinner on Sunday?', preview: 'Are you still coming over for dinner this weekend? Let me know...', body: 'Hi honey,\n\nAre you still coming over for dinner this weekend? Dad is making his famous lasagna. Let me know if you can make it!\n\nLove,\nMom', time: 'Oct 5', unread: false },
    { id: 5, from: 'Service Alert', subject: 'Downtime Scheduled', preview: 'Maintenance window scheduled for this Saturday 2AM-4AM EST...', body: 'System Notice:\n\nMaintenance window scheduled for this Saturday 2AM-4AM EST. All services will be unavailable during this time.', time: 'Oct 4', unread: true },
    { id: 6, from: 'Online Store', subject: 'Your order has shipped!', preview: 'Good news! Your recent order #123456789 has been shipped...', body: 'Hi there,\n\nYour order #123456789 has shipped via Ground Delivery. It should arrive by Friday.\n\nTrack your package: [Link]', time: 'Oct 3', unread: false },
    { id: 7, from: 'Bank', subject: 'Statement Available', preview: 'Your electronic statement for September is now available...', body: 'Dear Customer,\n\nYour Sep 2023 statement is available online. Log in to view it securely.', time: 'Oct 1', unread: false },
    { id: 8, from: 'Streaming Service', subject: 'New Arrivals this Month', preview: 'Check out what\'s new: The Galactic Saga, Mystery Manor...', body: 'Ready for the weekend? Here are the hottest new shows and movies added this month!', time: 'Sep 28', unread: false },
    { id: 9, from: 'Recruiter', subject: 'Job Opportunity - Senior Dev', preview: 'I came across your profile and thought you might be a good fit...', body: 'Hello,\n\nI\'m recruiting for a Senior Developer role at a fast-growing startup. Are you open to new opportunities?', time: 'Sep 25', unread: false },
    { id: 10, from: 'Gym', subject: 'Membership Renewal', preview: 'Your annual membership is due for renewal next month...', body: 'Hi Member,\n\nJust a friendly reminder that your membership expires in 30 days. Renew now to lock in current rates!', time: 'Sep 20', unread: false },
    { id: 11, from: 'Utility Co', subject: 'Bill is Ready', preview: 'Your electric bill for August is $145.32...', body: 'Your bill is ready to view and pay. Total amount due: $145.32. Due date: Oct 15.', time: 'Sep 15', unread: false },
    { id: 12, from: 'Travel Agent', subject: 'Flight Confirmation: NYC to LON', preview: 'Booking Ref: ABCDEF. See attached itinerary...', body: 'Thank you for booking with us. Your flight to London is confirmed. Please find your e-tickets attached.', time: 'Sep 10', unread: false },
    { id: 13, from: 'Team Lead', subject: 'Code Review Reminder', preview: 'Please review PR #456 before EOD today...', body: 'Hey,\n\nCan you take a look at PR #456 when you get a chance? We need to merge it before the release cut.', time: 'Sep 9', unread: false },
    { id: 14, from: 'Security', subject: 'Password Expiry Notice', preview: 'Your corporate account password will expire in 5 days...', body: 'Automated Notice:\n\nYour password will expire in 5 days. Please change it via the self-service portal to avoid being locked out.', time: 'Sep 5', unread: false },
    { id: 15, from: 'Coffee Shop', subject: 'Free Birthday Drink!', preview: 'Happy Birthday month! Come in for a free drink on us...', body: 'Happy Birthday! Pop in anytime this month and show this email for a free tall beverage of your choice.', time: 'Sep 1', unread: false },
];

interface OpenWindow {
    id: string;
    item: DesktopItem;
    zIndex: number;
    pos: { x: number, y: number };
    size?: { width: number, height: number };
}

export const App: React.FC = () => {
    const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [nextZIndex, setNextZIndex] = useState(100);
    const [inkMode, setInkMode] = useState(false);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [desktopItems, setDesktopItems] = useState<(DesktopItem | null)[]>(INITIAL_DESKTOP_ITEMS);
    const [emails, setEmails] = useState<Email[]>(INITIAL_EMAILS);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState<{ title?: string; message: React.ReactNode } | null>(null);
    const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const showToast = (message: React.ReactNode, title?: string, autoDismiss: boolean = true) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setToast({ message, title });
        if (autoDismiss) {
            timeoutRef.current = setTimeout(() => {
                setToast(null);
                timeoutRef.current = null;
            }, 6000);
        }
    };

    const handleLaunch = (item: DesktopItem) => {
        if (inkMode) return;
        
        if (openWindows.find(w => w.id === item.id)) {
            focusWindow(item.id);
            return;
        }

        let initialSize = { width: 640, height: 480 };
        if (item.appId === 'mail') initialSize = { width: 800, height: 600 };
        if (item.appId === 'snake') initialSize = { width: 500, height: 550 };
        if (item.appId === 'notepad') initialSize = { width: 400, height: 500 };
        if (item.appId === 'cybernetic_export') initialSize = { width: 580, height: 620 };

        setOpenWindows(prev => [...prev, {
            id: item.id,
            item: item,
            zIndex: nextZIndex,
            pos: { x: 100 + (prev.length * 30), y: 80 + (prev.length * 30) },
            size: initialSize
        }]);
        setNextZIndex(prev => prev + 1);
        setFocusedId(item.id);
    };

    const closeWindow = (id: string) => {
        setOpenWindows(prev => prev.filter(w => w.id !== id));
        if (focusedId === id) setFocusedId(null);
    };

    const focusWindow = (id: string | null) => {
        if (id === null) {
            setFocusedId(null);
            return;
        }
        setFocusedId(id);
        setOpenWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZIndex } : w));
        setNextZIndex(prev => prev + 1);
    };

    const deleteItemRecursively = (items: (DesktopItem | null)[], nameToDelete: string, isRoot: boolean = true): { newItems: (DesktopItem | null)[], deleted: boolean } => {
        let deleted = false;
        
        const mappedItems = items.map(item => {
            if (!item) return null; // Propagate existing gaps

            if (item.name.toLowerCase().includes(nameToDelete)) {
                deleted = true;
                // If root, return null to "lock" the grid gap. 
                // If not root, return undefined to mark for filtering (standard OS folder behavior).
                return isRoot ? null : undefined; 
            }
            
            if (item.type === 'folder' && item.contents) {
                // Recurse, passing isRoot=false to enable standard shifting inside folders.
                // We cast contents to (DesktopItem | null)[] to satisfy the recursive call type, 
                // though standard folders currently don't have nulls.
                const result = deleteItemRecursively(item.contents as (DesktopItem | null)[], nameToDelete, false);
                if (result.deleted) deleted = true;
                
                // Filter out any 'undefined' returned from non-root recursive calls to maintain contiguous lists in folders.
                const newContents = result.newItems.filter((i): i is DesktopItem => i !== null && i !== undefined);
                return { ...item, contents: newContents };
            }
            return item;
        });

        // If we are not at root, we need to actually remove the items we marked with 'undefined'.
        // At root, we keep 'null's to lock the grid.
        const finalItems = isRoot ? mappedItems : mappedItems.filter(i => i !== undefined);

        return { newItems: finalItems as (DesktopItem | null)[], deleted };
    };

    const findItemByName = (items: (DesktopItem | null)[], name: string): DesktopItem | undefined => {
        for (const item of items) {
            if (!item) continue;
            if (item.name.toLowerCase().includes(name.toLowerCase())) {
                return item;
            }
            if (item.type === 'folder' && item.contents) {
                const found = findItemByName(item.contents, name);
                if (found) return found;
            }
        }
        return undefined;
    };

    const findEmailInList = (emailList: Email[], subjectQuery?: string, senderQuery?: string) => {
         const sQuery = subjectQuery?.toLowerCase() || '';
         const fQuery = senderQuery?.toLowerCase() || '';
         
         return emailList.find(e => {
             const subjectMatch = sQuery && e.subject.toLowerCase().includes(sQuery);
             const senderMatch = fQuery && e.from.toLowerCase().includes(fQuery);
             if (sQuery && fQuery) return subjectMatch && senderMatch;
             return subjectMatch || senderMatch;
         });
    };

    const getSketchImage = (currentStrokes: Stroke[]) => {
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Fill black background for high contrast input to the model
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw white strokes
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        currentStrokes.forEach(stroke => {
            if (stroke.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            ctx.stroke();
        });
        
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    };

    const executeInkAction = async () => {
        if (strokes.length === 0) {
            showToast("Draw something first!", undefined, true);
            return;
        }

        setIsProcessing(true);
        try {
            const canvas = await html2canvas(document.body, {
                 ignoreElements: (element) => element.id === 'control-bar',
                 logging: false,
                 useCORS: true,
                 scale: 1 
            });
            const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

            const ai = getAiClient();
            
            let activeTools = HOME_TOOLS;
            let contextDescription = 'Desktop (Home Screen)';

            if (focusedId) {
                const focusedWindow = openWindows.find(w => w.id === focusedId);
                if (focusedWindow?.item.appId === 'mail') {
                    activeTools = MAIL_TOOLS;
                    contextDescription = 'Mail App';
                }
            }

             const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: `Analyze the white ink drawings. The user is currently focused on: ${contextDescription}.` }
                ],
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    tools: activeTools,
                    temperature: 0.1,
                }
            });

            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
                let actionTaken = false;
                let workingDesktopItems = [...desktopItems];
                let workingEmails = [...emails];
                let desktopItemsChanged = false;
                let emailsChanged = false;
                let messages: React.ReactNode[] = [];
                let isSummary = false;

                for (const call of functionCalls) {
                    console.log('Tool call:', call.name, call.args);
                    const args = call.args as any;

                    if (call.name === 'delete_item' && args.itemName) {
                        const itemName = args.itemName.toLowerCase();
                        const { newItems, deleted } = deleteItemRecursively(workingDesktopItems, itemName, true);
                        if (deleted) {
                            workingDesktopItems = newItems;
                            desktopItemsChanged = true;
                            messages.push(<div key={`del-${args.itemName}`}>Deleted {args.itemName}</div>);
                            actionTaken = true;
                        }
                    } else if (call.name === 'explode_folder' && args.folderName) {
                        const folderName = args.folderName.toLowerCase();
                        const folder = findItemByName(workingDesktopItems, folderName);

                        if (folder && folder.type === 'folder' && folder.contents) {
                            workingDesktopItems = workingDesktopItems.filter(i => i?.id !== folder.id);
                            workingDesktopItems.push(...folder.contents);
                            desktopItemsChanged = true;
                            messages.push(<div key={`exp-${folder.id}`}>Exploded {folder.name}</div>);
                            actionTaken = true;
                        }
                    } else if (call.name === 'explain_item' && args.itemName) {
                        const item = findItemByName(workingDesktopItems, args.itemName);
                        if (item) {
                            if (item.type === 'folder') {
                                const contentCount = item.contents?.length || 0;
                                const contentNames = item.contents?.map(i => i.name).join(', ') || 'nothing';
                                messages.push(
                                    <div key={`expl-${item.id}`}>
                                        <span className="font-extrabold text-white text-3xl underline decoration-sky-500/50">{item.name}</span> contains {contentCount} items: {contentNames}.
                                    </div>
                                );
                                isSummary = true;
                            } else if (item.notepadInitialContent) {
                                showToast(`Reading ${item.name}...`, undefined, true);
                                try {
                                    const summaryResponse = await ai.models.generateContent({
                                        model: 'gemini-3-flash-preview',
                                        contents: `Summarize this in one sentence: ${item.notepadInitialContent}`,
                                    });
                                    messages.push(
                                        <div key={`expl-${item.id}`}>
                                            <span className="font-extrabold text-white text-3xl underline decoration-sky-500/50">{item.name}</span>: {summaryResponse.text}
                                        </div>
                                    );
                                    isSummary = true;
                                } catch (e) {
                                    console.error("Summary failed", e);
                                    messages.push(<div key={`err-${item.id}`}>Could not read {item.name}.</div>);
                                }
                            } else {
                                 messages.push(<div key={`expl-${item.id}`}>{item.name} is an application.</div>);
                            }
                            actionTaken = true;
                        }
                    } else if (call.name === 'change_background') {
                        showToast("Dreaming up new wallpaper...", undefined, true);
                        const sketchBase64 = getSketchImage(strokes);
                        if (sketchBase64) {
                             try {
                                 // Call gemini-2.5-flash-image to generate wallpaper from sketch
                                 const imgResponse = await ai.models.generateContent({
                                    model: 'gemini-2.5-flash-image',
                                    contents: [
                                        { inlineData: { mimeType: 'image/jpeg', data: sketchBase64 } },
                                        { text: `Generate an aesthetically pleasing, realistic looking wallpaper based on this sketch. The final image should align well spatially with the original trace, as if the sketch was a guideline, but REMOVE all the actual sketch lines from the final output. ${args.sketch_description ? `It looks like: ${args.sketch_description}` : ''}` }
                                    ],
                                    config: {
                                        responseModalities: [Modality.IMAGE],
                                    }
                                });
                                
                                const candidates = imgResponse.candidates;
                                if (candidates && candidates[0]?.content?.parts) {
                                    for (const part of candidates[0].content.parts) {
                                        if (part.inlineData && part.inlineData.data) {
                                             setWallpaperUrl(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
                                             messages.push(<div key="wp-ok">Wallpaper updated!</div>);
                                             actionTaken = true;
                                             break;
                                        }
                                    }
                                }
                                if (!actionTaken) messages.push(<div key="wp-fail">Failed to generate wallpaper.</div>);

                             } catch (err) {
                                 console.error("Wallpaper generation error", err);
                                 messages.push(<div key="wp-err">Error generating wallpaper.</div>);
                             }
                        }
                    } 
                    else if (call.name === 'delete_email' && (args.subject_text || args.sender_text)) {
                         const emailToDelete = findEmailInList(workingEmails, args.subject_text, args.sender_text);
                         if (emailToDelete) {
                             workingEmails = workingEmails.filter(e => e.id !== emailToDelete.id);
                             emailsChanged = true;
                             messages.push(<div key={`del-mail-${emailToDelete.id}`}>Deleted email from {emailToDelete.from}</div>);
                             actionTaken = true;
                         }
                    } else if (call.name === 'summarize_email' && (args.subject_text || args.sender_text)) {
                        const emailToSummarize = findEmailInList(workingEmails, args.subject_text, args.sender_text);
                        if (emailToSummarize) {
                            showToast(`Summarizing email from ${emailToSummarize.from}...`, undefined, true);
                            try {
                                const summaryResponse = await ai.models.generateContent({
                                    model: 'gemini-3-flash-preview',
                                    contents: `Summarize the body of this email in one concise sentence.
From: ${emailToSummarize.from}
Subject: ${emailToSummarize.subject}
Body: ${emailToSummarize.body}`,
                                });
                                messages.push(
                                    <div key={`sum-mail-${emailToSummarize.id}`}>
                                        <span className="font-extrabold text-white text-3xl underline decoration-sky-500/50">Summary ({emailToSummarize.from})</span>: {summaryResponse.text}
                                    </div>
                                );
                                actionTaken = true;
                                isSummary = true;
                            } catch (e) {
                                console.error("Email summary failed", e);
                                messages.push(<div key={`sum-err-${emailToSummarize.id}`}>Could not summarize email from {emailToSummarize.from}.</div>);
                            }
                        }
                    }
                }

                if (desktopItemsChanged) {
                    setDesktopItems(workingDesktopItems);
                    setOpenWindows(prev => prev.filter(w => findItemByName(workingDesktopItems, w.item.name)));
                }
                if (emailsChanged) {
                    setEmails(workingEmails);
                }

                if (messages.length > 0) {
                    // Result toast - Persistent (autoDismiss=false)
                    showToast(<div className="flex flex-col gap-3">{messages}</div>, isSummary ? "Summary" : undefined, false);
                } else if (!actionTaken) {
                     showToast("Action not matched to any item.", undefined, true);
                }

            } else {
                 showToast("No action recognized.", undefined, true);
            }

        } catch (e) {
            console.error("Gemini Error:", e);
            showToast("Error processing.", undefined, true);
        } finally {
            setIsProcessing(false);
            setStrokes([]);
        }
    };

    // Reduced padding for buttons (p-5 -> p-4)
    const buttonBaseClasses = "relative overflow-hidden p-4 rounded-full transition-all duration-300 border-t border-white/5 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.1)] active:scale-95";
    const glossOverlay = <div className="absolute inset-0 bg-[radial-gradient(at_top_left,_rgba(255,255,255,0.15)_0%,_transparent_60%)] pointer-events-none" />;

    // Reduced icon size (34 -> 28)
    const ICON_SIZE = 28;

    const handleGlobalPointerDown = (e: React.PointerEvent) => {
        if (toast) {
            const target = e.target as HTMLElement;
            if (!target.closest('.toast-card')) {
                setToast(null);
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            }
        }
    };

    return (
        <div 
            className="h-full w-full bg-black text-os-text font-sans overflow-hidden relative" 
            onPointerDownCapture={handleGlobalPointerDown}
        >
            <div className="absolute top-4 right-4 z-50">
                <AuthButton />
            </div>
            {/* Floating Control Capsule - Smaller padding (p-4 -> p-3), lowered slightly (bottom-12 -> bottom-10) */}
            <div id="control-bar" className="fixed bottom-10 left-1/2 -translate-x-1/2 flex flex-row items-center justify-center p-3 bg-zinc-950/70 backdrop-blur-2xl border border-zinc-800/50 shadow-3xl rounded-full z-[3000] transition-all hover:bg-zinc-950/90">
                
                <div className="flex items-center gap-3">
                    <button onClick={() => setInkMode(false)} className={`${buttonBaseClasses} ${!inkMode ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' : 'bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-400 hover:text-zinc-200'}`} title="Cursor Mode">
                        {glossOverlay}
                        <MousePointer2 size={ICON_SIZE} className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
                    </button>
                    
                    <button onClick={() => setInkMode(true)} className={`${buttonBaseClasses} ${inkMode ? 'bg-gradient-to-br from-red-500 to-red-700 text-white' : 'bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-400 hover:text-zinc-200'}`} title="Ink Mode">
                        {glossOverlay}
                        <PenLine size={ICON_SIZE} className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
                    </button>
                </div>
                
                {/* Vertical Separator - Shorter (h-12 -> h-8), tighter margin (mx-5 -> mx-3) */}
                <div className={`h-8 w-px bg-white/20 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${inkMode ? 'mx-3 opacity-100' : 'mx-0 w-0 opacity-0'}`} />

                {/* Ink Action Buttons - Tighter gap */}
                <div className={`flex items-center gap-3 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden ${inkMode ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}>
                     <button onClick={executeInkAction} disabled={isProcessing || strokes.length === 0} className={`${buttonBaseClasses} ${isProcessing ? 'bg-zinc-700 cursor-wait' : strokes.length > 0 ? 'bg-gradient-to-br from-green-500 to-green-700 text-white' : 'bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-600'}`} title="Execute Ink Action">
                        {glossOverlay}
                        {isProcessing ? <Loader2 size={ICON_SIZE} className="animate-spin relative z-10" /> : <Play size={ICON_SIZE} fill="currentColor" className={`relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)] ${strokes.length > 0 ? "ml-0.5" : ""}`} />}
                    </button>
                    
                    <button onClick={() => setStrokes([])} disabled={strokes.length === 0} className={`${buttonBaseClasses} ${strokes.length > 0 ? 'bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-400 hover:text-red-400' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-700 cursor-not-allowed opacity-50'}`} title="Clear Ink">
                        {glossOverlay}
                        <Eraser size={ICON_SIZE} className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
                    </button>
                </div>
            </div>

            {/* Desktop Area with Dynamic Background */}
            <div 
                className="h-full w-full relative overflow-hidden bg-zinc-900 transition-all duration-1000 ease-in-out"
                style={{
                    backgroundImage: wallpaperUrl 
                       ? `url(${wallpaperUrl})` 
                       : 'radial-gradient(circle at 50% 120%, rgba(120, 119, 198, 0.25) 0%, transparent 50%), radial-gradient(circle at 10% 100%, rgba(56, 189, 248, 0.2) 0%, transparent 30%), radial-gradient(circle at 90% 100%, rgba(236, 72, 153, 0.2) 0%, transparent 30%), radial-gradient(circle at 30% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 20%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            >
                
                {/* Background Home Screen (Clicking it focuses desktop) */}
                <div className="h-full w-full" onMouseDown={() => focusWindow(null)}>
                     <HomeScreen items={desktopItems} onLaunch={handleLaunch} />
                </div>

                {/* Windows */}
                {openWindows.map(win => {
                    let content = null;
                    if (win.item.type === 'folder') content = <FolderView folder={win.item} />;
                    else if (win.item.appId === 'mail') content = <MailApp emails={emails} />;
                    else if (win.item.appId === 'slides') content = <SlidesApp />;
                    else if (win.item.appId === 'snake') content = <SnakeGame />;
                    else if (win.item.appId === 'notepad') content = <NotepadApp fileId={win.id} initialContent={win.item.notepadInitialContent} />;
                    else if (win.item.appId === 'cybernetic_export') content = <CyberneticExportApp />;

                    return (
                        <DraggableWindow
                            key={win.id}
                            id={win.id}
                            title={win.item.name}
                            icon={win.item.icon}
                            initialPos={win.pos}
                            initialSize={win.size}
                            zIndex={win.zIndex}
                            isActive={focusedId === win.id}
                            onClose={() => closeWindow(win.id)}
                            onFocus={() => focusWindow(win.id)}
                        >
                            {content}
                        </DraggableWindow>
                    );
                })}

                <InkLayer active={inkMode} strokes={strokes} setStrokes={setStrokes} isProcessing={isProcessing} />

                {toast && (
                    // Notification Card
                    <div className={`toast-card absolute bottom-36 left-1/2 -translate-x-1/2 bg-zinc-800/95 backdrop-blur-xl text-white px-8 py-6 rounded-[2rem] shadow-3xl z-[9999] animate-in slide-in-from-bottom-10 fade-in duration-300 border border-zinc-700/50 pointer-events-auto flex flex-col gap-2 transition-all ${toast.title === 'Summary' ? 'w-[60rem] max-w-[95vw]' : 'max-w-lg w-full'}`}>
                        {toast.title ? (
                            <>
                                <div className="flex items-center gap-3 border-b border-white/10 pb-3 mb-1">
                                     <span className="relative flex h-3 w-3 flex-shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                                    </span>
                                    <h3 className={`${toast.title === 'Summary' ? 'text-5xl' : 'text-2xl'} font-bold text-sky-400 tracking-tight`}>{toast.title}</h3>
                                </div>
                                <div className={`text-zinc-200 leading-normal whitespace-pre-wrap ${toast.title === 'Summary' ? 'text-2xl' : 'text-base'}`}>
                                    {toast.message}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-start gap-4">
                                <span className="relative flex h-4 w-4 mt-1 flex-shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
                                </span>
                                <span className="leading-relaxed flex-1 text-base font-medium whitespace-pre-wrap">{toast.message}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};