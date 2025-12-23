import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getUnitsByBook, getBookById } from "../../../actions";
import { UnitManagement } from "@/components/admin/UnitManagement";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminUnitsPage({ params }: { params: Promise<{ id: string }> }) {
    const admin = await isAdmin();

    if (!admin) {
        redirect("/");
    }

    const { id } = await params;
    const bookId = parseInt(id);

    if (isNaN(bookId)) {
        notFound();
    }

    const [units, book] = await Promise.all([
        getUnitsByBook(bookId),
        getBookById(bookId),
    ]);

    if (!book) {
        notFound();
    }

    return (
        <main className="py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <Link
                        href="/admin/books"
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Books
                    </Link>
                </div>
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-2">
                        Units: {book.title}
                    </h1>
                    <p className="text-slate-500">Manage units for this book</p>
                </header>

                <UnitManagement initialUnits={units} bookId={bookId} bookTitle={book.title} />
            </div>
        </main>
    );
}

