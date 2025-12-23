"use client";

import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { DailyActivityData, PracticeMetrics, TestResult } from "@/app/admin/actions";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface DailyActivityChartProps {
    data: DailyActivityData[];
}

export function DailyActivityChart({ data }: DailyActivityChartProps) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                />
                <YAxis />
                <Tooltip
                    labelFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        });
                    }}
                />
                <Legend />
                <Line
                    type="monotone"
                    dataKey="wordsReviewed"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Words Reviewed"
                />
                <Line
                    type="monotone"
                    dataKey="practiceSessions"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Practice Sessions"
                />
                <Line
                    type="monotone"
                    dataKey="testSessions"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Test Sessions"
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

interface ActiveUsersChartProps {
    data: DailyActivityData[];
}

export function ActiveUsersChart({ data }: ActiveUsersChartProps) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                />
                <YAxis />
                <Tooltip
                    labelFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        });
                    }}
                />
                <Legend />
                <Bar dataKey="activeUsers" fill="#8b5cf6" name="Active Users" />
            </BarChart>
        </ResponsiveContainer>
    );
}

interface AccuracyChartProps {
    accuracy: number;
}

export function AccuracyChart({ accuracy }: AccuracyChartProps) {
    const data = [
        { name: "Correct", value: accuracy },
        { name: "Incorrect", value: 100 - accuracy },
    ];

    return (
        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                >
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? "#10b981" : "#ef4444"}
                        />
                    ))}
                </Pie>
                <Tooltip />
            </PieChart>
        </ResponsiveContainer>
    );
}

interface TestScoresChartProps {
    data: TestResult[];
}

export function TestScoresChart({ data }: TestScoresChartProps) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    labelFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        });
                    }}
                />
                <Legend />
                <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Test Score (%)"
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

interface PracticeByLessonChartProps {
    data: PracticeMetrics["practiceActivityByLesson"];
}

export function PracticeByLessonChart({ data }: PracticeByLessonChartProps) {
    const chartData = data.slice(0, 10).map((item) => ({
        name: item.lessonTitle.length > 20 ? `${item.lessonTitle.substring(0, 20)}...` : item.lessonTitle,
        words: item.wordsPracticed,
        accuracy: item.accuracy,
    }));

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip />
                <Legend />
                <Bar dataKey="words" fill="#3b82f6" name="Words Practiced" />
                <Bar dataKey="accuracy" fill="#10b981" name="Accuracy (%)" />
            </BarChart>
        </ResponsiveContainer>
    );
}

