import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ToastMessage {
    title: string;
    description?: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
}

interface ToastContextType {
    toast: (message: ToastMessage) => void;
    successToast: (title: string, description?: string) => void;
    errorToast: (title: string, description?: string) => void;
    warningToast: (title: string, description?: string) => void;
    infoToast: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<(ToastMessage & { id: string })[]>([]);

    const addToast = useCallback((message: ToastMessage) => {
        const id = Date.now().toString();
        const toast = { ...message, id };

        setToasts(prev => [...prev, toast]);

        const duration = message.duration || 3000;
        const timer = setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);

        return () => clearTimeout(timer);
    }, []);

    const value: ToastContextType = {
        toast: addToast,
        successToast: (title, description) => addToast({ title, description, type: 'success' }),
        errorToast: (title, description) => addToast({ title, description, type: 'error', duration: 5000 }),
        warningToast: (title, description) => addToast({ title, description, type: 'warning', duration: 4000 }),
        infoToast: (title, description) => addToast({ title, description, type: 'info' }),
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast Renderer */}
            <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none flex flex-col gap-3 max-w-sm">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`rounded-lg px-4 py-3 shadow-xl backdrop-blur-xl border pointer-events-auto animate-in slide-in-from-right-10 fade-in duration-300 ${
                            toast.type === 'success'
                                ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100'
                                : toast.type === 'error'
                                ? 'bg-red-900/80 border-red-500/50 text-red-100'
                                : toast.type === 'warning'
                                ? 'bg-amber-900/80 border-amber-500/50 text-amber-100'
                                : 'bg-blue-900/80 border-blue-500/50 text-blue-100'
                        }`}
                    >
                        <div className="font-semibold text-sm">{toast.title}</div>
                        {toast.description && (
                            <div className="text-xs opacity-90 mt-1">{toast.description}</div>
                        )}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
