import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getBooks } from "../actions";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default async function BooksPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const books = await getBooks();

    return (
        <main className="py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-2">
                        Arabic Reader
                    </h1>
                    <p className="text-slate-500">Choose a book to start learning</p>
                </header>

                {books.length === 0 ? (
                    <div className="text-center py-12">
                        <BookOpen className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500 text-lg">No books available yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {books.map((book) => (
                            <Link
                                key={book.id}
                                href={`/books/${book.id}`}
                                className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 hover:shadow-xl transition-all hover:border-blue-200 group"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-4 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                                        <BookOpen className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">{book.title}</h2>
                                    </div>
                                </div>
                                {book.description && (
                                    <p className="text-sm text-slate-600 mt-4 line-clamp-3">
                                        {book.description}
                                    </p>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

