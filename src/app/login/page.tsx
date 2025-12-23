"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showVerificationWarning, setShowVerificationWarning] = useState(false);
    const router = useRouter();
    const { data: session } = useSession();

    // Check verification status after successful login
    useEffect(() => {
        if (success && session?.user) {
            if (!session.user.emailVerified) {
                setShowVerificationWarning(true);
                setTimeout(() => {
                    router.push("/books");
                    router.refresh();
                }, 3000);
            } else {
                setTimeout(() => {
                    router.push("/books");
                    router.refresh();
                }, 1000);
            }
        }
    }, [success, session, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setShowVerificationWarning(false);

        const { error } = await signIn.email({
            email,
            password,
            callbackURL: "/books",
        });

        if (error) {
            setError(error.message || "Invalid email or password");
            setLoading(false);
        } else {
            setSuccess(true);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-12 px-4 bg-white">
            <div className="w-full max-w-md p-10 bg-white rounded-[2rem] shadow-2xl shadow-blue-500/5 border border-slate-100">
                <h1 className="text-3xl font-extrabold mb-2 text-center text-slate-900 tracking-tight">
                    Welcome Back
                </h1>
                <p className="text-slate-500 text-center mb-10 font-light">Sign in to manage your tasks</p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                        <AlertCircle size={18} />
                        <p>{error}</p>
                    </div>
                )}

                {success && !showVerificationWarning && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 text-sm">
                        <CheckCircle2 size={18} />
                        <p>Success! Redirecting...</p>
                    </div>
                )}

                {showVerificationWarning && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                            <div className="flex-1">
                                <p className="text-amber-800 text-sm font-semibold mb-1">
                                    Email not verified
                                </p>
                                <p className="text-amber-700 text-sm mb-2">
                                    Please check your email and verify your account to access all features.
                                </p>
                                <p className="text-amber-600 text-xs">
                                    Redirecting to dashboard...
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-300"
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-300"
                            placeholder="••••••••"
                            required
                        />
                        <div className="flex justify-end mt-2 mr-1">
                            <Link
                                href="/forgot-password"
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || success}
                        className="w-full p-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 mt-4 flex items-center justify-center gap-2 active:scale-95"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>

                <p className="mt-10 text-center text-slate-400 text-sm">
                    New here?{" "}
                    <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-bold underline underline-offset-4 transition-colors">
                        Create an account
                    </Link>
                </p>
            </div>
        </div>
    );
}
