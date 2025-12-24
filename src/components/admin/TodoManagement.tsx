"use client";

import { useState, useTransition } from "react";
import { adminUpdateTodo, adminDeleteTodo } from "@/app/admin/actions";
import { GroupBadge } from "@/components/GroupSelector";
import { Edit2, Trash2, Save, X, CheckCircle2, Circle } from "lucide-react";
import { DeleteConfirmation } from "./DeleteConfirmation";

type TodoWithUser = {
    id: number;
    content: string;
    completed: boolean;
    userId: string;
    groupId: number | null;
    createdAt: Date;
    user: {
        name: string;
        email: string;
    } | null;
    group: {
        id: number;
        name: string;
        color: string | null;
    } | null;
};

export function TodoManagement({ initialTodos }: { initialTodos: TodoWithUser[] }) {
    const [todos, setTodos] = useState(initialTodos);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState<string>("");
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleEdit = (todo: TodoWithUser) => {
        setEditingId(todo.id);
        setEditContent(todo.content);
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditContent("");
    };

    const handleSave = async (todoId: number) => {
        if (!editContent.trim()) {
            alert("Todo content cannot be empty");
            return;
        }

        startTransition(async () => {
            try {
                await adminUpdateTodo(todoId, { content: editContent });
                setTodos(todos.map(t => 
                    t.id === todoId 
                        ? { ...t, content: editContent }
                        : t
                ));
                setEditingId(null);
                setEditContent("");
            } catch (error) {
                console.error("Failed to update todo:", error);
                alert("Failed to update todo. Please try again.");
            }
        });
    };

    const handleToggle = async (todoId: number, currentCompleted: boolean) => {
        startTransition(async () => {
            try {
                await adminUpdateTodo(todoId, { completed: !currentCompleted });
                setTodos(todos.map(t => 
                    t.id === todoId 
                        ? { ...t, completed: !currentCompleted }
                        : t
                ));
            } catch (error) {
                console.error("Failed to toggle todo:", error);
                alert("Failed to toggle todo. Please try again.");
            }
        });
    };

    const handleDeleteClick = (todoId: number) => {
        setDeletingId(todoId);
    };

    const handleCancelDelete = () => {
        setDeletingId(null);
    };

    const handleDelete = async (todoId: number) => {
        startTransition(async () => {
            try {
                await adminDeleteTodo(todoId);
                setTodos(todos.filter(t => t.id !== todoId));
                setDeletingId(null);
            } catch (error) {
                console.error("Failed to delete todo:", error);
                alert("Failed to delete todo. Please try again.");
                setDeletingId(null);
            }
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
                <h2 className="text-2xl font-bold text-slate-900">Todo Management</h2>
                <p className="text-slate-500 mt-1">Manage all todos across the platform</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Content</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Group</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {todos.map((todo) => (
                            <tr key={todo.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => handleToggle(todo.id, todo.completed)}
                                        disabled={isPending}
                                        className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                                        title={todo.completed ? "Mark as incomplete" : "Mark as complete"}
                                    >
                                        {todo.completed ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-slate-400" />
                                        )}
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    {editingId === todo.id ? (
                                        <input
                                            type="text"
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        />
                                    ) : (
                                        <div className={`${todo.completed ? "line-through text-slate-400" : "text-slate-900"}`}>
                                            {todo.content}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {todo.group ? (
                                        <GroupBadge group={{ id: todo.group.id, name: todo.group.name, color: todo.group.color }} />
                                    ) : (
                                        <span className="text-sm text-slate-400 italic">No group</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div>
                                        <div className="font-medium text-slate-900">{todo.user?.name || "Unknown"}</div>
                                        <div className="text-sm text-slate-500">{todo.user?.email || "N/A"}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {new Date(todo.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    {editingId === todo.id ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleSave(todo.id)}
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
                                            <DeleteConfirmation
                                                isDeleting={deletingId === todo.id}
                                                onConfirm={() => handleDelete(todo.id)}
                                                onCancel={handleCancelDelete}
                                                isPending={isPending}
                                            />
                                            {deletingId !== todo.id && (
                                                <>
                                                    <button
                                                        onClick={() => handleEdit(todo)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(todo.id)}
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
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

