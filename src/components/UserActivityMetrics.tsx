"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
    getUserDailyActivity,
    getUserPracticeMetrics,
    getUserTestResults,
    getUserActivitySummary,
    getUserDailyActivityByBook,
    getBooks,
} from "@/app/actions";
import {
    DailyActivityChart,
    AccuracyChart,
    TestScoresChart,
} from "@/components/admin/ActivityCharts";
import { TestResult } from "@/app/admin/actions";
import { Flame, Target, TrendingUp, BookOpen } from "lucide-react";

type BookActivityData = {
    bookId: number;
    bookTitle: string;
    dailyActivity: Array<{ date: string; wordsReviewed: number; practiceSessions: number; testSessions: number }>;
    summary: {
        totalWordsReviewed: number;
        totalPracticeSessions: number;
        totalTestSessions: number;
        averageAccuracy: number;
    };
};

export function UserActivityMetrics() {
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [dailyActivity, setDailyActivity] = useState<Array<{ date: string; wordsReviewed: number; practiceSessions: number; testSessions: number }>>([]);
    const [practiceMetrics, setPracticeMetrics] = useState<{
        totalWordsPracticed: number;
        accuracyRate: number;
        wordsSeen: number;
        wordsNotSeen: number;
        totalCorrect: number;
        totalIncorrect: number;
    } | null>(null);
    const [testResults, setTestResults] = useState<TestResult[]>([]);
    const [summary, setSummary] = useState<{
        totalWordsReviewed: number;
        totalPracticeSessions: number;
        totalTestSessions: number;
        averageAccuracy: number;
        currentStreak: number;
        longestStreak: number;
        lastActivityDate: string | null;
    } | null>(null);
    const [dateRange, setDateRange] = useState(30);
    const [books, setBooks] = useState<Array<{ id: number; title: string }>>([]);
    const [bookActivity, setBookActivity] = useState<Record<number, BookActivityData>>({});
    
    // Initialize selectedBookId from URL parameter or default to "all"
    const bookIdParam = searchParams?.get("bookId");
    const initialBookId = bookIdParam ? (isNaN(parseInt(bookIdParam)) ? "all" : parseInt(bookIdParam)) : "all";
    const [selectedBookId, setSelectedBookId] = useState<number | "all">(initialBookId);

    useEffect(() => {
        // Update selectedBookId when URL parameter changes
        const bookIdParam = searchParams?.get("bookId");
        if (bookIdParam) {
            const bookId = parseInt(bookIdParam);
            if (!isNaN(bookId)) {
                setSelectedBookId(bookId);
            }
        } else {
            setSelectedBookId("all");
        }
    }, [searchParams]);

    useEffect(() => {
        loadMetrics();
    }, [dateRange]);

    const loadMetrics = async () => {
        setLoading(true);
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - dateRange);

            const [activity, practice, tests, userSummary, booksList, activityByBook] = await Promise.all([
                getUserDailyActivity(startDate, endDate),
                getUserPracticeMetrics(startDate, endDate),
                getUserTestResults(startDate, endDate),
                getUserActivitySummary(startDate, endDate),
                getBooks(),
                getUserDailyActivityByBook(startDate, endDate),
            ]);

            setDailyActivity(activity);
            setPracticeMetrics(practice);
            setTestResults(tests);
            setSummary(userSummary);
            setBooks(booksList);
            setBookActivity(activityByBook);
        } catch (error) {
            console.error("Failed to load metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Loading your activity metrics...</p>
            </div>
        );
    }

    const averageTestScore =
        testResults.length > 0
            ? testResults.reduce((sum, result) => sum + result.score, 0) /
              testResults.length
            : 0;

    // Get current book data or overall data
    const currentBookData = selectedBookId === "all" ? null : bookActivity[selectedBookId];
    const displayActivity = selectedBookId === "all" ? dailyActivity : (currentBookData?.dailyActivity || []);
    const displaySummary = selectedBookId === "all" ? summary : currentBookData?.summary;

    return (
        <div className="space-y-8">
            {/* Book Selector */}
            {books.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        Filter by Book
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedBookId("all")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                selectedBookId === "all"
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                        >
                            All Books
                        </button>
                        {books.map((book) => (
                            <button
                                key={book.id}
                                onClick={() => setSelectedBookId(book.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    selectedBookId === book.id
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                            >
                                {book.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <BookOpen className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {displaySummary?.totalWordsReviewed.toLocaleString() || 0}
                    </h3>
                    <p className="text-sm text-slate-500">Words Reviewed</p>
                    {selectedBookId !== "all" && currentBookData && (
                        <p className="text-xs text-slate-400 mt-1">{currentBookData.bookTitle}</p>
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-100 rounded-xl">
                            <TrendingUp className="w-6 h-6 text-emerald-600" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {displaySummary?.averageAccuracy.toFixed(1) || 0}%
                    </h3>
                    <p className="text-sm text-slate-500">Average Accuracy</p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-orange-100 rounded-xl">
                            <Flame className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {displaySummary?.totalPracticeSessions.toLocaleString() || 0}
                    </h3>
                    <p className="text-sm text-slate-500">Practice Sessions</p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-100 rounded-xl">
                            <Target className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {displaySummary?.totalTestSessions.toLocaleString() || 0}
                    </h3>
                    <p className="text-sm text-slate-500">Test Sessions</p>
                </div>
            </div>

            {/* Date Range Selector */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    Time Period
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setDateRange(7)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            dateRange === 7
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                    >
                        Last 7 days
                    </button>
                    <button
                        onClick={() => setDateRange(30)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            dateRange === 30
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                    >
                        Last 30 days
                    </button>
                    <button
                        onClick={() => setDateRange(90)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            dateRange === 90
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                    >
                        Last 90 days
                    </button>
                </div>
            </div>

            {/* Daily Activity Chart */}
            {displayActivity.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">
                        {selectedBookId === "all" ? "Your Daily Activity" : `Daily Activity - ${currentBookData?.bookTitle || ""}`}
                    </h2>
                    <DailyActivityChart data={displayActivity.map(item => ({
                        ...item,
                        activeUsers: 0, // Not applicable for user view
                    }))} />
                </div>
            )}

            {/* Per-Book Breakdown */}
            {selectedBookId === "all" && Object.keys(bookActivity).length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">
                        Activity by Book
                    </h2>
                    <div className="space-y-6">
                        {Object.values(bookActivity).map((bookData) => (
                            <div key={bookData.bookId} className="border border-slate-200 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-semibold text-slate-900">{bookData.bookTitle}</h3>
                                    <button
                                        onClick={() => setSelectedBookId(bookData.bookId)}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        View Details →
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <p className="text-sm text-slate-500">Words Reviewed</p>
                                        <p className="text-lg font-bold text-slate-900">{bookData.summary.totalWordsReviewed.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Practice Sessions</p>
                                        <p className="text-lg font-bold text-slate-900">{bookData.summary.totalPracticeSessions.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Test Sessions</p>
                                        <p className="text-lg font-bold text-slate-900">{bookData.summary.totalTestSessions.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Accuracy</p>
                                        <p className="text-lg font-bold text-slate-900">{bookData.summary.averageAccuracy.toFixed(1)}%</p>
                                    </div>
                                </div>
                                {bookData.dailyActivity.length > 0 && (
                                    <div className="h-48">
                                        <DailyActivityChart data={bookData.dailyActivity.map(item => ({
                                            ...item,
                                            activeUsers: 0,
                                        }))} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Overall Stats (only show when viewing all books) */}
            {selectedBookId === "all" && summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-orange-100 rounded-xl">
                                <Flame className="w-6 h-6 text-orange-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">
                            {summary.currentStreak || 0}
                        </h3>
                        <p className="text-sm text-slate-500">Current Streak</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-purple-100 rounded-xl">
                                <Target className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">
                            {summary.longestStreak || 0}
                        </h3>
                        <p className="text-sm text-slate-500">Longest Streak</p>
                    </div>
                </div>
            )}

            {/* Practice Metrics */}
            {practiceMetrics && selectedBookId === "all" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">
                            Practice Accuracy
                        </h2>
                        <AccuracyChart accuracy={practiceMetrics.accuracyRate} />
                        <div className="mt-4 text-center">
                            <p className="text-sm text-slate-500">
                                Total Words Practiced:{" "}
                                {practiceMetrics.totalWordsPracticed.toLocaleString()}
                            </p>
                            <p className="text-sm text-slate-500 mt-1">
                                Correct: {practiceMetrics.totalCorrect.toLocaleString()} |{" "}
                                Incorrect: {practiceMetrics.totalIncorrect.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {testResults.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">
                                Test Scores
                            </h2>
                            <TestScoresChart data={testResults} />
                            <div className="mt-4 text-center">
                                <p className="text-sm text-slate-500">
                                    Average Score: {averageTestScore.toFixed(1)}%
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                    Tests Taken: {testResults.length}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Book-specific Practice Metrics */}
            {selectedBookId !== "all" && currentBookData && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">
                        Practice Accuracy - {currentBookData.bookTitle}
                    </h2>
                    <AccuracyChart accuracy={currentBookData.summary.averageAccuracy} />
                    <div className="mt-4 text-center">
                        <p className="text-sm text-slate-500">
                            Total Words Practiced:{" "}
                            {currentBookData.summary.totalWordsReviewed.toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            Practice Sessions: {currentBookData.summary.totalPracticeSessions} |{" "}
                            Test Sessions: {currentBookData.summary.totalTestSessions}
                        </p>
                    </div>
                </div>
            )}

            {/* Last Activity */}
            {selectedBookId === "all" && summary?.lastActivityDate && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <p className="text-slate-600">
                        Last activity:{" "}
                        <span className="font-semibold text-slate-900">
                            {new Date(summary.lastActivityDate).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </span>
                    </p>
                </div>
            )}
        </div>
    );
}

