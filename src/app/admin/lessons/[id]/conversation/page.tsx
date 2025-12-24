import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getConversationSentencesByLesson, getLessonById } from "./actions";
import { ConversationManagement } from "@/components/admin/ConversationManagement";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminConversationPage({ params }: { params: Promise<{ id: string }> }) {
    const admin = await isAdmin();

    if (!admin) {
        redirect("/");
    }

    const { id } = await params;
    const lessonId = parseInt(id);

    if (isNaN(lessonId)) {
        notFound();
    }

    const [sentences, lesson] = await Promise.all([
        getConversationSentencesByLesson(lessonId),
        getLessonById(lessonId),
    ]);

    if (!lesson) {
        notFound();
    }

    if (lesson.type !== "conversation") {
        redirect(`/admin/units/${lesson.unitId}/lessons`);
    }

    return (
        <main className="py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <Link
                        href={`/admin/units/${lesson.unitId}/lessons`}
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Lessons
                    </Link>
                </div>
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-2">
                        Conversation: {lesson.title}
                    </h1>
                    <p className="text-slate-500">Manage Arabic conversation sentences with optional English translations for this lesson</p>
                </header>

                <ConversationManagement initialSentences={sentences} lessonId={lessonId} lessonTitle={lesson.title} />
            </div>
        </main>
    );
}

