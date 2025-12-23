"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

export default function SignUpPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        const { error } = await signUp.email({
            email,
            password,
            name,
            callbackURL: "/books",
        });

        if (error) {
            setError(error.message || "Failed to create account");
            setLoading(false);
        } else {
            setSuccess(true);
            setTimeout(() => {
                router.push("/books");
                router.refresh();
            }, 1000);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-12 px-4 bg-white">
            <div className="w-full max-w-md p-10 bg-white rounded-[2rem] shadow-2xl shadow-blue-500/5 border border-slate-100">
                <h1 className="text-3xl font-extrabold mb-2 text-center text-slate-900 tracking-tight">
                    Join {process.env.NEXT_PUBLIC_APP_NAME || "TaskFlow"}
                </h1>
                <p className="text-slate-500 text-center mb-10 font-light">The simplest way to stay productive</p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={18} />
                        <p>{error}</p>
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-emerald-600 text-sm font-semibold mb-1">Account created successfully!</p>
                                <p className="text-emerald-700 text-sm">
                                    Please check your email to verify your account. Redirecting...
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-300"
                            placeholder="John Doe"
                            required
                        />
                    </div>
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
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-300"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-300"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || success}
                        className="w-full p-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 mt-4 flex items-center justify-center gap-2 active:scale-95"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            "Create Account"
                        )}
                    </button>
                </form>

                <p className="mt-10 text-center text-slate-400 text-sm">
                    Already have an account?{" "}
                    <Link href="/login" className="text-blue-600 hover:text-blue-700 font-bold underline underline-offset-4 transition-colors">
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
}
