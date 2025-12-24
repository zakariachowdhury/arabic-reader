"use client";

import { useState, useTransition } from "react";
import { Unit } from "@/db/schema";
import { createUnit, updateUnit, deleteUnit, updateUnitOrder } from "@/app/admin/actions";
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

function SortableUnitRow({ unit, editingId, editData, isPending, deletingId, onEdit, onCancel, onSave, onDeleteClick, onDeleteConfirm, onCancelDelete, setEditData }: {
    unit: Unit;
    editingId: number | null;
    editData: { title: string; order: number } | null;
    isPending: boolean;
    deletingId: number | null;
    onEdit: (unit: Unit) => void;
    onCancel: () => void;
    onSave: (unitId: number) => void;
    onDeleteClick: (unitId: number) => void;
    onDeleteConfirm: (unitId: number) => void;
    onCancelDelete: () => void;
    setEditData: (data: { title: string; order: number } | null) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: unit.id });

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
                {editingId === unit.id ? (
                    <input
                        type="text"
                        value={editData?.title || ""}
                        onChange={(e) => setEditData({ ...editData!, title: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                ) : (
                    <Link
                        href={`/admin/units/${unit.id}/lessons`}
                        className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        {unit.title}
                    </Link>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {new Date(unit.createdAt).toLocaleDateString()}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                {editingId === unit.id ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => onSave(unit.id)}
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
                            isDeleting={deletingId === unit.id}
                            onConfirm={() => onDeleteConfirm(unit.id)}
                            onCancel={onCancelDelete}
                            isPending={isPending}
                        />
                        {deletingId !== unit.id && (
                            <>
                                <Link
                                    href={`/admin/units/${unit.id}/lessons`}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Manage Lessons"
                                >
                                    <BookOpen className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={() => onEdit(unit)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDeleteClick(unit.id)}
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

export function UnitManagement({ initialUnits, bookId, bookTitle }: { initialUnits: Unit[]; bookId: number; bookTitle: string }) {
    const [units, setUnits] = useState(initialUnits);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<{ title: string; order: number } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newUnit, setNewUnit] = useState({ title: "", order: units.length });
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleEdit = (unit: Unit) => {
        setEditingId(unit.id);
        setEditData({
            title: unit.title,
            order: unit.order,
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData(null);
        setIsCreating(false);
        setNewUnit({ title: "", order: units.length });
    };

    const handleSave = async (unitId: number) => {
        if (!editData) return;

        startTransition(async () => {
            try {
                await updateUnit(unitId, {
                    title: editData.title,
                    order: editData.order,
                });
                setUnits(units.map(u => 
                    u.id === unitId 
                        ? { ...u, ...editData, updatedAt: new Date() }
                        : u
                ));
                setEditingId(null);
                setEditData(null);
            } catch (error) {
                console.error("Failed to update unit:", error);
                alert("Failed to update unit. Please try again.");
            }
        });
    };

    const handleCreate = async () => {
        if (!newUnit.title.trim()) {
            alert("Title is required");
            return;
        }

        startTransition(async () => {
            try {
                const created = await createUnit(bookId, {
                    title: newUnit.title,
                    order: newUnit.order,
                });
                setUnits([...units, created]);
                setIsCreating(false);
                setNewUnit({ title: "", order: units.length + 1 });
            } catch (error) {
                console.error("Failed to create unit:", error);
                alert("Failed to create unit. Please try again.");
            }
        });
    };

    const handleDeleteClick = (unitId: number) => {
        setDeletingId(unitId);
    };

    const handleCancelDelete = () => {
        setDeletingId(null);
    };

    const handleDelete = async (unitId: number) => {
        startTransition(async () => {
            try {
                await deleteUnit(unitId);
                setUnits(units.filter(u => u.id !== unitId));
                setDeletingId(null);
            } catch (error) {
                console.error("Failed to delete unit:", error);
                alert("Failed to delete unit. Please try again.");
                setDeletingId(null);
            }
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = units.findIndex((unit) => unit.id === active.id);
            const newIndex = units.findIndex((unit) => unit.id === over.id);

            const newUnits = arrayMove(units, oldIndex, newIndex);
            setUnits(newUnits);

            // Update order in database
            startTransition(async () => {
                try {
                    await updateUnitOrder(newUnits.map((u) => u.id));
                } catch (error) {
                    console.error("Failed to update unit order:", error);
                    alert("Failed to update unit order. Please try again.");
                    // Revert on error
                    setUnits(units);
                }
            });
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Units: {bookTitle}</h2>
                    <p className="text-slate-500 mt-1">Manage units for this book</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Unit
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Unit</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                            <input
                                type="text"
                                value={newUnit.title}
                                onChange={(e) => setNewUnit({ ...newUnit, title: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Unit title"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={isPending || !newUnit.title.trim()}
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
                {units.length === 0 ? (
                    <div className="p-12 text-center">
                        <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No units yet. Create your first unit to get started.</p>
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
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <SortableContext items={units.map(u => u.id)} strategy={verticalListSortingStrategy}>
                                    {units.map((unit) => (
                                        <SortableUnitRow
                                            key={unit.id}
                                            unit={unit}
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

