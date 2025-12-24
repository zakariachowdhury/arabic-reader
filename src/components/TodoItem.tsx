"use client";

import { toggleTodo, deleteTodo, updateTodo } from "@/app/actions";
import { GroupBadge, GroupSelector } from "@/components/GroupSelector";
import { type Group } from "@/db/schema";
import { Trash2, CheckCircle2, Circle, Pencil, X, Check } from "lucide-react";
import { useTransition, useState } from "react";
import { DeleteConfirmation } from "./admin/DeleteConfirmation";

type TodoWithGroup = {
    id: number;
    content: string;
    completed: boolean;
    userId: string;
    groupId: number | null;
    createdAt: Date;
    group: {
        id: number;
        name: string;
        color: string | null;
        description: string | null;
    } | null;
};

export function TodoItem({ todo, groups, showGroupBadge = true }: { todo: TodoWithGroup; groups: Group[]; showGroupBadge?: boolean }) {
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editContent, setEditContent] = useState(todo.content);
    const [editGroupId, setEditGroupId] = useState<number | null>(todo.groupId);

    const handleUpdate = () => {
        if (editContent.trim() === "" || (editContent === todo.content && editGroupId === todo.groupId)) {
            setIsEditing(false);
            setEditContent(todo.content);
            setEditGroupId(todo.groupId);
            return;
        }

        startTransition(async () => {
            await updateTodo(todo.id, editContent, editGroupId);
            setIsEditing(false);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleUpdate();
        } else if (e.key === "Escape") {
            setIsEditing(false);
            setEditContent(todo.content);
            setEditGroupId(todo.groupId);
        }
    };

    return (
        <div className={`group flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white transition-all hover:border-slate-200 hover:shadow-md hover:shadow-slate-100/50 ${isPending ? 'opacity-50 grayscale' : ''}`}>
            <div className="flex items-center gap-3 flex-1">
                <button
                    onClick={() => startTransition(() => toggleTodo(todo.id, !todo.completed))}
                    className={`transition-colors flex-shrink-0 ${todo.completed ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}`}
                    disabled={isEditing || isDeleting}
                >
                    {todo.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>

                {isEditing ? (
                    <div className="flex-1 flex flex-col gap-2">
                        <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                            autoFocus
                        />
                        {groups.length > 0 && (
                            <GroupSelector
                                groups={groups}
                                selectedGroupId={editGroupId}
                                onGroupChange={setEditGroupId}
                                className="w-full text-sm"
                            />
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center gap-2">
                        <span className={`text-slate-700 transition-all ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                            {todo.content}
                        </span>
                        {showGroupBadge && todo.group && <GroupBadge group={todo.group} />}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all ml-4">
                {isEditing ? (
                    <>
                        <button
                            onClick={handleUpdate}
                            className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all"
                            aria-label="Save edit"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setEditContent(todo.content);
                                setEditGroupId(todo.groupId);
                            }}
                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
                            aria-label="Cancel edit"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <>
                        <DeleteConfirmation
                            isDeleting={isDeleting}
                            onConfirm={() => startTransition(() => deleteTodo(todo.id))}
                            onCancel={() => setIsDeleting(false)}
                            isPending={isPending}
                        />
                        {!isDeleting && (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                    aria-label="Edit task"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setIsDeleting(true)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    aria-label="Delete task"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
