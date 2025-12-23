import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getAdminStats, getGlobalAIEnabled } from "./actions";
import Link from "next/link";
import { Users, CheckSquare, UserCheck, BarChart3, Palette, BookOpen } from "lucide-react";
import { GlobalAIToggle } from "@/components/admin/GlobalAIToggle";

export default async function AdminPage() {
    const admin = await isAdmin();

    if (!admin) {
        redirect("/");
    }

    const stats = await getAdminStats();
    const globalAIEnabled = await getGlobalAIEnabled();

    return (
        <main className="py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-2">
                        Admin Dashboard
                    </h1>
                    <p className="text-slate-500">Manage users and todos across the platform</p>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalUsers}</h3>
                        <p className="text-sm text-slate-500">Total Users</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-emerald-100 rounded-xl">
                                <CheckSquare className="w-6 h-6 text-emerald-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalTodos}</h3>
                        <p className="text-sm text-slate-500">Total Todos</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-purple-100 rounded-xl">
                                <BarChart3 className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.completedTodos}</h3>
                        <p className="text-sm text-slate-500">Completed Todos</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-pink-100 rounded-xl">
                                <Palette className="w-6 h-6 text-pink-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalGroups || 0}</h3>
                        <p className="text-sm text-slate-500">Total Groups</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-amber-100 rounded-xl">
                                <UserCheck className="w-6 h-6 text-amber-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalAdmins}</h3>
                        <p className="text-sm text-slate-500">Admin Users</p>
                    </div>
                </div>

                {/* Global AI Settings */}
                <div className="mb-10">
                    <GlobalAIToggle initialEnabled={globalAIEnabled} />
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Link
                        href="/admin/users"
                        className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 hover:shadow-xl transition-all hover:border-blue-200 group"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-4 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                                <Users className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
                                <p className="text-slate-500">Manage all users and permissions</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 mt-4">
                            View, edit, and delete user accounts. Manage admin permissions.
                        </p>
                    </Link>

                    <Link
                        href="/admin/todos"
                        className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 hover:shadow-xl transition-all hover:border-emerald-200 group"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-4 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                                <CheckSquare className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Todo Management</h2>
                                <p className="text-slate-500">Manage all todos across the platform</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 mt-4">
                            View, edit, and delete todos from any user.
                        </p>
                    </Link>

                    <Link
                        href="/admin/groups"
                        className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 hover:shadow-xl transition-all hover:border-pink-200 group"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-4 bg-pink-100 rounded-xl group-hover:bg-pink-200 transition-colors">
                                <Palette className="w-8 h-8 text-pink-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Group Management</h2>
                                <p className="text-slate-500">Manage all groups across the platform</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 mt-4">
                            View, edit, and delete groups from any user.
                        </p>
                    </Link>

                    <Link
                        href="/admin/books"
                        className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 hover:shadow-xl transition-all hover:border-indigo-200 group"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-4 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                                <BookOpen className="w-8 h-8 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Book Management</h2>
                                <p className="text-slate-500">Manage books, units, lessons, and vocabulary</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 mt-4">
                            Create and manage the Arabic Reader book series content.
                        </p>
                    </Link>
                </div>
            </div>
        </main>
    );
}

