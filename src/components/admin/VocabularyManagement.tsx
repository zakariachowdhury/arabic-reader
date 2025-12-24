"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { VocabularyWord } from "@/db/schema";
import { addVocabularyWord, updateVocabularyWord, deleteVocabularyWord, bulkAddVocabularyWords, updateVocabularyOrder } from "@/app/admin/actions";
import { getAvailableModelsForUsersAction, getDefaultModelAction } from "@/app/actions";
import { Edit2, Trash2, Save, X, Plus, Upload, Loader2, CheckCircle2, GripVertical, Info, Sparkles, Play, Volume2 } from "lucide-react";
import { DeleteConfirmation } from "./DeleteConfirmation";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Helper function to play audio using Web Speech API
function playAudio(text: string, lang: string = "en-US", onEnd?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
        console.warn("Speech synthesis not supported");
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to find a voice that matches the language
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = lang.split("-")[0];
        const matchingVoice = voices.find(
            (voice) => voice.lang.startsWith(langPrefix)
        );
        if (matchingVoice) {
            utterance.voice = matchingVoice;
        }

        if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
        }

        window.speechSynthesis.speak(utterance);
    };

    // Ensure voices are loaded before speaking
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        // Voices might not be loaded yet, wait for them
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            speak();
        };
    } else {
        speak();
    }
}

function VocabularyRow({ word, editingId, editData, isPending, deletingId, onEdit, onCancel, onSave, onDeleteClick, onDeleteConfirm, onCancelDelete, setEditData, playingAudio, setPlayingAudio }: {
    word: VocabularyWord;
    editingId: number | null;
    editData: { arabic: string; english: string; order: number } | null;
    isPending: boolean;
    deletingId: number | null;
    onEdit: (word: VocabularyWord) => void;
    onCancel: () => void;
    onSave: (wordId: number) => void;
    onDeleteClick: (wordId: number) => void;
    onDeleteConfirm: (wordId: number) => void;
    onCancelDelete: () => void;
    setEditData: (data: { arabic: string; english: string; order: number } | null) => void;
    playingAudio: string | null;
    setPlayingAudio: (key: string | null) => void;
}) {
    const handlePlayArabic = () => {
        const audioKey = `arabic-${word.id}`;
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
        } else {
            setPlayingAudio(audioKey);
            playAudio(word.arabic, "ar-SA", () => {
                setPlayingAudio(null);
            });
        }
    };

    const handlePlayEnglish = () => {
        const audioKey = `english-${word.id}`;
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
        } else {
            setPlayingAudio(audioKey);
            playAudio(word.english, "en-US", () => {
                setPlayingAudio(null);
            });
        }
    };

    const isPlayingArabic = playingAudio === `arabic-${word.id}`;
    const isPlayingEnglish = playingAudio === `english-${word.id}`;

    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="px-6 py-4 w-12">
                <div className="text-slate-400 p-1">
                    <GripVertical className="w-5 h-5" />
                </div>
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
                    <div className="flex items-center gap-2" dir="rtl">
                        <div className="font-medium text-slate-900 text-lg flex-1">{word.arabic}</div>
                        <button
                            onClick={handlePlayArabic}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Play Arabic audio"
                        >
                            {isPlayingArabic ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Volume2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
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
                    <div className="flex items-center gap-2">
                        <div className="text-slate-600 flex-1">{word.english}</div>
                        <button
                            onClick={handlePlayEnglish}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Play English audio"
                        >
                            {isPlayingEnglish ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Volume2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                {editingId === word.id ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => onSave(word.id)}
                            disabled={isPending}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Save"
                        >
                            <Save className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onCancel}
                            disabled={isPending}
                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Cancel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-2">
                        <DeleteConfirmation
                            isDeleting={deletingId === word.id}
                            onConfirm={() => onDeleteConfirm(word.id)}
                            onCancel={onCancelDelete}
                            isPending={isPending}
                        />
                        {deletingId !== word.id && (
                            <>
                                <button
                                    onClick={() => onEdit(word)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDeleteClick(word.id)}
                                    disabled={isPending}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
}

function SortableVocabularyRow({ word, editingId, editData, isPending, deletingId, onEdit, onCancel, onSave, onDeleteClick, onDeleteConfirm, onCancelDelete, setEditData, playingAudio, setPlayingAudio }: {
    word: VocabularyWord;
    editingId: number | null;
    editData: { arabic: string; english: string; order: number } | null;
    isPending: boolean;
    deletingId: number | null;
    onEdit: (word: VocabularyWord) => void;
    onCancel: () => void;
    onSave: (wordId: number) => void;
    onDeleteClick: (wordId: number) => void;
    onDeleteConfirm: (wordId: number) => void;
    onCancelDelete: () => void;
    setEditData: (data: { arabic: string; english: string; order: number } | null) => void;
    playingAudio: string | null;
    setPlayingAudio: (key: string | null) => void;
}) {
    const handlePlayArabic = () => {
        const audioKey = `arabic-${word.id}`;
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
        } else {
            setPlayingAudio(audioKey);
            playAudio(word.arabic, "ar-SA", () => {
                setPlayingAudio(null);
            });
        }
    };

    const handlePlayEnglish = () => {
        const audioKey = `english-${word.id}`;
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
        } else {
            setPlayingAudio(audioKey);
            playAudio(word.english, "en-US", () => {
                setPlayingAudio(null);
            });
        }
    };

    const isPlayingArabic = playingAudio === `arabic-${word.id}`;
    const isPlayingEnglish = playingAudio === `english-${word.id}`;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: word.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-slate-50 transition-colors ${isDragging ? "bg-slate-100" : ""}`}
        >
            <td className="px-6 py-4 w-12">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1"
                    title="Drag to reorder"
                >
                    <GripVertical className="w-5 h-5" />
                </button>
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
                    <div className="flex items-center gap-2" dir="rtl">
                        <div className="font-medium text-slate-900 text-lg flex-1">{word.arabic}</div>
                        <button
                            onClick={handlePlayArabic}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Play Arabic audio"
                        >
                            {isPlayingArabic ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Volume2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
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
                    <div className="flex items-center gap-2">
                        <div className="text-slate-600 flex-1">{word.english}</div>
                        <button
                            onClick={handlePlayEnglish}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Play English audio"
                        >
                            {isPlayingEnglish ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Volume2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                {editingId === word.id ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => onSave(word.id)}
                            disabled={isPending}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Save"
                        >
                            <Save className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onCancel}
                            disabled={isPending}
                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Cancel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-2">
                        <DeleteConfirmation
                            isDeleting={deletingId === word.id}
                            onConfirm={() => onDeleteConfirm(word.id)}
                            onCancel={onCancelDelete}
                            isPending={isPending}
                        />
                        {deletingId !== word.id && (
                            <>
                                <button
                                    onClick={() => onEdit(word)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDeleteClick(word.id)}
                                    disabled={isPending}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
}

export function VocabularyManagement({ initialWords, lessonId, lessonTitle }: { initialWords: VocabularyWord[]; lessonId: number; lessonTitle: string }) {
    const [words, setWords] = useState(initialWords);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<{ arabic: string; english: string; order: number } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newWord, setNewWord] = useState({ arabic: "", english: "", order: words.length });
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isMounted, setIsMounted] = useState(false);
    const [playingAudio, setPlayingAudio] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Set mounted state to prevent hydration mismatch with @dnd-kit
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Load available models on mount
    useEffect(() => {
        async function loadModels() {
            try {
                setIsLoadingModels(true);
                const models = await getAvailableModelsForUsersAction();
                setAvailableModels(models);
                
                if (models.length > 0) {
                    const defaultModel = await getDefaultModelAction();
                    if (defaultModel && models.includes(defaultModel)) {
                        setSelectedModel(defaultModel);
                    } else {
                        setSelectedModel(models[0]);
                    }
                }
            } catch (error) {
                console.error("Failed to load models:", error);
            } finally {
                setIsLoadingModels(false);
            }
        }
        loadModels();
    }, []);
    
    // Image upload states
    const [isUploading, setIsUploading] = useState(false);
    const [parsedWords, setParsedWords] = useState<Array<{ arabic: string; english: string }> | null>(null);
    const [duplicates, setDuplicates] = useState<Array<{ arabic: string; english: string }> | null>(null);
    const [showParsedWords, setShowParsedWords] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // AI model selection states
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [customPrompt, setCustomPrompt] = useState<string>("");
    const [showUploadOptions, setShowUploadOptions] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(true);

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

    const handleDeleteClick = (wordId: number) => {
        setDeletingId(wordId);
    };

    const handleCancelDelete = () => {
        setDeletingId(null);
    };

    const handleDelete = async (wordId: number) => {
        startTransition(async () => {
            try {
                await deleteVocabularyWord(wordId);
                setWords(words.filter(w => w.id !== wordId));
                setDeletingId(null);
            } catch (error) {
                console.error("Failed to delete vocabulary word:", error);
                alert("Failed to delete vocabulary word. Please try again.");
                setDeletingId(null);
            }
        });
    };

    // Helper function to resize image to maximum 800px height
    const resizeImage = (file: File, maxHeight: number = 800): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Calculate new dimensions maintaining aspect ratio
                    let newWidth = img.width;
                    let newHeight = img.height;

                    if (img.height > maxHeight) {
                        const ratio = maxHeight / img.height;
                        newHeight = maxHeight;
                        newWidth = img.width * ratio;
                    }

                    // Create canvas and resize
                    const canvas = document.createElement("canvas");
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject(new Error("Failed to get canvas context"));
                        return;
                    }

                    // Draw resized image
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);

                    // Convert to blob
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error("Failed to create blob"));
                                return;
                            }
                            // Create a new File object with the same name and type
                            const resizedFile = new File([blob], file.name, {
                                type: file.type,
                                lastModified: Date.now(),
                            });
                            resolve(resizedFile);
                        },
                        file.type,
                        0.9 // Quality (0.9 = 90% quality)
                    );
                };
                img.onerror = () => reject(new Error("Failed to load image"));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setUploadError("Please select an image file");
            return;
        }

        try {
            // Resize image to max 800px height before setting it
            setUploadProgress("Resizing image...");
            const resizedFile = await resizeImage(file, 800);
            setSelectedFile(resizedFile);
            setUploadError(null);
            setParsedWords(null);
            setDuplicates(null);
            setShowParsedWords(false);
            setUploadProgress("");
        } catch (error) {
            console.error("Error resizing image:", error);
            setUploadError("Failed to process image. Please try again.");
            setUploadProgress("");
        }
    };

    const handleStartParsing = async () => {
        if (!selectedFile || !selectedModel) {
            setUploadError("Please select an image and AI model");
            return;
        }

        setIsUploading(true);
        setUploadError(null);
        setParsedWords(null);
        setDuplicates(null);
        setShowParsedWords(false);
        setUploadProgress("Preparing image for analysis...");

        try {
            setUploadProgress("Converting image to base64...");
            const formData = new FormData();
            formData.append("image", selectedFile);
            formData.append("model", selectedModel);
            
            // Add custom prompt if provided
            if (customPrompt.trim()) {
                formData.append("customPrompt", customPrompt.trim());
            }
            
            // Add existing words for duplicate checking
            setUploadProgress("Checking for duplicates...");
            const existingWords = words.map(w => ({ arabic: w.arabic, english: w.english }));
            formData.append("existingWords", JSON.stringify(existingWords));

            setUploadProgress("Sending image to AI for analysis...");
            const response = await fetch("/api/admin/parse-vocabulary-image", {
                method: "POST",
                body: formData,
            });

            setUploadProgress("Processing AI response...");
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to parse image");
            }

            setUploadProgress("Extracting word pairs...");
            
            if (data.wordPairs && data.wordPairs.length > 0) {
                setParsedWords(data.wordPairs);
                setDuplicates(data.duplicates || []);
                setShowParsedWords(true);
                setUploadProgress(`Successfully extracted ${data.wordPairs.length} word pair${data.wordPairs.length !== 1 ? 's' : ''}${data.duplicates && data.duplicates.length > 0 ? ` (${data.duplicates.length} duplicate${data.duplicates.length !== 1 ? 's' : ''} excluded)` : ''}`);
            } else {
                if (data.duplicates && data.duplicates.length > 0) {
                    setUploadError(`No new word pairs found. All ${data.duplicates.length} word pairs in the image already exist in this lesson.`);
                    setUploadProgress(`Found ${data.duplicates.length} word pair${data.duplicates.length !== 1 ? 's' : ''}, but all already exist in this lesson.`);
                } else {
                    setUploadError("No word pairs found in the image. Please try another image.");
                    setUploadProgress("No word pairs detected in the image.");
                }
            }
        } catch (error) {
            console.error("Error parsing image:", error);
            setUploadError(error instanceof Error ? error.message : "Failed to parse image");
            setUploadProgress("Error occurred during processing.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleBulkAdd = async () => {
        if (!parsedWords || parsedWords.length === 0) return;

        startTransition(async () => {
            try {
                const created = await bulkAddVocabularyWords(lessonId, parsedWords);
                setWords([...words, ...created]);
                setParsedWords(null);
                setDuplicates(null);
                setShowParsedWords(false);
                setUploadError(null);
                setUploadProgress("");
                setSelectedFile(null);
                setShowUploadOptions(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            } catch (error) {
                console.error("Failed to bulk add vocabulary words:", error);
                alert("Failed to add vocabulary words. Please try again.");
            }
        });
    };

    const handleCancelParsed = () => {
        setParsedWords(null);
        setDuplicates(null);
        setShowParsedWords(false);
        setUploadError(null);
        setUploadProgress("");
        setSelectedFile(null);
        setShowUploadOptions(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = words.findIndex((word) => word.id === active.id);
            const newIndex = words.findIndex((word) => word.id === over.id);

            const newWords = arrayMove(words, oldIndex, newIndex);
            setWords(newWords);

            // Update order in database
            startTransition(async () => {
                try {
                    await updateVocabularyOrder(newWords.map((w) => w.id));
                } catch (error) {
                    console.error("Failed to update vocabulary order:", error);
                    alert("Failed to update vocabulary order. Please try again.");
                    // Revert on error
                    setWords(words);
                }
            });
        }
    };

    const handlePlayAllArabic = () => {
        if (words.length === 0) return;
        
        const audioKey = "play-all-arabic";
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
            return;
        }

        setPlayingAudio(audioKey);
        let currentIndex = 0;

        const playNext = () => {
            if (currentIndex >= words.length) {
                setPlayingAudio(null);
                return;
            }

            const word = words[currentIndex];
            playAudio(word.arabic, "ar-SA", () => {
                currentIndex++;
                // Small delay between words
                setTimeout(playNext, 300);
            });
        };

        playNext();
    };

    const handlePlayAllEnglish = () => {
        if (words.length === 0) return;
        
        const audioKey = "play-all-english";
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
            return;
        }

        setPlayingAudio(audioKey);
        let currentIndex = 0;

        const playNext = () => {
            if (currentIndex >= words.length) {
                setPlayingAudio(null);
                return;
            }

            const word = words[currentIndex];
            playAudio(word.english, "en-US", () => {
                currentIndex++;
                // Small delay between words
                setTimeout(playNext, 300);
            });
        };

        playNext();
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Vocabulary: {lessonTitle}</h2>
                    <p className="text-slate-500 mt-1">Manage Arabic-English word pairs</p>
                </div>
                {!isCreating && !showParsedWords && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {words.length > 0 && (
                            <>
                                <button
                                    onClick={handlePlayAllArabic}
                                    disabled={playingAudio === "play-all-arabic" || playingAudio === "play-all-english"}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Play all Arabic words"
                                >
                                    {playingAudio === "play-all-arabic" ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Playing...
                                        </>
                                    ) : (
                                        <>
                                            <Volume2 className="w-4 h-4" />
                                            Play All Arabic
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handlePlayAllEnglish}
                                    disabled={playingAudio === "play-all-arabic" || playingAudio === "play-all-english"}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Play all English words"
                                >
                                    {playingAudio === "play-all-english" ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Playing...
                                        </>
                                    ) : (
                                        <>
                                            <Volume2 className="w-4 h-4" />
                                            Play All English
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setShowUploadOptions(!showUploadOptions)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            title="AI Image Parser"
                        >
                            <Sparkles className="w-4 h-4" />
                            AI Image Parser
                        </button>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Word Pair
                        </button>
                    </div>
                )}
            </div>

            {showUploadOptions && !showParsedWords && (
                <div className="p-6 mx-6 mt-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start gap-3 mb-4">
                        <Info className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-purple-900 mb-2">AI Image Parser</h3>
                            <p className="text-sm text-purple-700 mb-4">
                                Upload an image of a vocabulary page from an Arabic textbook. The AI will automatically extract Arabic-English word pairs from the image.
                            </p>
                            <div className="space-y-2 text-sm text-purple-700 mb-4">
                                <p className="font-medium">How it works:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Upload a clear image of a vocabulary page with a <strong>two-column layout</strong></li>
                                    <li>The AI extracts word pairs from <strong>both columns</strong> (not just the first one)</li>
                                    <li>Duplicate words already in this lesson are automatically filtered out</li>
                                    <li>You can review and edit extracted words before adding them</li>
                                </ul>
                                <p className="mt-3 font-medium">Best results:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Use clear, high-resolution images</li>
                                    <li>Ensure text is readable and not blurry</li>
                                    <li>Pages with standard two-column vocabulary layouts work best</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-purple-900 mb-2">
                                Upload Image *
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                disabled={isUploading}
                                className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                            {selectedFile && (
                                <p className="text-xs text-purple-600 mt-1">
                                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                </p>
                            )}
                            <p className="text-xs text-purple-600 mt-1">
                                Select an image file containing vocabulary words in a two-column layout.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-purple-900 mb-2">
                                AI Model * {isLoadingModels && <span className="text-purple-500 text-xs">(Loading...)</span>}
                            </label>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={isLoadingModels || availableModels.length === 0 || isUploading}
                                className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                                {availableModels.length === 0 ? (
                                    <option value="">No models available</option>
                                ) : (
                                    availableModels.map((model) => (
                                        <option key={model} value={model}>
                                            {model}
                                        </option>
                                    ))
                                )}
                            </select>
                            <p className="text-xs text-purple-600 mt-1">
                                Select the AI model to use for parsing. Different models may have varying accuracy and speed.
                            </p>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-purple-900 mb-2">
                                Custom Prompt (Optional)
                            </label>
                            <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="Leave empty to use default prompt, or provide custom instructions for the AI..."
                                rows={4}
                                disabled={isUploading}
                                className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                            <p className="text-xs text-purple-600 mt-1">
                                Provide custom instructions to modify how the AI extracts word pairs. Leave empty to use the default prompt optimized for two-column vocabulary pages.
                            </p>
                        </div>

                        {isUploading && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-3 mb-2">
                                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                    <span className="font-medium text-blue-900">Processing...</span>
                                </div>
                                <p className="text-sm text-blue-700 ml-8">{uploadProgress}</p>
                            </div>
                        )}

                        {!isUploading && uploadProgress && (
                            <div className={`p-4 border rounded-lg ${
                                uploadError 
                                    ? "bg-red-50 border-red-200" 
                                    : "bg-emerald-50 border-emerald-200"
                            }`}>
                                <div className="flex items-center gap-3">
                                    {uploadError ? (
                                        <X className="w-5 h-5 text-red-600" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    )}
                                    <p className={`text-sm ${uploadError ? "text-red-700" : "text-emerald-700"}`}>
                                        {uploadProgress}
                                    </p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleStartParsing}
                            disabled={!selectedFile || !selectedModel || isUploading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed font-medium"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    Start AI Parsing
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {uploadError && (
                <div className="p-4 mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {uploadError}
                </div>
            )}

            {showParsedWords && parsedWords && (
                <div className="p-6 border-b border-slate-100 bg-purple-50">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                                Extracted Word Pairs ({parsedWords.length})
                            </h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Review the extracted word pairs below. You can edit them before adding.
                            </p>
                            {duplicates && duplicates.length > 0 && (
                                <p className="text-sm text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 inline-block">
                                    {duplicates.length} duplicate word pair{duplicates.length !== 1 ? 's' : ''} were found and excluded (already exist in this lesson).
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleBulkAdd}
                                disabled={isPending || parsedWords.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Add All ({parsedWords.length})
                            </button>
                            <button
                                onClick={handleCancelParsed}
                                disabled={isPending}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                            >
                                <X className="w-4 h-4 inline mr-2" />
                                Cancel
                            </button>
                        </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                        <table className="w-full">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Arabic</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">English</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {parsedWords.map((word, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={word.arabic}
                                                onChange={(e) => {
                                                    const updated = [...parsedWords];
                                                    updated[index].arabic = e.target.value;
                                                    setParsedWords(updated);
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                dir="rtl"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={word.english}
                                                onChange={(e) => {
                                                    const updated = [...parsedWords];
                                                    updated[index].english = e.target.value;
                                                    setParsedWords(updated);
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => {
                                                    const updated = parsedWords.filter((_, i) => i !== index);
                                                    setParsedWords(updated);
                                                    if (updated.length === 0) {
                                                        setShowParsedWords(false);
                                                    }
                                                }}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
                ) : !isMounted ? (
                    // Render without drag-and-drop during SSR to prevent hydration mismatch
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-12"></th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Arabic</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">English</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {words.map((word) => (
                                <VocabularyRow
                                    key={word.id}
                                    word={word}
                                    editingId={editingId}
                                    editData={editData}
                                    isPending={isPending}
                                    deletingId={deletingId}
                                    onEdit={handleEdit}
                                    onCancel={handleCancel}
                                    onSave={handleSave}
                                    onDeleteClick={handleDeleteClick}
                                    onDeleteConfirm={handleDelete}
                                    onCancelDelete={handleCancelDelete}
                                    setEditData={setEditData}
                                    playingAudio={playingAudio}
                                    setPlayingAudio={setPlayingAudio}
                                />
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-12"></th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Arabic</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">English</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <SortableContext items={words.map(w => w.id)} strategy={verticalListSortingStrategy}>
                                    {words.map((word) => (
                                        <SortableVocabularyRow
                                            key={word.id}
                                            word={word}
                                            editingId={editingId}
                                            editData={editData}
                                            isPending={isPending}
                                            deletingId={deletingId}
                                            onEdit={handleEdit}
                                            onCancel={handleCancel}
                                            onSave={handleSave}
                                            onDeleteClick={handleDeleteClick}
                                            onDeleteConfirm={handleDelete}
                                            onCancelDelete={handleCancelDelete}
                                            setEditData={setEditData}
                                            playingAudio={playingAudio}
                                            setPlayingAudio={setPlayingAudio}
                                        />
                                    ))}
                                </SortableContext>
                            </tbody>
                        </table>
                    </DndContext>
                )}
            </div>
        </div>
    );
}

