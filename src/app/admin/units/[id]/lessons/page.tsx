import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getUnitById } from "../../actions";
import { getLessonsByUnit } from "../../../lessons/actions";
import { LessonManagement } from "@/components/admin/LessonManagement";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminLessonsPage({ params }: { params: Promise<{ id: string }> }) {
    const admin = await isAdmin();

    if (!admin) {
        redirect("/");
    }

    const { id } = await params;
    const unitId = parseInt(id);

    if (isNaN(unitId)) {
        notFound();
    }

    const [lessons, unit] = await Promise.all([
        getLessonsByUnit(unitId),
        getUnitById(unitId),
    ]);

    if (!unit) {
        notFound();
    }

    return (
        <main className="py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <Link
                        href={`/admin/books/${unit.bookId}/units`}
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Units
                    </Link>
                </div>
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-2">
                        Lessons: {unit.title}
                    </h1>
                    <p className="text-slate-500">Manage lessons for this unit</p>
                </header>

                <LessonManagement initialLessons={lessons} unitId={unitId} unitTitle={unit.title} />
            </div>
        </main>
    );
}

