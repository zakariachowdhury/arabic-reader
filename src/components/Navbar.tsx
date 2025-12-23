import Link from "next/link";
import { CheckCircle2, Github, Settings, Shield, BookOpen, CheckSquare } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { SignOutButton } from "./SignOutButton";
import { isAdmin } from "@/lib/admin";

export async function Navbar() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    const admin = session ? await isAdmin() : false;

    return (
        <nav className="bg-white sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                            <CheckCircle2 className="text-white w-5 h-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900">{process.env.NEXT_PUBLIC_APP_NAME || "TaskFlow"}</span>
                    </Link>
                    <a
                        href="https://github.com/zakariachowdhury/nextjs-todo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex items-center gap-2 text-sm text-slate-400 hover:text-slate-900 transition-colors"
                    >
                        <span className="font-medium">GitHub</span>
                    </a>
                </div>
                <div className="flex items-center gap-4">
                    {session ? (
                        <div className="flex items-center gap-6">
                            {/* Main Navigation */}
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/books"
                                    className="p-2.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all"
                                    title="Arabic Reader"
                                >
                                    <BookOpen size={20} />
                                </Link>
                                <Link
                                    href="/tasks"
                                    className="p-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                                    title="Tasks"
                                >
                                    <CheckSquare size={20} />
                                </Link>
                            </div>

                            {/* Divider */}
                            <div className="h-8 w-px bg-slate-200" />

                            {/* User Actions */}
                            <div className="flex items-center gap-3">
                                {admin && (
                                    <>
                                        <Link
                                            href="/admin"
                                            className="p-2.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all"
                                            title="Admin Dashboard"
                                        >
                                            <Shield size={20} />
                                        </Link>
                                        <Link
                                            href="/settings?tab=admin"
                                            className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                                            title="Admin Settings"
                                        >
                                            <Settings size={20} />
                                        </Link>
                                    </>
                                )}
                                <Link
                                    href="/settings"
                                    className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all group"
                                    title="View Profile"
                                >
                                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:shadow-md transition-shadow">
                                        {session.user.name
                                            ?.split(" ")
                                            .map((n) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2) || "U"}
                                    </div>
                                    <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900">
                                        {session.user.name}
                                    </span>
                                </Link>
                                <SignOutButton />
                            </div>
                        </div>
                    ) : (
                        <>
                            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                                Sign In
                            </Link>
                            <Link href="/signup" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                                Get Started
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
