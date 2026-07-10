// Shared "archive pod" storage — reuses the same real IndexedDB vault that
// DataPodsApp uses (DB: SAS_ZERO_VAULT, store: pods), so archived notes show
// up as real, organized pods rather than living in a separate silo. A tiny
// low-compute "pod keeper" (organizePod) tags each entry with its source so
// pods stay separated by where they came from (this chat, that app, etc.)
// per the user's "keep things separate" requirement — it does no AI work,
// just deterministic bookkeeping.
const DB_NAME = 'SAS_ZERO_VAULT';
const STORE_NAME = 'pods';

export interface ArchivedNote {
    id: string;
    category: 'notepad-archive';
    name: string;
    description: string;
    sizeMB: number;
    progress: number;
    status: 'ready';
    contents: string[]; // [source, noteText]
    lastModified: number;
}

const initIndexedDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

// The "pod keeper": deterministically files a note under its source so
// notes from different chats/apps never bleed into each other.
export const organizeAndArchiveNote = async (source: string, text: string): Promise<ArchivedNote> => {
    const db = await initIndexedDB();
    const note: ArchivedNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: 'notepad-archive',
        name: `Note from ${source}`,
        description: text.slice(0, 80),
        sizeMB: +(new Blob([text]).size / (1024 * 1024)).toFixed(4),
        progress: 100,
        status: 'ready',
        contents: [source, text],
        lastModified: Date.now(),
    };
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const entry = { id: note.id, data: new Uint8Array(), metadata: note, timestamp: Date.now() };
        const req = store.put(entry);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(note);
    });
};

export const listArchivedNotes = async (): Promise<ArchivedNote[]> => {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            const all = (req.result || []) as { metadata: any }[];
            resolve(all.map(e => e.metadata).filter(m => m?.category === 'notepad-archive'));
        };
    });
};
