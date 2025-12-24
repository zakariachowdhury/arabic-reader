"use client";

import { Check, X } from "lucide-react";

interface DeleteConfirmationProps {
    isDeleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    isPending?: boolean;
}

export function DeleteConfirmation({ isDeleting, onConfirm, onCancel, isPending = false }: DeleteConfirmationProps) {
    if (!isDeleting) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 bg-red-50 rounded-lg p-1 animate-in fade-in zoom-in duration-200">
            <span className="text-[10px] font-bold text-red-600 px-2 uppercase tracking-tight">Delete?</span>
            <button
                onClick={onConfirm}
                disabled={isPending}
                className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-all disabled:opacity-50"
                aria-label="Confirm delete"
            >
                <Check className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={onCancel}
                disabled={isPending}
                className="p-1.5 text-slate-400 hover:bg-white rounded-md transition-all shadow-sm disabled:opacity-50"
                aria-label="Cancel delete"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

