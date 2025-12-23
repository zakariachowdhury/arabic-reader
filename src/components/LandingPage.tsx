import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap, Languages } from "lucide-react";
import { getBooksWithStats } from "@/app/actions";

export async function LandingPage() {
    const books = await getBooksWithStats();

    return (
        <div className="bg-white">
            {/* Hero Section */}
            <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 flex flex-col items-center text-center">
                <h1 className="text-5xl sm:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 max-w-4xl leading-[1.1]">
                    Master Arabic with <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AI-powered</span> reading.
                </h1>
                <p className="text-xl text-slate-500 max-w-2xl mb-10 leading-relaxed font-light">
                    {process.env.NEXT_PUBLIC_APP_NAME || "Arabic Reader"} combines beautiful design with intelligent AI assistance. Read Arabic books, learn vocabulary, and track your progress with personalized guidance.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <Link href="/signup" className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-lg font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 group">
                        Start for free
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link href="/login" className="px-8 py-4 bg-white text-slate-900 rounded-2xl text-lg font-bold hover:bg-slate-50 transition-all border border-slate-200 flex items-center justify-center shadow-lg shadow-slate-200/20">
                        Start Reading
                    </Link>
                </div>
            </header>

            {/* Books Section */}
            <section className="bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 py-24 border-t border-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
                            Available Books
                        </h2>
                        <p className="text-slate-600 max-w-2xl mx-auto text-lg font-light leading-relaxed">
                            Explore our collection of Arabic books, each organized into structured units and lessons to help you learn effectively.
                        </p>
                    </div>

                    {books.length === 0 ? (
                        <div className="text-center py-12">
                            <BookOpen className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-500 text-lg">No books available yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {books.map((book) => (
                                <div
                                    key={book.id}
                                    className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 hover:shadow-xl transition-all hover:border-blue-200"
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-4 bg-blue-100 rounded-xl">
                                            <BookOpen className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-2xl font-bold text-slate-900">{book.title}</h3>
                                        </div>
                                    </div>
                                    
                                    {book.description && (
                                        <p className="text-sm text-slate-600 mb-6 line-clamp-3">
                                            {book.description}
                                        </p>
                                    )}

                                    <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-100">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <BookOpen className="w-4 h-4 text-blue-600" />
                                                <span className="text-2xl font-bold text-slate-900">{book.stats.units}</span>
                                            </div>
                                            <p className="text-xs text-slate-500">Units</p>
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <GraduationCap className="w-4 h-4 text-purple-600" />
                                                <span className="text-2xl font-bold text-slate-900">{book.stats.lessons}</span>
                                            </div>
                                            <p className="text-xs text-slate-500">Lessons</p>
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <Languages className="w-4 h-4 text-emerald-600" />
                                                <span className="text-2xl font-bold text-slate-900">{book.stats.vocabularyWords}</span>
                                            </div>
                                            <p className="text-xs text-slate-500">Words</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* CTA Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <div className="bg-blue-600 rounded-[3rem] p-8 sm:p-20 text-center relative overflow-hidden shadow-2xl shadow-blue-500/30">
                    <div className="relative z-10">
                        <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 tracking-tight">Ready to master Arabic?</h2>
                        <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto font-light leading-relaxed">
                            Join learners who are improving their Arabic reading skills with {process.env.NEXT_PUBLIC_APP_NAME || "Arabic Reader"}.
                        </p>
                        <Link href="/signup" className="inline-flex px-10 py-4 bg-white text-blue-600 rounded-2xl text-lg font-bold hover:bg-slate-50 transition-all shadow-xl">
                            Get Started for Free
                        </Link>
                    </div>
                    {/* Decorative background elements */}
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-80 h-80 bg-blue-400 rounded-full opacity-20 blur-[100px]"></div>
                    <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-80 h-80 bg-blue-800 rounded-full opacity-20 blur-[100px]"></div>
                </div>
            </section>
        </div>
    );
}
