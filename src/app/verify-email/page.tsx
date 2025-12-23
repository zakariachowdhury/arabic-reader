"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, CheckCircle2, Mail } from "lucide-react";

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle");
    const [message, setMessage] = useState<string>("");

    useEffect(() => {
        if (token) {
            verifyEmail(token);
        } else {
            setStatus("error");
            setMessage("Verification token is missing. Please check your email for the verification link.");
        }
    }, [token]);

    const verifyEmail = async (verificationToken: string) => {
        setStatus("loading");
        try {
            const baseURL = typeof window !== "undefined" ? window.location.origin : "";
            // Better-auth uses verify-email endpoint with token in the body or as query param
            const response = await fetch(`${baseURL}/api/auth/verify-email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                    token: verificationToken,
                    type: "email"
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                setStatus("success");
                setMessage("Your email has been verified successfully! You can now access all features.");
                setTimeout(() => {
                    router.push("/books");
                    router.refresh();
                }, 2000);
            } else {
                setStatus("error");
                setMessage(data.message || data.error?.message || "Verification failed. The link may have expired or is invalid.");
            }
        } catch (error) {
            setStatus("error");
            setMessage("An error occurred during verification. Please try again.");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-12 px-4 bg-white">
            <div className="w-full max-w-md p-10 bg-white rounded-[2rem] shadow-2xl shadow-blue-500/5 border border-slate-100">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                        <Mail className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-extrabold mb-2 text-slate-900 tracking-tight">
                        Verify Your Email
                    </h1>
                    <p className="text-slate-500 font-light">Confirming your email address</p>
                </div>

                {status === "loading" && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3 text-blue-600 text-sm">
                        <Loader2 className="animate-spin" size={18} />
                        <p>Verifying your email address...</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 text-sm">
                        <CheckCircle2 size={18} />
                        <p>{message}</p>
                    </div>
                )}

                {status === "error" && (
                    <>
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                            <AlertCircle size={18} />
                            <p>{message}</p>
                        </div>
                        <div className="text-center">
                            <Link
                                href="/"
                                className="text-sm text-blue-600 hover:text-blue-700 font-bold underline underline-offset-4 transition-colors"
                            >
                                Go to Dashboard
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-12 px-4 bg-white">
                <div className="w-full max-w-md p-10 bg-white rounded-[2rem] shadow-2xl shadow-blue-500/5 border border-slate-100">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                            <Mail className="w-8 h-8 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-extrabold mb-2 text-slate-900 tracking-tight">
                            Verify Your Email
                        </h1>
                        <p className="text-slate-500 font-light">Loading...</p>
                    </div>
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3 text-blue-600 text-sm">
                        <Loader2 className="animate-spin" size={18} />
                        <p>Loading verification...</p>
                    </div>
                </div>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}

