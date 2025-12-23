import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getLessonById, getVocabularyWordsByLesson, getUserProgress } from "../../../actions";
import { VocabularyFlashcards } from "@/components/VocabularyFlashcards";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getUnitById, getBookById } from "../../../actions";

export default async function VocabularyLessonPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const { id } = await params;
    const lessonId = parseInt(id);

    if (isNaN(lessonId)) {
        notFound();
    }

    const [lesson, words] = await Promise.all([
        getLessonById(lessonId),
        getVocabularyWordsByLesson(lessonId),
    ]);

    if (!lesson) {
        notFound();
    }

    if (lesson.type !== "vocabulary") {
        redirect(`/units/${lesson.unitId}`);
    }

    const progress = await getUserProgress(lessonId);

    // Get unit and book for breadcrumb
    const unit = await getUnitById(lesson.unitId);
    const book = unit ? await getBookById(unit.bookId) : null;

    return (
        <main className="py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <Link
                        href={unit ? `/units/${unit.id}` : "/books"}
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {unit ? `Back to ${unit.title}` : "Back to Books"}
                    </Link>
                </div>
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-2">
                        {lesson.title}
                    </h1>
                    {book && unit && (
                        <p className="text-slate-500">
                            {book.title} → {unit.title}
                        </p>
                    )}
                </header>

                <VocabularyFlashcards words={words} initialProgress={progress} lessonId={lessonId} />
            </div>
        </main>
    );
}

