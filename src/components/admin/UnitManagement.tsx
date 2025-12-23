"use client";

import { useState, useTransition } from "react";
import { Unit } from "@/db/schema";
import { createUnit, updateUnit, deleteUnit } from "@/app/admin/actions";
import { Edit2, Trash2, Save, X, Plus, BookOpen } from "lucide-react";
import Link from "next/link";

export function UnitManagement({ initialUnits, bookId, bookTitle }: { initialUnits: Unit[]; bookId: number; bookTitle: string }) {
    const [units, setUnits] = useState(initialUnits);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<{ title: string; order: number } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newUnit, setNewUnit] = useState({ title: "", order: units.length });
    const [isPending, startTransition] = useTransition();

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

    const handleDelete = async (unitId: number) => {
        if (!confirm("Are you sure you want to delete this unit? This will also delete all lessons and vocabulary words.")) {
            return;
        }

        startTransition(async () => {
            try {
                await deleteUnit(unitId);
                setUnits(units.filter(u => u.id !== unitId));
            } catch (error) {
                console.error("Failed to delete unit:", error);
                alert("Failed to delete unit. Please try again.");
            }
        });
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
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Order</label>
                            <input
                                type="number"
                                value={newUnit.order}
                                onChange={(e) => setNewUnit({ ...newUnit, order: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
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
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Order</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {units.map((unit) => (
                                <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === unit.id ? (
                                            <input
                                                type="number"
                                                value={editData?.order ?? 0}
                                                onChange={(e) => setEditData({ ...editData!, order: parseInt(e.target.value) || 0 })}
                                                className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                min="0"
                                            />
                                        ) : (
                                            <div className="text-slate-600 font-medium">{unit.order}</div>
                                        )}
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
                                                    onClick={() => handleSave(unit.id)}
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
                                                <Link
                                                    href={`/admin/units/${unit.id}/lessons`}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Manage Lessons"
                                                >
                                                    <BookOpen className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleEdit(unit)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(unit.id)}
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

