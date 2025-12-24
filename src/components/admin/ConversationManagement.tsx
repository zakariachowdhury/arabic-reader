"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { ConversationSentence } from "@/db/schema";
import { addConversationSentence, updateConversationSentence, deleteConversationSentence, bulkAddConversationSentences, updateConversationOrder } from "@/app/admin/actions";
import { getAvailableModelsForUsersAction, getDefaultModelAction } from "@/app/actions";
import { Edit2, Trash2, Save, X, Plus, Upload, Loader2, CheckCircle2, GripVertical, Info, Sparkles, Volume2 } from "lucide-react";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { useArabicFontSize } from "@/contexts/ArabicFontSizeContext";
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

function ConversationRow({ sentence, editingId, editData, isPending, deletingId, onEdit, onCancel, onSave, onDeleteClick, onDeleteConfirm, onCancelDelete, setEditData, playingAudio, setPlayingAudio }: {
    sentence: ConversationSentence;
    editingId: number | null;
    editData: { arabic: string; english: string | null; order: number } | null;
    isPending: boolean;
    deletingId: number | null;
    onEdit: (sentence: ConversationSentence) => void;
    onCancel: () => void;
    onSave: (sentenceId: number) => void;
    onDeleteClick: (sentenceId: number) => void;
    onDeleteConfirm: (sentenceId: number) => void;
    onCancelDelete: () => void;
    setEditData: (data: { arabic: string; english: string | null; order: number } | null) => void;
    playingAudio: string | null;
    setPlayingAudio: (key: string | null) => void;
}) {
    const { getArabicFontSize } = useArabicFontSize();
    const handlePlayArabic = () => {
        const audioKey = `arabic-${sentence.id}`;
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
        } else {
            setPlayingAudio(audioKey);
            playAudio(sentence.arabic, "ar-SA", () => {
                setPlayingAudio(null);
            });
        }
    };

    const handlePlayEnglish = () => {
        if (!sentence.english) return;
        const audioKey = `english-${sentence.id}`;
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
        } else {
            setPlayingAudio(audioKey);
            playAudio(sentence.english, "en-US", () => {
                setPlayingAudio(null);
            });
        }
    };

    const isPlayingArabic = playingAudio === `arabic-${sentence.id}`;
    const isPlayingEnglish = playingAudio === `english-${sentence.id}`;

    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="px-6 py-4">
                {editingId === sentence.id ? (
                    <input
                        type="text"
                        value={editData?.arabic || ""}
                        onChange={(e) => setEditData({ ...editData!, arabic: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        dir="rtl"
                    />
                ) : (
                    <div className="flex items-center gap-2" dir="rtl">
                        <div className="font-medium text-slate-900 flex-1" style={{ fontSize: getArabicFontSize("text-lg") }}>{sentence.arabic}</div>
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
                {editingId === sentence.id ? (
                    <input
                        type="text"
                        value={editData?.english || ""}
                        onChange={(e) => setEditData({ ...editData!, english: e.target.value || null })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="English translation (optional)"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="text-slate-600 flex-1">{sentence.english || <span className="text-slate-400 italic">No translation</span>}</div>
                        {sentence.english && (
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
                        )}
                    </div>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                {editingId === sentence.id ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => onSave(sentence.id)}
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
                            isDeleting={deletingId === sentence.id}
                            onConfirm={() => onDeleteConfirm(sentence.id)}
                            onCancel={onCancelDelete}
                            isPending={isPending}
                        />
                        {deletingId !== sentence.id && (
                            <>
                                <button
                                    onClick={() => onEdit(sentence)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDeleteClick(sentence.id)}
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

function SortableConversationRow({ sentence, editingId, editData, isPending, deletingId, onEdit, onCancel, onSave, onDeleteClick, onDeleteConfirm, onCancelDelete, setEditData, playingAudio, setPlayingAudio }: {
    sentence: ConversationSentence;
    editingId: number | null;
    editData: { arabic: string; english: string | null; order: number } | null;
    isPending: boolean;
    deletingId: number | null;
    onEdit: (sentence: ConversationSentence) => void;
    onCancel: () => void;
    onSave: (sentenceId: number) => void;
    onDeleteClick: (sentenceId: number) => void;
    onDeleteConfirm: (sentenceId: number) => void;
    onCancelDelete: () => void;
    setEditData: (data: { arabic: string; english: string | null; order: number } | null) => void;
    playingAudio: string | null;
    setPlayingAudio: (key: string | null) => void;
}) {
    const { getArabicFontSize } = useArabicFontSize();
    const handlePlayArabic = () => {
        const audioKey = `arabic-${sentence.id}`;
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
        } else {
            setPlayingAudio(audioKey);
            playAudio(sentence.arabic, "ar-SA", () => {
                setPlayingAudio(null);
            });
        }
    };

    const handlePlayEnglish = () => {
        if (!sentence.english) return;
        const audioKey = `english-${sentence.id}`;
        if (playingAudio === audioKey) {
            window.speechSynthesis?.cancel();
            setPlayingAudio(null);
        } else {
            setPlayingAudio(audioKey);
            playAudio(sentence.english, "en-US", () => {
                setPlayingAudio(null);
            });
        }
    };

    const isPlayingArabic = playingAudio === `arabic-${sentence.id}`;
    const isPlayingEnglish = playingAudio === `english-${sentence.id}`;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sentence.id });

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
                <div className="text-slate-400 p-1 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                    <GripVertical className="w-5 h-5" />
                </div>
            </td>
            <td className="px-6 py-4">
                {editingId === sentence.id ? (
                    <input
                        type="text"
                        value={editData?.arabic || ""}
                        onChange={(e) => setEditData({ ...editData!, arabic: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        dir="rtl"
                    />
                ) : (
                    <div className="flex items-center gap-2" dir="rtl">
                        <div className="font-medium text-slate-900 flex-1" style={{ fontSize: getArabicFontSize("text-lg") }}>{sentence.arabic}</div>
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
                {editingId === sentence.id ? (
                    <input
                        type="text"
                        value={editData?.english || ""}
                        onChange={(e) => setEditData({ ...editData!, english: e.target.value || null })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="English translation (optional)"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="text-slate-600 flex-1">{sentence.english || <span className="text-slate-400 italic">No translation</span>}</div>
                        {sentence.english && (
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
                        )}
                    </div>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                {editingId === sentence.id ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => onSave(sentence.id)}
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
                            isDeleting={deletingId === sentence.id}
                            onConfirm={() => onDeleteConfirm(sentence.id)}
                            onCancel={onCancelDelete}
                            isPending={isPending}
                        />
                        {deletingId !== sentence.id && (
                            <>
                                <button
                                    onClick={() => onEdit(sentence)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDeleteClick(sentence.id)}
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

export function ConversationManagement({ initialSentences, lessonId, lessonTitle }: { initialSentences: ConversationSentence[]; lessonId: number; lessonTitle: string }) {
    const [sentences, setSentences] = useState(initialSentences);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<{ arabic: string; english: string | null; order: number } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newSentence, setNewSentence] = useState({ arabic: "", english: "", order: sentences.length });
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
    const [parsedSentences, setParsedSentences] = useState<Array<{ arabic: string; english?: string }> | null>(null);
    const [duplicates, setDuplicates] = useState<Array<{ arabic: string; english?: string }> | null>(null);
    const [showParsedSentences, setShowParsedSentences] = useState(false);
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

    const handleEdit = (sentence: ConversationSentence) => {
        setEditingId(sentence.id);
        setEditData({
            arabic: sentence.arabic,
            english: sentence.english,
            order: sentence.order,
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData(null);
        setIsCreating(false);
        setNewSentence({ arabic: "", english: "", order: sentences.length });
    };

    const handleSave = async (sentenceId: number) => {
        if (!editData) return;

        startTransition(async () => {
            try {
                await updateConversationSentence(sentenceId, {
                    arabic: editData.arabic,
                    english: editData.english,
                    order: editData.order,
                });
                setSentences(sentences.map(s => 
                    s.id === sentenceId 
                        ? { ...s, ...editData }
                        : s
                ));
                setEditingId(null);
                setEditData(null);
            } catch (error) {
                console.error("Failed to update conversation sentence:", error);
                alert("Failed to update conversation sentence. Please try again.");
            }
        });
    };

    const handleCreate = async () => {
        if (!newSentence.arabic.trim()) {
            alert("Arabic text is required");
            return;
        }

        startTransition(async () => {
            try {
                const created = await addConversationSentence(lessonId, {
                    arabic: newSentence.arabic,
                    english: newSentence.english || undefined,
                    order: newSentence.order,
                });
                setSentences([...sentences, created]);
                setIsCreating(false);
                setNewSentence({ arabic: "", english: "", order: sentences.length + 1 });
            } catch (error) {
                console.error("Failed to add conversation sentence:", error);
                alert("Failed to add conversation sentence. Please try again.");
            }
        });
    };

    const handleDeleteClick = (sentenceId: number) => {
        setDeletingId(sentenceId);
    };

    const handleCancelDelete = () => {
        setDeletingId(null);
    };

    const handleDelete = async (sentenceId: number) => {
        startTransition(async () => {
            try {
                await deleteConversationSentence(sentenceId);
                setSentences(sentences.filter(s => s.id !== sentenceId));
                setDeletingId(null);
            } catch (error) {
                console.error("Failed to delete conversation sentence:", error);
                alert("Failed to delete conversation sentence. Please try again.");
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setUploadError("Please select an image file");
            return;
        }

        try {
            setUploadError(null);
            setUploadProgress("Resizing image for optimal processing...");
            const resizedFile = await resizeImage(file);
            setSelectedFile(resizedFile);
            setUploadProgress("");
        } catch (error) {
            console.error("Error resizing image:", error);
            setUploadError("Failed to process image. Please try another file.");
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
        setParsedSentences(null);
        setDuplicates(null);
        setShowParsedSentences(false);
        setUploadProgress("Preparing image for analysis...");

        try {
            setUploadProgress("Converting image to base64...");
            const formData = new FormData();
            formData.append("image", selectedFile);
            formData.append("model", selectedModel);
            formData.append("lessonId", lessonId.toString());
            
            // Add custom prompt if provided
            if (customPrompt.trim()) {
                formData.append("customPrompt", customPrompt.trim());
            }
            
            // Add existing sentences for duplicate checking
            setUploadProgress("Checking for duplicates...");
            const existingSentences = sentences.map(s => ({ arabic: s.arabic, english: s.english || undefined }));
            formData.append("existingSentences", JSON.stringify(existingSentences));

            setUploadProgress("Sending image to AI for analysis...");
            const response = await fetch("/api/admin/parse-conversation-image", {
                method: "POST",
                body: formData,
            });

            setUploadProgress("Processing AI response...");
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to parse image");
            }

            setUploadProgress("Extracting sentences...");
            
            if (data.sentences && data.sentences.length > 0) {
                setParsedSentences(data.sentences);
                setDuplicates(data.duplicates || []);
                setShowParsedSentences(true);
                setUploadProgress(`Successfully extracted ${data.sentences.length} sentence${data.sentences.length !== 1 ? 's' : ''} from the image.`);
            } else {
                if (data.duplicates && data.duplicates.length > 0) {
                    setUploadProgress(`Found ${data.duplicates.length} sentence${data.duplicates.length !== 1 ? 's' : ''}, but all already exist in this lesson.`);
                } else {
                    setUploadError("No sentences found in the image. Please try another image.");
                    setUploadProgress("No sentences detected in the image.");
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
        if (!parsedSentences || parsedSentences.length === 0) return;

        startTransition(async () => {
            try {
                const created = await bulkAddConversationSentences(lessonId, parsedSentences);
                setSentences([...sentences, ...created]);
                setParsedSentences(null);
                setDuplicates(null);
                setShowParsedSentences(false);
                setUploadError(null);
                setUploadProgress("");
                setSelectedFile(null);
                setShowUploadOptions(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            } catch (error) {
                console.error("Failed to bulk add conversation sentences:", error);
                alert("Failed to add conversation sentences. Please try again.");
            }
        });
    };

    const handleCancelParsed = () => {
        setParsedSentences(null);
        setDuplicates(null);
        setShowParsedSentences(false);
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
            const oldIndex = sentences.findIndex((sentence) => sentence.id === active.id);
            const newIndex = sentences.findIndex((sentence) => sentence.id === over.id);

            const newSentences = arrayMove(sentences, oldIndex, newIndex);
            setSentences(newSentences);

            // Update order in database
            startTransition(async () => {
                try {
                    await updateConversationOrder(newSentences.map((s) => s.id));
                } catch (error) {
                    console.error("Failed to update conversation order:", error);
                    alert("Failed to update conversation order. Please try again.");
                    // Revert on error
                    setSentences(sentences);
                }
            });
        }
    };

    if (!isMounted) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                <div className="text-center text-slate-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Conversation: {lessonTitle}</h2>
                    <p className="text-slate-500 mt-1">Manage Arabic conversation sentences with optional English translations</p>
                </div>
                {!isCreating && !showParsedSentences && (
                    <div className="flex items-center gap-2 flex-wrap">
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
                            Add Sentence
                        </button>
                    </div>
                )}
            </div>

            {showUploadOptions && !showParsedSentences && (
                <div className="p-6 mx-6 mt-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start gap-3 mb-4">
                        <Info className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-purple-900 mb-2">AI Image Parser</h3>
                            <p className="text-sm text-purple-700 mb-4">
                                Upload an image of a conversation page from an Arabic textbook. The AI will automatically extract Arabic sentences and English translations from the image, using vocabulary from this unit to improve translation accuracy.
                            </p>
                            <div className="space-y-2 text-sm text-purple-700 mb-4">
                                <p className="font-medium">How it works:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Upload a clear image of a conversation page with a <strong>two-column layout</strong></li>
                                    <li>The AI extracts sentences from <strong>both columns</strong> (left and right)</li>
                                    <li>English translations are extracted if visible, or generated using unit vocabulary</li>
                                    <li>Duplicate sentences already in this lesson are automatically filtered out</li>
                                    <li>You can review and edit extracted sentences before adding them</li>
                                </ul>
                                <p className="mt-3 font-medium">Best results:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Use clear, high-resolution images</li>
                                    <li>Ensure text is readable and not blurry</li>
                                    <li>Pages with standard two-column conversation layouts work best</li>
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
                                Select an image file containing conversation sentences in a two-column layout.
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
                                Provide custom instructions to modify how the AI extracts sentences. Leave empty to use the default prompt optimized for two-column conversation pages.
                            </p>
                        </div>

                        {isUploading && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-3 mb-2">
                                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                    <span className="text-blue-900 font-medium">Processing image...</span>
                                </div>
                                <p className="text-sm text-blue-700">{uploadProgress}</p>
                            </div>
                        )}

                        {uploadError && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{uploadError}</p>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleStartParsing}
                                disabled={!selectedFile || !selectedModel || isUploading || isLoadingModels}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Parsing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Parse Image
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowUploadOptions(false);
                                    setSelectedFile(null);
                                    setUploadError(null);
                                    setUploadProgress("");
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = "";
                                    }
                                }}
                                disabled={isUploading}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showParsedSentences && parsedSentences && (
                <div className="p-6 mx-6 mt-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-start gap-3 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-emerald-900 mb-2">
                                Extracted {parsedSentences.length} Sentence{parsedSentences.length !== 1 ? 's' : ''}
                            </h3>
                            {duplicates && duplicates.length > 0 && (
                                <p className="text-sm text-emerald-700 mb-4">
                                    {duplicates.length} duplicate sentence{duplicates.length !== 1 ? 's' : ''} were filtered out.
                                </p>
                            )}
                            <p className="text-sm text-emerald-700 mb-4">
                                Review the extracted sentences below. You can edit them before adding to the lesson.
                            </p>
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto mb-4">
                        <table className="w-full text-left">
                            <thead className="bg-emerald-100 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-emerald-900 font-semibold">Arabic</th>
                                    <th className="px-4 py-2 text-emerald-900 font-semibold">English (Optional)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedSentences.map((sentence, index) => (
                                    <tr key={index} className="border-b border-emerald-200">
                                        <td className="px-4 py-2" dir="rtl">
                                            <div className="font-medium text-slate-900">{sentence.arabic}</div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="text-slate-600">{sentence.english || <span className="text-slate-400 italic">No translation</span>}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBulkAdd}
                            disabled={isPending || parsedSentences.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            Add All Sentences
                        </button>
                        <button
                            onClick={handleCancelParsed}
                            disabled={isPending}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {isCreating && (
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Sentence</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Arabic *</label>
                            <input
                                type="text"
                                value={newSentence.arabic}
                                onChange={(e) => setNewSentence({ ...newSentence, arabic: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                dir="rtl"
                                placeholder="Arabic sentence"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">English Translation (Optional)</label>
                            <input
                                type="text"
                                value={newSentence.english}
                                onChange={(e) => setNewSentence({ ...newSentence, english: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="English translation"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={isPending || !newSentence.arabic.trim()}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                Add Sentence
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {sentences.length === 0 && !isCreating && !showParsedSentences ? (
                <div className="p-12 text-center">
                    <p className="text-slate-500 text-lg mb-4">No conversation sentences yet.</p>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add First Sentence
                    </button>
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12"></th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Arabic</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">English Translation</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                <SortableContext items={sentences.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                    {sentences.map((sentence) => (
                                        <SortableConversationRow
                                            key={sentence.id}
                                            sentence={sentence}
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
                    </div>
                </DndContext>
            )}
        </div>
    );
}

