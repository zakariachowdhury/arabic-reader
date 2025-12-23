"use client";

import { useState, useTransition } from "react";
import { VocabularyWord } from "@/db/schema";
import { addVocabularyWord, updateVocabularyWord, deleteVocabularyWord } from "@/app/admin/actions";
import { Edit2, Trash2, Save, X, Plus } from "lucide-react";

export function VocabularyManagement({ initialWords, lessonId, lessonTitle }: { initialWords: VocabularyWord[]; lessonId: number; lessonTitle: string }) {
    const [words, setWords] = useState(initialWords);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<{ arabic: string; english: string; order: number } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newWord, setNewWord] = useState({ arabic: "", english: "", order: words.length });
    const [isPending, startTransition] = useTransition();

    const handleEdit = (word: VocabularyWord) => {
        setEditingId(word.id);
        setEditData({
            arabic: word.arabic,
            english: word.english,
            order: word.order,
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData(null);
        setIsCreating(false);
        setNewWord({ arabic: "", english: "", order: words.length });
    };

    const handleSave = async (wordId: number) => {
        if (!editData) return;

        startTransition(async () => {
            try {
                await updateVocabularyWord(wordId, {
                    arabic: editData.arabic,
                    english: editData.english,
                    order: editData.order,
                });
                setWords(words.map(w => 
                    w.id === wordId 
                        ? { ...w, ...editData }
                        : w
                ));
                setEditingId(null);
                setEditData(null);
            } catch (error) {
                console.error("Failed to update vocabulary word:", error);
                alert("Failed to update vocabulary word. Please try again.");
            }
        });
    };

    const handleCreate = async () => {
        if (!newWord.arabic.trim() || !newWord.english.trim()) {
            alert("Both Arabic and English are required");
            return;
        }

        startTransition(async () => {
            try {
                const created = await addVocabularyWord(lessonId, {
                    arabic: newWord.arabic,
                    english: newWord.english,
                    order: newWord.order,
                });
                setWords([...words, created]);
                setIsCreating(false);
                setNewWord({ arabic: "", english: "", order: words.length + 1 });
            } catch (error) {
                console.error("Failed to add vocabulary word:", error);
                alert("Failed to add vocabulary word. Please try again.");
            }
        });
    };

    const handleDelete = async (wordId: number) => {
        if (!confirm("Are you sure you want to delete this word pair?")) {
            return;
        }

        startTransition(async () => {
            try {
                await deleteVocabularyWord(wordId);
                setWords(words.filter(w => w.id !== wordId));
            } catch (error) {
                console.error("Failed to delete vocabulary word:", error);
                alert("Failed to delete vocabulary word. Please try again.");
            }
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Vocabulary: {lessonTitle}</h2>
                    <p className="text-slate-500 mt-1">Manage Arabic-English word pairs</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Word Pair
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Word Pair</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Arabic *</label>
                                <input
                                    type="text"
                                    value={newWord.arabic}
                                    onChange={(e) => setNewWord({ ...newWord, arabic: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Arabic word"
                                    dir="rtl"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">English *</label>
                                <input
                                    type="text"
                                    value={newWord.english}
                                    onChange={(e) => setNewWord({ ...newWord, english: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="English translation"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Order</label>
                            <input
                                type="number"
                                value={newWord.order}
                                onChange={(e) => setNewWord({ ...newWord, order: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={isPending || !newWord.arabic.trim() || !newWord.english.trim()}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4 inline mr-2" />
                                Add
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                            >
                                <X className="w-4 h-4 inline mr-2" />
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                {words.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-slate-500">No vocabulary words yet. Add your first word pair to get started.</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Order</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Arabic</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">English</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {words.map((word) => (
                                <tr key={word.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === word.id ? (
                                            <input
                                                type="number"
                                                value={editData?.order ?? 0}
                                                onChange={(e) => setEditData({ ...editData!, order: parseInt(e.target.value) || 0 })}
                                                className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                min="0"
                                            />
                                        ) : (
                                            <div className="text-slate-600 font-medium">{word.order}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === word.id ? (
                                            <input
                                                type="text"
                                                value={editData?.arabic || ""}
                                                onChange={(e) => setEditData({ ...editData!, arabic: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                dir="rtl"
                                            />
                                        ) : (
                                            <div className="font-medium text-slate-900 text-lg" dir="rtl">{word.arabic}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === word.id ? (
                                            <input
                                                type="text"
                                                value={editData?.english || ""}
                                                onChange={(e) => setEditData({ ...editData!, english: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        ) : (
                                            <div className="text-slate-600">{word.english}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        {editingId === word.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleSave(word.id)}
                                                    disabled={isPending}
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Save"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={handleCancel}
                                                    disabled={isPending}
                                                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Cancel"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(word)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(word.id)}
                                                    disabled={isPending}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

