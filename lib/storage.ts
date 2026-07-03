
export interface FileHistory {
    content: string;
    timestamp: number;
}

export const saveFile = (fileId: string, content: string, isAuto = false) => {
    const key = `file_${fileId}`;
    const historyKey = `history_${fileId}`;
    
    // Save current version immediately
    localStorage.setItem(key, content);
    
    // Update history
    const history = getHistory(fileId);
    if (history.length > 0 && history[0].content === content) {
        return;
    }
    
    if (isAuto && history.length > 0 && (Date.now() - history[0].timestamp < 10000)) {
        history[0].content = content;
        history[0].timestamp = Date.now();
        localStorage.setItem(historyKey, JSON.stringify(history));
        return;
    }

    history.unshift({ content, timestamp: Date.now() });
    if (history.length > 20) history.pop();
    localStorage.setItem(historyKey, JSON.stringify(history));
};

export const getFile = (fileId: string): string | null => {
    return localStorage.getItem(`file_${fileId}`);
};

export const getHistory = (fileId: string): FileHistory[] => {
    const history = localStorage.getItem(`history_${fileId}`);
    return history ? JSON.parse(history) : [];
};

export const restoreFromHistory = (fileId: string, timestamp: number): string | null => {
    const history = getHistory(fileId);
    const entry = history.find(h => h.timestamp === timestamp);
    if (entry) {
        saveFile(fileId, entry.content); // Restore makes it the current version
        return entry.content;
    }
    return null;
};
