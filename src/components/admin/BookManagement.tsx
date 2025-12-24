"use client";

import { useState, useTransition } from "react";
import { Book } from "@/db/schema";
import { createBook, updateBook, deleteBook, updateBookOrder } from "@/app/admin/actions";
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

function SortableBookRow({ book, editingId, editData, isPending, deletingId, onEdit, onCancel, onSave, onDeleteClick, onDeleteConfirm, onCancelDelete, setEditData }: {
    book: Book;
    editingId: number | null;
    editData: { title: string; description: string } | null;
    isPending: boolean;
    deletingId: number | null;
    onEdit: (book: Book) => void;
    onCancel: () => void;
    onSave: (bookId: number) => void;
    onDeleteClick: (bookId: number) => void;
    onDeleteConfirm: (bookId: number) => void;
    onCancelDelete: () => void;
    setEditData: (data: { title: string; description: string } | null) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: book.id });

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
                {editingId === book.id ? (
                    <input
                        type="text"
                        value={editData?.title || ""}
                        onChange={(e) => setEditData({ ...editData!, title: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                ) : (
                    <Link
                        href={`/admin/books/${book.id}/units`}
                        className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        {book.title}
                    </Link>
                )}
            </td>
            <td className="px-6 py-4">
                {editingId === book.id ? (
                    <textarea
                        value={editData?.description || ""}
                        onChange={(e) => setEditData({ ...editData!, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                    />
                ) : (
                    <div className="text-slate-600 max-w-md">{book.description || <span className="text-slate-400">No description</span>}</div>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {new Date(book.createdAt).toLocaleDateString()}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                {editingId === book.id ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => onSave(book.id)}
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
                            isDeleting={deletingId === book.id}
                            onConfirm={() => onDeleteConfirm(book.id)}
                            onCancel={onCancelDelete}
                            isPending={isPending}
                        />
                        {deletingId !== book.id && (
                            <>
                                <Link
                                    href={`/admin/books/${book.id}/units`}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Manage Units"
                                >
                                    <BookOpen className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={() => onEdit(book)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDeleteClick(book.id)}
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

export function BookManagement({ initialBooks }: { initialBooks: Book[] }) {
    const [books, setBooks] = useState(initialBooks);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<{ title: string; description: string } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newBook, setNewBook] = useState({ title: "", description: "" });
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleEdit = (book: Book) => {
        setEditingId(book.id);
        setEditData({
            title: book.title,
            description: book.description || "",
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData(null);
        setIsCreating(false);
        setNewBook({ title: "", description: "" });
    };

    const handleSave = async (bookId: number) => {
        if (!editData) return;

        startTransition(async () => {
            try {
                await updateBook(bookId, {
                    title: editData.title,
                    description: editData.description || null,
                });
                setBooks(books.map(b => 
                    b.id === bookId 
                        ? { ...b, ...editData, updatedAt: new Date() }
                        : b
                ));
                setEditingId(null);
                setEditData(null);
            } catch (error) {
                console.error("Failed to update book:", error);
                alert("Failed to update book. Please try again.");
            }
        });
    };

    const handleCreate = async () => {
        if (!newBook.title.trim()) {
            alert("Title is required");
            return;
        }

        startTransition(async () => {
            try {
                const created = await createBook({
                    title: newBook.title,
                    description: newBook.description || null,
                });
                setBooks([...books, created]);
                setIsCreating(false);
                setNewBook({ title: "", description: "" });
            } catch (error) {
                console.error("Failed to create book:", error);
                alert("Failed to create book. Please try again.");
            }
        });
    };

    const handleDeleteClick = (bookId: number) => {
        setDeletingId(bookId);
    };

    const handleCancelDelete = () => {
        setDeletingId(null);
    };

    const handleDelete = async (bookId: number) => {
        startTransition(async () => {
            try {
                await deleteBook(bookId);
                setBooks(books.filter(b => b.id !== bookId));
                setDeletingId(null);
            } catch (error) {
                console.error("Failed to delete book:", error);
                alert("Failed to delete book. Please try again.");
                setDeletingId(null);
            }
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = books.findIndex((book) => book.id === active.id);
            const newIndex = books.findIndex((book) => book.id === over.id);

            const newBooks = arrayMove(books, oldIndex, newIndex);
            setBooks(newBooks);

            // Update order in database
            startTransition(async () => {
                try {
                    await updateBookOrder(newBooks.map((b) => b.id));
                } catch (error) {
                    console.error("Failed to update book order:", error);
                    alert("Failed to update book order. Please try again.");
                    // Revert on error
                    setBooks(books);
                }
            });
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Book Management</h2>
                    <p className="text-slate-500 mt-1">Manage books in the Arabic Reader series</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Book
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Book</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                            <input
                                type="text"
                                value={newBook.title}
                                onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Book title"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                            <textarea
                                value={newBook.description}
                                onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Book description (optional)"
                                rows={3}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={isPending || !newBook.title.trim()}
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
                {books.length === 0 ? (
                    <div className="p-12 text-center">
                        <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No books yet. Create your first book to get started.</p>
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
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <SortableContext items={books.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                    {books.map((book) => (
                                        <SortableBookRow
                                            key={book.id}
                                            book={book}
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

