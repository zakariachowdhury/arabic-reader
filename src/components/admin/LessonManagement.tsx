"use client";

import { useState, useTransition } from "react";
import { Lesson } from "@/db/schema";
import { createLesson, updateLesson, deleteLesson, updateLessonOrder } from "@/app/admin/actions";
import { Edit2, Trash2, Save, X, Plus, BookOpen, GripVertical } from "lucide-react";
import { DeleteConfirmation } from "./DeleteConfirmation";
import Link from "next/link";
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

function SortableLessonRow({ lesson, editingId, editData, isPending, deletingId, onEdit, onCancel, onSave, onDeleteClick, onDeleteConfirm, onCancelDelete, setEditData }: {
    lesson: Lesson;
    editingId: number | null;
    editData: { title: string; type: string; order: number } | null;
    isPending: boolean;
    deletingId: number | null;
    onEdit: (lesson: Lesson) => void;
    onCancel: () => void;
    onSave: (lessonId: number) => void;
    onDeleteClick: (lessonId: number) => void;
    onDeleteConfirm: (lessonId: number) => void;
    onCancelDelete: () => void;
    setEditData: (data: { title: string; type: string; order: number } | null) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lesson.id });

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
                {editingId === lesson.id ? (
                    <input
                        type="text"
                        value={editData?.title || ""}
                        onChange={(e) => setEditData({ ...editData!, title: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                ) : (
                    <div className="font-medium text-slate-900">
                        {lesson.type === "vocabulary" ? (
                            <Link
                                href={`/admin/lessons/${lesson.id}/vocabulary`}
                                className="text-blue-600 hover:text-blue-700 hover:underline"
                            >
                                {lesson.title}
                            </Link>
                        ) : (
                            lesson.title
                        )}
                    </div>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                {editingId === lesson.id ? (
                    <select
                        value={editData?.type || "vocabulary"}
                        onChange={(e) => setEditData({ ...editData!, type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="vocabulary">Vocabulary</option>
                        <option value="reading">Reading</option>
                        <option value="grammar">Grammar</option>
                        <option value="exercise">Exercise</option>
                    </select>
                ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 capitalize">
                        {lesson.type}
                    </span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {new Date(lesson.createdAt).toLocaleDateString()}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                {editingId === lesson.id ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => onSave(lesson.id)}
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
                            isDeleting={deletingId === lesson.id}
                            onConfirm={() => onDeleteConfirm(lesson.id)}
                            onCancel={onCancelDelete}
                            isPending={isPending}
                        />
                        {deletingId !== lesson.id && (
                            <>
                                {lesson.type === "vocabulary" && (
                                    <Link
                                        href={`/admin/lessons/${lesson.id}/vocabulary`}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Manage Vocabulary"
                                    >
                                        <BookOpen className="w-4 h-4" />
                                    </Link>
                                )}
                                <button
                                    onClick={() => onEdit(lesson)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDeleteClick(lesson.id)}
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

export function LessonManagement({ initialLessons, unitId, unitTitle }: { initialLessons: Lesson[]; unitId: number; unitTitle: string }) {
    const [lessons, setLessons] = useState(initialLessons);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<{ title: string; type: string; order: number } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newLesson, setNewLesson] = useState({ title: "", type: "vocabulary", order: lessons.length });
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleEdit = (lesson: Lesson) => {
        setEditingId(lesson.id);
        setEditData({
            title: lesson.title,
            type: lesson.type,
            order: lesson.order,
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData(null);
        setIsCreating(false);
        setNewLesson({ title: "", type: "vocabulary", order: lessons.length });
    };

    const handleSave = async (lessonId: number) => {
        if (!editData) return;

        startTransition(async () => {
            try {
                await updateLesson(lessonId, {
                    title: editData.title,
                    type: editData.type,
                    order: editData.order,
                });
                setLessons(lessons.map(l => 
                    l.id === lessonId 
                        ? { ...l, ...editData, updatedAt: new Date() }
                        : l
                ));
                setEditingId(null);
                setEditData(null);
            } catch (error) {
                console.error("Failed to update lesson:", error);
                alert("Failed to update lesson. Please try again.");
            }
        });
    };

    const handleCreate = async () => {
        if (!newLesson.title.trim()) {
            alert("Title is required");
            return;
        }

        startTransition(async () => {
            try {
                const created = await createLesson(unitId, {
                    title: newLesson.title,
                    type: newLesson.type,
                    order: newLesson.order,
                });
                setLessons([...lessons, created]);
                setIsCreating(false);
                setNewLesson({ title: "", type: "vocabulary", order: lessons.length + 1 });
            } catch (error) {
                console.error("Failed to create lesson:", error);
                alert("Failed to create lesson. Please try again.");
            }
        });
    };

    const handleDeleteClick = (lessonId: number) => {
        setDeletingId(lessonId);
    };

    const handleCancelDelete = () => {
        setDeletingId(null);
    };

    const handleDelete = async (lessonId: number) => {
        startTransition(async () => {
            try {
                await deleteLesson(lessonId);
                setLessons(lessons.filter(l => l.id !== lessonId));
                setDeletingId(null);
            } catch (error) {
                console.error("Failed to delete lesson:", error);
                alert("Failed to delete lesson. Please try again.");
                setDeletingId(null);
            }
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = lessons.findIndex((lesson) => lesson.id === active.id);
            const newIndex = lessons.findIndex((lesson) => lesson.id === over.id);

            const newLessons = arrayMove(lessons, oldIndex, newIndex);
            setLessons(newLessons);

            // Update order in database
            startTransition(async () => {
                try {
                    await updateLessonOrder(newLessons.map((l) => l.id));
                } catch (error) {
                    console.error("Failed to update lesson order:", error);
                    alert("Failed to update lesson order. Please try again.");
                    // Revert on error
                    setLessons(lessons);
                }
            });
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Lessons: {unitTitle}</h2>
                    <p className="text-slate-500 mt-1">Manage lessons for this unit</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Lesson
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Lesson</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                            <input
                                type="text"
                                value={newLesson.title}
                                onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Lesson title"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                            <select
                                value={newLesson.type}
                                onChange={(e) => setNewLesson({ ...newLesson, type: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="vocabulary">Vocabulary</option>
                                <option value="reading">Reading</option>
                                <option value="grammar">Grammar</option>
                                <option value="exercise">Exercise</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={isPending || !newLesson.title.trim()}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4 inline mr-2" />
                                Create
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
                {lessons.length === 0 ? (
                    <div className="p-12 text-center">
                        <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No lessons yet. Create your first lesson to get started.</p>
                    </div>
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
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <SortableContext items={lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                                    {lessons.map((lesson) => (
                                        <SortableLessonRow
                                            key={lesson.id}
                                            lesson={lesson}
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

