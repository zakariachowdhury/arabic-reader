import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUnitById, getLessonsByUnit, getBookById, getUnitProgress, getLessonProgress } from "../../actions";
import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap } from "lucide-react";
import { ProgressBar, ProgressBadge } from "@/components/ProgressIndicator";

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/login");
    }

    const { id } = await params;
    const unitId = parseInt(id);

    if (isNaN(unitId)) {
        notFound();
    }

    const [unit, lessons, unitProgress] = await Promise.all([
        getUnitById(unitId),
        getLessonsByUnit(unitId),
        getUnitProgress(unitId),
    ]);

    if (!unit) {
        notFound();
    }

    const book = await getBookById(unit.bookId);

    // Get progress for each lesson (only for vocabulary lessons)
    const lessonsWithProgress = await Promise.all(
        lessons.map(async (lesson) => ({
            ...lesson,
            progress: lesson.type === "vocabulary" ? await getLessonProgress(lesson.id) : null,
        }))
    );

    return (
        <main className="py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <Link
                        href={book ? `/books/${book.id}` : "/books"}
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {book ? `Back to ${book.title}` : "Back to Books"}
                    </Link>
                </div>
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
                            {unit.title}
                        </h1>
                        {unitProgress.totalWords > 0 && (
                            <ProgressBadge progress={unitProgress} />
                        )}
                    </div>
                    {book && (
                        <p className="text-slate-500 mb-4">From {book.title}</p>
                    )}
                    {unitProgress.totalWords > 0 && (
                        <div className="mt-4">
                            <ProgressBar progress={unitProgress} />
                        </div>
                    )}
                </header>

                {lessons.length === 0 ? (
                    <div className="text-center py-12">
                        <GraduationCap className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500 text-lg">No lessons available yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lessonsWithProgress.map((lesson) => {
                            const getLessonUrl = () => {
                                if (lesson.type === "vocabulary") return `/lessons/${lesson.id}/vocabulary`;
                                if (lesson.type === "conversation") return `/lessons/${lesson.id}/conversation`;
                                return "#";
                            };
                            
                            const isClickable = lesson.type === "vocabulary" || lesson.type === "conversation";
                            
                            return (
                                <Link
                                    key={lesson.id}
                                    href={getLessonUrl()}
                                    className={`bg-white rounded-2xl shadow-lg border border-slate-100 p-8 hover:shadow-xl transition-all ${
                                        isClickable
                                            ? "hover:border-blue-200 cursor-pointer" 
                                            : "opacity-60 cursor-not-allowed"
                                    } group`}
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className={`p-4 rounded-xl transition-colors ${
                                            isClickable
                                                ? "bg-purple-100 group-hover:bg-purple-200" 
                                                : "bg-slate-100"
                                        }`}>
                                            <GraduationCap className={`w-8 h-8 ${
                                                isClickable ? "text-purple-600" : "text-slate-400"
                                            }`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h2 className="text-xl font-bold text-slate-900">{lesson.title}</h2>
                                                    <p className="text-sm text-slate-500 capitalize">{lesson.type}</p>
                                                </div>
                                                {lesson.progress && lesson.progress.totalWords > 0 && (
                                                    <ProgressBadge progress={lesson.progress} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {!isClickable && (
                                        <p className="text-xs text-slate-400 mt-2">Coming soon</p>
                                    )}
                                    {lesson.progress && lesson.progress.totalWords > 0 && (
                                        <div className="mt-4">
                                            <ProgressBar progress={lesson.progress} size="sm" />
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}

