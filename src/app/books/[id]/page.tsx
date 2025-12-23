import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getBookById, getUnitsByBook } from "../../actions";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const { id } = await params;
    const bookId = parseInt(id);

    if (isNaN(bookId)) {
        notFound();
    }

    const [book, units] = await Promise.all([
        getBookById(bookId),
        getUnitsByBook(bookId),
    ]);

    if (!book) {
        notFound();
    }

    return (
        <main className="py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <Link
                        href="/books"
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Books
                    </Link>
                </div>
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-2">
                        {book.title}
                    </h1>
                    {book.description && (
                        <p className="text-slate-500">{book.description}</p>
                    )}
                </header>

                {units.length === 0 ? (
                    <div className="text-center py-12">
                        <BookOpen className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500 text-lg">No units available yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {units.map((unit) => (
                            <Link
                                key={unit.id}
                                href={`/units/${unit.id}`}
                                className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 hover:shadow-xl transition-all hover:border-blue-200 group"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-4 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                                        <BookOpen className="w-8 h-8 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">{unit.title}</h2>
                                        <p className="text-sm text-slate-500">Unit {unit.order + 1}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

