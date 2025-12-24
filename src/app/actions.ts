"use server";

import { db } from "@/db";
import { todos, verification, user, groups, settings, books, units, lessons, vocabularyWords, conversationSentences, userProgress } from "@/db/schema";
import { eq, asc, and, inArray, sql, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Type definitions for AI todo processing
export type TodoActionType = "add" | "edit" | "complete" | "uncomplete" | "delete" | "delete_group" | "create_group";

export interface TodoAction {
    type: TodoActionType;
    id?: number;
    content?: string;
    groupId?: number | string | null; // Can be number ID or string name
    groupName?: string;
    groupColor?: string | null;
    groupDescription?: string | null;
}

export interface AITodoResponse {
    actions: TodoAction[];
    message?: string;
}

export interface ProcessAITodoResult {
    success: boolean;
    message: string;
    executedActions: Array<{
        type: TodoActionType;
        id?: number;
        content?: string;
        success: boolean;
        error?: string;
    }>;
    error?: string;
}

async function getSession() {
    return await auth.api.getSession({
        headers: await headers(),
    });
}

// Group management actions
export async function getGroups() {
    const session = await getSession();
    if (!session) return [];

    try {
        return await db
            .select()
            .from(groups)
            .where(eq(groups.userId, session.user.id))
            .orderBy(asc(groups.name));
    } catch (error) {
        console.error("Failed to fetch groups:", error);
        return [];
    }
}

export async function createGroup(formData: FormData) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const name = formData.get("name") as string;
    const color = formData.get("color") as string | null;
    const description = formData.get("description") as string | null;

    if (!name || name.trim() === "") {
        throw new Error("Group name is required");
    }

    try {
        // Check if group name already exists for this user
        const existingGroups = await getGroups();
        if (existingGroups.some(g => g.name.toLowerCase() === name.toLowerCase().trim())) {
            throw new Error("A group with this name already exists");
        }

        // Check if this is the first group for the user
        const isFirstGroup = existingGroups.length === 0;

        // Insert the new group
        await db.insert(groups).values({
            name: name.trim(),
            color: color?.trim() || null,
            description: description?.trim() || null,
            userId: session.user.id,
        });

        // If this is the first group, set it as default
        if (isFirstGroup) {
            // Get the newly created group (it will be the only one for this user)
            const [newGroup] = await db
                .select({ id: groups.id })
                .from(groups)
                .where(eq(groups.userId, session.user.id))
                .limit(1);

            if (newGroup) {
                await db
                    .update(user)
                    .set({ defaultGroupId: newGroup.id, updatedAt: new Date() })
                    .where(eq(user.id, session.user.id));
            }
        }

        revalidatePath("/");
    } catch (error) {
        console.error("Failed to create group:", error);
        throw error;
    }
}

export async function updateGroup(id: number, formData: FormData) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const name = formData.get("name") as string;
    const color = formData.get("color") as string | null;
    const description = formData.get("description") as string | null;

    if (!name || name.trim() === "") {
        throw new Error("Group name is required");
    }

    try {
        // Verify group belongs to user
        const [group] = await db
            .select()
            .from(groups)
            .where(and(eq(groups.id, id), eq(groups.userId, session.user.id)))
            .limit(1);

        if (!group) {
            throw new Error("Group not found");
        }

        // Check if new name conflicts with another group
        const existingGroups = await getGroups();
        if (existingGroups.some(g => g.id !== id && g.name.toLowerCase() === name.toLowerCase().trim())) {
            throw new Error("A group with this name already exists");
        }

        await db
            .update(groups)
            .set({
                name: name.trim(),
                color: color?.trim() || null,
                description: description?.trim() || null,
                updatedAt: new Date(),
            })
            .where(and(eq(groups.id, id), eq(groups.userId, session.user.id)));
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to update group:", error);
        throw error;
    }
}

export async function deleteGroup(id: number) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    try {
        // Verify group belongs to user
        const [group] = await db
            .select()
            .from(groups)
            .where(and(eq(groups.id, id), eq(groups.userId, session.user.id)))
            .limit(1);

        if (!group) {
            throw new Error("Group not found");
        }

        // Set todos' groupId to null instead of cascading delete
        await db
            .update(todos)
            .set({ groupId: null })
            .where(eq(todos.groupId, id));

        // If this was the default group, clear it
        const [currentUser] = await db
            .select()
            .from(user)
            .where(eq(user.id, session.user.id))
            .limit(1);

        if (currentUser?.defaultGroupId === id) {
            await db
                .update(user)
                .set({ defaultGroupId: null, updatedAt: new Date() })
                .where(eq(user.id, session.user.id));
        }

        // Delete the group
        await db
            .delete(groups)
            .where(and(eq(groups.id, id), eq(groups.userId, session.user.id)));
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to delete group:", error);
        throw error;
    }
}

export async function getDefaultGroup() {
    const session = await getSession();
    if (!session) return null;

    try {
        const [userData] = await db
            .select({ defaultGroupId: user.defaultGroupId })
            .from(user)
            .where(eq(user.id, session.user.id))
            .limit(1);

        if (!userData?.defaultGroupId) return null;

        // Verify the group still exists and belongs to user
        const [group] = await db
            .select()
            .from(groups)
            .where(and(eq(groups.id, userData.defaultGroupId), eq(groups.userId, session.user.id)))
            .limit(1);

        return group || null;
    } catch (error) {
        console.error("Failed to fetch default group:", error);
        return null;
    }
}

export async function setDefaultGroup(groupId: number | null) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    try {
        // If groupId is provided, verify it belongs to user
        if (groupId !== null) {
            const [group] = await db
                .select()
                .from(groups)
                .where(and(eq(groups.id, groupId), eq(groups.userId, session.user.id)))
                .limit(1);

            if (!group) {
                throw new Error("Group not found");
            }
        }

        await db
            .update(user)
            .set({ defaultGroupId: groupId, updatedAt: new Date() })
            .where(eq(user.id, session.user.id));
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to set default group:", error);
        throw error;
    }
}

export async function getTodos() {
    const session = await getSession();
    if (!session) return [];

    try {
        const todosList = await db
            .select({
                id: todos.id,
                content: todos.content,
                completed: todos.completed,
                userId: todos.userId,
                groupId: todos.groupId,
                createdAt: todos.createdAt,
                group: {
                    id: groups.id,
                    name: groups.name,
                    color: groups.color,
                    description: groups.description,
                },
            })
            .from(todos)
            .leftJoin(groups, eq(todos.groupId, groups.id))
            .where(eq(todos.userId, session.user.id))
            .orderBy(asc(todos.id));

        return todosList.map(todo => ({
            id: todo.id,
            content: todo.content,
            completed: todo.completed,
            userId: todo.userId,
            groupId: todo.groupId,
            createdAt: todo.createdAt,
            group: todo.group && todo.group.id ? {
                id: todo.group.id,
                name: todo.group.name,
                color: todo.group.color,
                description: todo.group.description,
            } : null,
        }));
    } catch (error) {
        console.error("Failed to fetch todos:", error);
        return [];
    }
}

export async function addTodo(formData: FormData) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const content = formData.get("content") as string;
    const groupIdStr = formData.get("groupId") as string | null;
    
    // Parse groupId: if empty string or null, it means explicitly "no group" (uncategorized)
    // If not provided at all, use default group
    let groupId: number | null;
    if (groupIdStr === null) {
        // groupId not in formData - use default group if available
        const [userData] = await db
            .select({ defaultGroupId: user.defaultGroupId })
            .from(user)
            .where(eq(user.id, session.user.id))
            .limit(1);
        
        if (userData?.defaultGroupId) {
            // Verify the default group still exists and belongs to user
            const [defaultGroup] = await db
                .select()
                .from(groups)
                .where(and(eq(groups.id, userData.defaultGroupId), eq(groups.userId, session.user.id)))
                .limit(1);
            
            groupId = defaultGroup ? userData.defaultGroupId : null;
        } else {
            groupId = null;
        }
    } else if (groupIdStr === "") {
        // Empty string means explicitly "no group" - use uncategorized
        groupId = null;
    } else {
        // Parse the group ID
        groupId = parseInt(groupIdStr, 10);
    }

    if (!content || content.trim() === "") return;

    try {
        // If groupId is provided (not null), verify it belongs to the user
        if (groupId !== null) {
            const [group] = await db
                .select()
                .from(groups)
                .where(and(eq(groups.id, groupId), eq(groups.userId, session.user.id)))
                .limit(1);

            if (!group) {
                throw new Error("Group not found");
            }
        }

        await db.insert(todos).values({
            content,
            userId: session.user.id,
            groupId: groupId,
        });
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to add todo:", error);
        throw error;
    }
}

export async function toggleTodo(id: number, completed: boolean) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    try {
        await db
            .update(todos)
            .set({ completed })
            .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to toggle todo:", error);
    }
}

export async function deleteTodo(id: number) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    try {
        await db
            .delete(todos)
            .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to delete todo:", error);
    }
}

export async function updateTodo(id: number, content: string, groupId?: number | null) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    if (!content || content.trim() === "") return;

    try {
        // If groupId is provided, verify it belongs to the user
        if (groupId !== undefined && groupId !== null) {
            const [group] = await db
                .select()
                .from(groups)
                .where(and(eq(groups.id, groupId), eq(groups.userId, session.user.id)))
                .limit(1);

            if (!group) {
                throw new Error("Group not found");
            }
        }

        const updateData: { content: string; groupId?: number | null } = { content };
        if (groupId !== undefined) {
            updateData.groupId = groupId;
        }

        await db
            .update(todos)
            .set(updateData)
            .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to update todo:", error);
        throw error;
    }
}

export async function requestPasswordReset(email: string, redirectTo: string = "/reset-password") {
    try {
        const baseURL = process.env.BETTER_AUTH_URL || 
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        
        const response = await fetch(`${baseURL}/api/auth/request-password-reset`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                redirectTo: `${baseURL}${redirectTo}`,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to request password reset");
        }

        return { error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to request password reset. Please try again.";
        return { 
            error: { 
                message: errorMessage
            }
        };
    }
}

export async function resendVerificationEmail() {
    try {
        const session = await getSession();
        if (!session) {
            return {
                error: {
                    message: "You must be logged in to resend verification email"
                }
            };
        }

        // Get user details
        const [userData] = await db
            .select()
            .from(user)
            .where(eq(user.id, session.user.id))
            .limit(1);

        if (!userData) {
            return {
                error: {
                    message: "User not found"
                }
            };
        }

        // Generate verification token
        const { randomBytes } = await import("crypto");
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry

        const baseURL = process.env.BETTER_AUTH_URL || 
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

        const verifyUrl = `${baseURL}/verify-email?token=${token}`;

        // Delete any existing verification tokens for this email
        await db
            .delete(verification)
            .where(eq(verification.identifier, userData.email));

        // Create new verification token
        await db.insert(verification).values({
            id: randomBytes(16).toString("hex"),
            identifier: userData.email,
            value: token,
            expiresAt: expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Send verification email
        const { resend } = await import("@/lib/resend");
        const appName = process.env.NEXT_PUBLIC_APP_NAME || "TaskFlow";

        await resend.emails.send({
            from: `${appName} <onboarding@resend.dev>`,
            to: [userData.email],
            subject: `Verify your email for ${appName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h1 style="color: #1a202c; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Verify your email</h1>
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                        Hi ${userData.name},<br><br>
                        Thank you for signing up for ${appName}! Please verify your email address by clicking the button below.
                    </p>
                    <a href="${verifyUrl}" 
                       style="display: inline-block; background-color: #3182ce; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                        Verify Email
                    </a>
                    <p style="color: #ed8936; font-size: 14px; margin-top: 24px; padding: 12px; background-color: #fffaf0; border-radius: 6px; border: 1px solid #feebc8;">
                        <strong>Note:</strong> This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                    </p>
                    <hr style="margin: 32px 0; border: 0; border-top: 1px solid #e2e8f0;" />
                    <p style="color: #a0aec0; font-size: 12px; text-align: center;">
                        &copy; 2024 ${appName}. All rights reserved.
                    </p>
                </div>
            `,
        });

        return { error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to send verification email. Please try again.";
        return { 
            error: { 
                message: errorMessage
            }
        };
    }
}

export interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
    navigationLinks?: Array<{ label: string; url: string }>;
    result?: {
        actions?: Array<{ type: string; data?: Record<string, unknown> }>;
    };
}

// Type definitions for AI learning processing
export type LearningActionType = "explain" | "search" | "navigate" | "practice" | "test";

export interface LearningAction {
    type: LearningActionType;
    data?: {
        query?: string;
        bookId?: number;
        unitId?: number;
        lessonId?: number;
        wordId?: number;
        searchResults?: Array<{
            type: "book" | "unit" | "lesson" | "vocabulary";
            id: number;
            title: string;
            arabic?: string;
            english?: string;
            path: string;
        }>;
        navigationLinks?: Array<{
            label: string;
            url: string;
        }>;
        explanation?: string;
        practiceSuggestions?: Array<{
            type: string;
            description: string;
            url?: string;
        }>;
        testQuestions?: Array<{
            question: string;
            type: "translation" | "multiple_choice";
            options?: string[];
            correctAnswer: string;
        }>;
    };
}

export interface AILearningResponse {
    message: string;
    actions?: LearningAction[];
    navigationLinks?: Array<{
        label: string;
        url: string;
    }>;
}

export interface ProcessAILearningResult {
    success: boolean;
    message: string;
    actions?: LearningAction[];
    navigationLinks?: Array<{
        label: string;
        url: string;
    }>;
    error?: string;
}

// Navigation helper functions
export async function getBookNavigationUrl(bookId: number): Promise<string> {
    return `/books/${bookId}`;
}

export async function getUnitNavigationUrl(unitId: number): Promise<string> {
    return `/units/${unitId}`;
}

export async function getLessonNavigationUrl(lessonId: number, lessonType: string, mode?: "learn" | "practice" | "test"): Promise<string> {
    if (lessonType === "vocabulary") {
        if (mode === "learn") {
            return `/lessons/${lessonId}/learn`;
        } else if (mode === "practice") {
            return `/lessons/${lessonId}/practice`;
        } else if (mode === "test") {
            return `/lessons/${lessonId}/test`;
        }
        return `/lessons/${lessonId}/vocabulary`;
    }
    return `/units/${lessonId}`; // Fallback
}

// Find vocabulary word and its lesson info
export async function findVocabularyWord(arabicText?: string, englishText?: string) {
    const session = await getSession();
    if (!session) return null;

    try {
        const allBooks = await getBooks();
        
        for (const book of allBooks) {
            const units = await getUnitsByBook(book.id);
            for (const unit of units) {
                const lessons = await getLessonsByUnit(unit.id);
                for (const lesson of lessons) {
                    if (lesson.type === "vocabulary") {
                        const words = await getVocabularyWordsByLesson(lesson.id);
                        for (const word of words) {
                            const matchesArabic = arabicText && word.arabic.includes(arabicText);
                            const matchesEnglish = englishText && word.english.toLowerCase().includes(englishText.toLowerCase());
                            
                            if (matchesArabic || matchesEnglish) {
                                return {
                                    word,
                                    lesson,
                                    unit,
                                    book,
                                    navigationUrl: await getLessonNavigationUrl(lesson.id, lesson.type),
                                };
                            }
                        }
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error("Failed to find vocabulary word:", error);
        return null;
    }
}

// Search functionality
export async function searchLearningContent(query: string) {
    const session = await getSession();
    if (!session) return [];

    try {
        const searchResults: Array<{
            type: "book" | "unit" | "lesson" | "vocabulary";
            id: number;
            title: string;
            arabic?: string;
            english?: string;
            path: string;
            bookTitle?: string;
            unitTitle?: string;
        }> = [];

        const lowerQuery = query.toLowerCase().trim();

        // Search books
        const allBooks = await getBooks();
        for (const book of allBooks) {
            if (
                book.title.toLowerCase().includes(lowerQuery) ||
                (book.description && book.description.toLowerCase().includes(lowerQuery))
            ) {
                searchResults.push({
                    type: "book",
                    id: book.id,
                    title: book.title,
                    path: await getBookNavigationUrl(book.id),
                });
            }
        }

        // Search units
        for (const book of allBooks) {
            const units = await getUnitsByBook(book.id);
            for (const unit of units) {
                if (unit.title.toLowerCase().includes(lowerQuery)) {
                    searchResults.push({
                        type: "unit",
                        id: unit.id,
                        title: unit.title,
                        path: await getUnitNavigationUrl(unit.id),
                        bookTitle: book.title,
                    });
                }
            }
        }

        // Search lessons
        for (const book of allBooks) {
            const units = await getUnitsByBook(book.id);
            for (const unit of units) {
                const lessons = await getLessonsByUnit(unit.id);
                for (const lesson of lessons) {
                    if (lesson.title.toLowerCase().includes(lowerQuery)) {
                        searchResults.push({
                            type: "lesson",
                            id: lesson.id,
                            title: lesson.title,
                            path: await getLessonNavigationUrl(lesson.id, lesson.type),
                            bookTitle: book.title,
                            unitTitle: unit.title,
                        });
                    }
                }
            }
        }

        // Search vocabulary words
        for (const book of allBooks) {
            const units = await getUnitsByBook(book.id);
            for (const unit of units) {
                const lessons = await getLessonsByUnit(unit.id);
                for (const lesson of lessons) {
                    if (lesson.type === "vocabulary") {
                        const words = await getVocabularyWordsByLesson(lesson.id);
                        for (const word of words) {
                            if (
                                word.arabic.includes(query) ||
                                word.english.toLowerCase().includes(lowerQuery)
                            ) {
                                searchResults.push({
                                    type: "vocabulary",
                                    id: word.id,
                                    title: `${word.arabic} - ${word.english}`,
                                    arabic: word.arabic,
                                    english: word.english,
                                    path: await getLessonNavigationUrl(lesson.id, lesson.type),
                                    bookTitle: book.title,
                                    unitTitle: unit.title,
                                });
                            }
                        }
                    }
                }
            }
        }

        return searchResults.slice(0, 20); // Limit to 20 results
    } catch (error) {
        console.error("Failed to search learning content:", error);
        return [];
    }
}

// Test generation
export async function generateTestFromLesson(lessonId: number, questionCount: number = 10) {
    const session = await getSession();
    if (!session) return null;

    try {
        const words = await getVocabularyWordsByLesson(lessonId);
        if (words.length === 0) return null;

        // Shuffle and take up to questionCount words
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        const selectedWords = shuffled.slice(0, Math.min(questionCount, words.length));

        const questions = selectedWords.map((word, index) => {
            // Alternate between Arabic->English and English->Arabic
            const isArabicToEnglish = index % 2 === 0;

            if (isArabicToEnglish) {
                // Generate multiple choice options
                const otherWords = words.filter(w => w.id !== word.id);
                const wrongOptions = otherWords
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 3)
                    .map(w => w.english);
                const options = [word.english, ...wrongOptions].sort(() => Math.random() - 0.5);

                return {
                    question: `What does "${word.arabic}" mean?`,
                    type: "multiple_choice" as const,
                    options,
                    correctAnswer: word.english,
                };
            } else {
                // English to Arabic (translation)
                return {
                    question: `Translate "${word.english}" to Arabic`,
                    type: "translation" as const,
                    correctAnswer: word.arabic,
                };
            }
        });

        return {
            lessonId,
            questions,
            totalQuestions: questions.length,
        };
    } catch (error) {
        console.error("Failed to generate test from lesson:", error);
        return null;
    }
}

export async function processAILearningRequest(
    prompt: string,
    model: string,
    conversationHistory?: ConversationMessage[]
): Promise<ProcessAILearningResult> {
    const session = await getSession();
    if (!session) {
        return {
            success: false,
            message: "Unauthorized",
            error: "You must be logged in to use AI features",
        };
    }

    // Check if AI is available for this user
    const aiAvailable = await isAIAvailableForUser();
    if (!aiAvailable) {
        return {
            success: false,
            message: "AI features are currently disabled",
            error: "AI features are disabled globally or for your account. Please contact an administrator.",
        };
    }

    try {
        // Get learning data for context
        const [allBooks, allBooksProgress] = await Promise.all([
            getBooks(),
            getAllBooksProgress(),
        ]);

        // Build learning structure context
        let learningStructure = "Available learning content:\n";
        const vocabularyWordsList: Array<{ arabic: string; english: string; lessonId: number; bookTitle: string; unitTitle: string; lessonTitle: string }> = [];

        for (const book of allBooks) {
            const progress = allBooksProgress[book.id] || {
                totalWords: 0,
                wordsSeen: 0,
                wordsMastered: 0,
                completionPercentage: 0,
                lastActivityDate: null,
            };

            learningStructure += `\nBook ${book.id}: "${book.title}"${book.description ? ` - ${book.description}` : ""}\n`;
            learningStructure += `  Progress: ${progress.wordsSeen}/${progress.totalWords} words seen, ${progress.wordsMastered} mastered (${progress.completionPercentage.toFixed(0)}%)\n`;

            const units = await getUnitsByBook(book.id);
            for (const unit of units) {
                learningStructure += `  Unit ${unit.id}: "${unit.title}"\n`;

                const lessons = await getLessonsByUnit(unit.id);
                for (const lesson of lessons) {
                    learningStructure += `    Lesson ${lesson.id}: "${lesson.title}" (${lesson.type})\n`;

                    if (lesson.type === "vocabulary") {
                        const words = await getVocabularyWordsByLesson(lesson.id);
                        const lessonProgress = await getLessonProgress(lesson.id);
                        learningStructure += `      Vocabulary: ${words.length} words (${lessonProgress.wordsSeen} seen, ${lessonProgress.wordsMastered} mastered)\n`;

                        // Add words to vocabulary list
                        words.forEach(word => {
                            vocabularyWordsList.push({
                                arabic: word.arabic,
                                english: word.english,
                                lessonId: lesson.id,
                                bookTitle: book.title,
                                unitTitle: unit.title,
                                lessonTitle: lesson.title,
                            });
                        });
                    }
                }
            }
        }

        // Build vocabulary context (limit to avoid token overflow)
        const vocabularyContext = vocabularyWordsList.length > 0
            ? `\n\nVocabulary words (showing up to 100):\n${vocabularyWordsList.slice(0, 100).map((w, i) => `${i + 1}. "${w.arabic}" = "${w.english}" (Lesson: ${w.lessonTitle}, Unit: ${w.unitTitle}, Book: ${w.bookTitle})`).join("\n")}`
            : "\n\nNo vocabulary words available yet.";

        // Get user's progress summary
        const progressSummary = Object.entries(allBooksProgress)
            .map(([bookId, progress]) => {
                const book = allBooks.find(b => b.id === parseInt(bookId));
                return book ? `"${book.title}": ${progress.wordsSeen}/${progress.totalWords} words seen, ${progress.completionPercentage.toFixed(0)}% complete` : "";
            })
            .filter(Boolean)
            .join("\n");

        const systemPrompt = `You are a helpful AI assistant for an Arabic learning platform. Your role is to help users learn, practice, search, navigate, and test their Arabic vocabulary knowledge.

${learningStructure}${vocabularyContext}

User's Progress Summary:
${progressSummary || "No progress data available yet."}

You can help users with the following:

1. **EXPLAIN** - Answer questions about Arabic vocabulary, grammar, or concepts
   - When explaining a word, provide its meaning, usage, and context
   - Reference the vocabulary list above for accurate information
   - IMPORTANT: When explaining a vocabulary word, include the word's Arabic text and English translation in your explanation so the system can automatically generate a navigation link
   - Example: If explaining "welcome", mention both the Arabic (أهلاً وسهلاً) and English (welcome) so users can navigate to that lesson

2. **SEARCH** - Search for content across books, units, lessons, and vocabulary
   - Search by keywords in titles, descriptions, or vocabulary words
   - Return relevant results with navigation paths

3. **NAVIGATE** - Help users navigate to specific content
   - Generate navigation links to books, units, or lessons
   - Use the structure above to find the correct paths

4. **PRACTICE** - Suggest practice exercises based on user progress
   - Recommend words that need review (low correct_count or not seen)
   - Suggest lessons to practice based on completion percentage
   - Provide actionable practice recommendations
   - ALWAYS include navigation links to suggested lessons so users can resume learning immediately
   - When suggesting practice for a specific lesson, ALWAYS include the lesson URL in the practiceSuggestions array
   - Example: If suggesting "Practice Lesson 1.3", include url: "/lessons/{lessonId}/vocabulary" in the practice suggestion

5. **TEST** - Generate quiz questions from lessons
   - Create translation questions (Arabic to English or vice versa)
   - Create multiple choice questions
   - Use vocabulary from the lessons listed above

6. **RESUME LEARNING** - Help users continue their learning journey
   - When users ask about what to study next, where they left off, or want to continue learning, ALWAYS provide direct navigation links to:
     * Lessons they haven't started yet (0% progress)
     * Lessons they've started but not completed (partial progress)
     * Lessons with recent activity (based on lastActivityDate)
   - Use the progress data above to identify the best lessons to suggest
   - Format: "Continue with [Lesson Name]" with a direct link to /lessons/{lessonId}/vocabulary
   - Example: If a user asks "What should I study next?" or "Where did I leave off?", suggest specific lessons with links

CRITICAL: You MUST respond with ONLY valid JSON. No additional text, explanations, or markdown formatting outside the JSON.

Respond ONLY with valid JSON in this exact format:
{
  "message": "Human-readable response explaining what you did (1-3 sentences)",
  "actions": [
    {
      "type": "explain|search|navigate|practice|test",
      "data": {
        "explanation": "...", // for explain
        "searchResults": [...], // for search
        "navigationLinks": [...], // for navigate
        "practiceSuggestions": [...], // for practice
        "testQuestions": [...] // for test
      }
    }
  ],
  "navigationLinks": [
    {"label": "Display text", "url": "/books/1"}
  ]
}

For navigation links, use these URL patterns:
- Books: /books/{bookId}
- Units: /units/{unitId}
- Lessons: 
  - /lessons/{lessonId}/vocabulary (default vocabulary lesson)
  - /lessons/{lessonId}/learn (learn mode - flashcards)
  - /lessons/{lessonId}/practice (practice mode - interactive practice)
  - /lessons/{lessonId}/test (test mode - quiz/test)

For search results, include:
- type: "book" | "unit" | "lesson" | "vocabulary"
- id: number
- title: string
- path: string (navigation URL)
- arabic/english: for vocabulary items

For practice suggestions, include:
- type: "review_words" | "practice_lesson" | "continue_learning"
- description: string
- url: REQUIRED navigation URL (always include a URL when suggesting practice for a specific lesson)

For test questions, include:
- question: string
- type: "translation" | "multiple_choice"
- options: string[] (for multiple_choice)
- correctAnswer: string

Important:
- Always provide helpful, educational responses
- Use the vocabulary list and structure above for accurate information
- When suggesting practice, consider the user's progress data
- Navigation links should be clickable paths to actual content
- Keep responses concise but informative
- If the user's request is unclear, ask for clarification in the message field
- You have access to FULL conversation history for context - use it to understand the full conversation flow
- ALWAYS include navigation links when suggesting lessons, practice, or helping users resume learning
- When users ask about continuing their learning, proactively suggest specific lessons with direct links
- ALWAYS return complete, valid JSON - do not truncate`;

        // Build messages array with conversation history
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt },
        ];

        // Add conversation history if provided (send full context, no limit)
        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                // Build enriched content that includes navigation links and context
                let enrichedContent = msg.content;
                
                // Add navigation links context if available
                if (msg.navigationLinks && msg.navigationLinks.length > 0) {
                    enrichedContent += `\n\n[Previous response included these navigation links: ${msg.navigationLinks.map(link => `${link.label} (${link.url})`).join(", ")}]`;
                }
                
                // Add action context if available
                if (msg.result?.actions && msg.result.actions.length > 0) {
                    const actionTypes = msg.result.actions.map(a => a.type).join(", ");
                    enrichedContent += `\n[Previous response performed actions: ${actionTypes}]`;
                }
                
                messages.push({
                    role: msg.role,
                    content: enrichedContent,
                });
            });
        }

        // Add current user prompt
        messages.push({ role: "user", content: prompt });

        // Call OpenRouter
        const { callOpenRouter } = await import("@/lib/openrouter");
        const response = await callOpenRouter(model, messages, {
            temperature: 0.7, // Higher temperature for more natural explanations
            max_tokens: 3000,
        });

        // Extract response content
        const responseContent = response.choices[0]?.message?.content || "";

        // Check if response was truncated
        const finishReason = response.choices[0]?.finish_reason;
        if (finishReason === "length") {
            return {
                success: false,
                message: "AI response was too long and got truncated. Please try rephrasing your request.",
                error: "Response truncated due to token limit",
            };
        }

        // Parse JSON response
        let aiResponse: AILearningResponse | null = null;
        try {
            let cleanedContent = responseContent.trim();
            cleanedContent = cleanedContent.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
            cleanedContent = cleanedContent.replace(/\s*```\s*$/i, "");

            // Find the first complete JSON object by matching braces properly
            let jsonString = "";
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            let startIndex = -1;

            for (let i = 0; i < cleanedContent.length; i++) {
                const char = cleanedContent[i];

                if (escapeNext) {
                    escapeNext = false;
                    if (startIndex >= 0) jsonString += char;
                    continue;
                }

                if (char === '\\') {
                    escapeNext = true;
                    if (startIndex >= 0) jsonString += char;
                    continue;
                }

                if (char === '"' && !escapeNext) {
                    inString = !inString;
                    if (startIndex >= 0) jsonString += char;
                    continue;
                }

                if (inString) {
                    if (startIndex >= 0) jsonString += char;
                    continue;
                }

                if (char === '{') {
                    if (startIndex === -1) {
                        startIndex = i;
                    }
                    braceCount++;
                    jsonString += char;
                } else if (char === '}') {
                    if (startIndex >= 0) {
                        jsonString += char;
                        braceCount--;
                        if (braceCount === 0) {
                            // Found complete JSON object
                            break;
                        }
                    }
                } else if (startIndex >= 0) {
                    jsonString += char;
                }
            }

            // If we didn't find a complete JSON object, try the regex fallback
            if (braceCount !== 0 || startIndex === -1) {
                // Try multiple patterns to find JSON
                const jsonPatterns = [
                    /\{[\s\S]*\}/,  // Any JSON object
                    /\{[\s\S]*"message"[\s\S]*\}/,  // JSON with message field
                ];
                
                for (const pattern of jsonPatterns) {
                    const jsonMatch = cleanedContent.match(pattern);
                    if (jsonMatch) {
                        jsonString = jsonMatch[0];
                        break;
                    }
                }
                
                // If still no JSON found, try to extract from markdown/text response
                if (!jsonString || jsonString.trim() === "") {
                    // Extract navigation links from markdown/text
                    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
                    const links: Array<{ label: string; url: string }> = [];
                    let linkMatch;
                    while ((linkMatch = linkPattern.exec(cleanedContent)) !== null) {
                        links.push({
                            label: linkMatch[1],
                            url: linkMatch[2],
                        });
                    }
                    
                    // Extract lesson/unit/book references
                    const lessonPattern = /lesson\s+(\d+(?:\.\d+)?)/i;
                    const unitPattern = /unit\s+(\d+)/i;
                    const bookPattern = /book\s+(\d+)/i;
                    
                    // Try to construct a basic response from the text
                    const extractedMessage = cleanedContent
                        .replace(/\*\*/g, "") // Remove markdown bold
                        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Replace markdown links with text
                        .substring(0, 500) // Limit length
                        .trim();
                    
                    // Create a fallback JSON structure with guaranteed navigationLinks array
                    const fallbackNavigationLinks: Array<{ label: string; url: string }> = [...links];
                    
                    // Try to add navigation links based on detected patterns if none were found
                    if (fallbackNavigationLinks.length === 0) {
                        const lessonMatch = cleanedContent.match(lessonPattern);
                        const unitMatch = cleanedContent.match(unitPattern);
                        const bookMatch = cleanedContent.match(bookPattern);
                        
                        if (lessonMatch) {
                            const lessonId = lessonMatch[1];
                            fallbackNavigationLinks.push({
                                label: `Lesson ${lessonId} Vocabulary`,
                                url: `/lessons/${lessonId}/vocabulary`,
                            });
                        } else if (unitMatch) {
                            const unitId = unitMatch[1];
                            fallbackNavigationLinks.push({
                                label: `Unit ${unitId}`,
                                url: `/units/${unitId}`,
                            });
                        } else if (bookMatch) {
                            const bookId = bookMatch[1];
                            fallbackNavigationLinks.push({
                                label: `Book ${bookId}`,
                                url: `/books/${bookId}`,
                            });
                        }
                    }
                    
                    const fallbackJson: AILearningResponse = {
                        message: extractedMessage || "I understand your request. Here's the information:",
                        actions: [],
                        navigationLinks: fallbackNavigationLinks,
                    };
                    
                    aiResponse = fallbackJson;
                    // Skip the JSON.parse step since we already have the object
                    // Continue to process actions below
                }
            }

            // Only parse JSON if we haven't already created a fallback response
            if (aiResponse === null) {
                // Fix incomplete JSON if needed
                let fixedJson = jsonString;
                if (jsonString.trim()) {
                    const openBraces = (jsonString.match(/\{/g) || []).length;
                    const closeBraces = (jsonString.match(/\}/g) || []).length;
                    const missingBraces = openBraces - closeBraces;

                    if (jsonString.includes('"actions"') && jsonString.includes('[')) {
                        const openBrackets = (jsonString.match(/\[/g) || []).length;
                        const closeBrackets = (jsonString.match(/\]/g) || []).length;
                        const missingBrackets = openBrackets - closeBrackets;
                        if (missingBrackets > 0) {
                            fixedJson = jsonString + "]".repeat(missingBrackets);
                        }
                    }

                    if (missingBraces > 0) {
                        fixedJson = fixedJson + "}".repeat(missingBraces);
                    }
                }

                aiResponse = JSON.parse(fixedJson) as AILearningResponse;
            }
        } catch (parseError) {
            const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parsing error";
            const userRequest = prompt.length > 100 ? prompt.substring(0, 100) + "..." : prompt;
            
            // Last resort: try to extract any useful information from the response
            const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
            const links: Array<{ label: string; url: string }> = [];
            let linkMatch;
            while ((linkMatch = linkPattern.exec(responseContent)) !== null) {
                links.push({
                    label: linkMatch[1],
                    url: linkMatch[2],
                });
            }
            
            // Return a structured error with any extracted links
            return {
                success: false,
                message: `Failed to parse AI response. Your request: "${userRequest}"`,
                error: `Invalid JSON response from AI: ${errorMessage}. Response preview: ${responseContent.substring(0, 300)}`,
                navigationLinks: links,
            };
        }

        // Ensure we have a valid response
        if (!aiResponse) {
            return {
                success: false,
                message: "Failed to parse AI response",
                error: "AI response could not be parsed or extracted",
            };
        }

        // Process actions if any
        const processedActions: LearningAction[] = [];
        const navigationLinks: Array<{ label: string; url: string }> = [];

        // Auto-detect vocabulary explanations and add navigation links
        // Look for Arabic text patterns and common vocabulary-related phrases in the message
        const messageText = aiResponse.message || "";
        const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
        const arabicMatches = messageText.match(arabicPattern);
        
        // Also check if the message mentions vocabulary words from our list
        if (arabicMatches && arabicMatches.length > 0) {
            // Try to find the vocabulary word
            for (const arabicText of arabicMatches) {
                const wordInfo = await findVocabularyWord(arabicText);
                if (wordInfo) {
                    // Add wordId as query parameter to navigate to specific word
                    const urlWithWord = `${wordInfo.navigationUrl}?wordId=${wordInfo.word.id}`;
                    navigationLinks.push({
                        label: `View "${wordInfo.word.arabic}" (${wordInfo.word.english}) in ${wordInfo.lesson.title}`,
                        url: urlWithWord,
                    });
                    break; // Only add one link per response to avoid clutter
                }
            }
        }
        
        // Also check for English vocabulary mentions
        const vocabularyKeywords = vocabularyWordsList.map(w => w.english.toLowerCase());
        const lowerMessage = messageText.toLowerCase();
        for (const vocab of vocabularyKeywords) {
            if (lowerMessage.includes(vocab.toLowerCase())) {
                const wordInfo = await findVocabularyWord(undefined, vocab);
                if (wordInfo && !navigationLinks.some(link => link.url.includes(`wordId=${wordInfo.word.id}`))) {
                    // Add wordId as query parameter to navigate to specific word
                    const urlWithWord = `${wordInfo.navigationUrl}?wordId=${wordInfo.word.id}`;
                    navigationLinks.push({
                        label: `View "${wordInfo.word.arabic}" (${wordInfo.word.english}) in ${wordInfo.lesson.title}`,
                        url: urlWithWord,
                    });
                    break;
                }
            }
        }

        if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
            for (const action of aiResponse.actions) {
                // Process search action - perform actual search
                if (action.type === "search" && action.data?.query) {
                    const searchResults = await searchLearningContent(action.data.query);
                    processedActions.push({
                        type: "search",
                        data: {
                            query: action.data.query,
                            searchResults: searchResults.map(result => ({
                                type: result.type,
                                id: result.id,
                                title: result.title,
                                arabic: result.arabic,
                                english: result.english,
                                path: result.path,
                            })),
                        },
                    });

                    // Add navigation links from search results
                    searchResults.forEach(result => {
                        navigationLinks.push({
                            label: result.title,
                            url: result.path,
                        });
                    });
                }
                // Process navigate action
                else if (action.type === "navigate" && action.data) {
                    const navData = action.data as { bookId?: number; unitId?: number; lessonId?: number };
                    if (navData.bookId) {
                        navigationLinks.push({
                            label: allBooks.find(b => b.id === navData.bookId)?.title || `Book ${navData.bookId}`,
                            url: await getBookNavigationUrl(navData.bookId),
                        });
                    }
                    if (navData.unitId) {
                        navigationLinks.push({
                            label: `Unit ${navData.unitId}`,
                            url: await getUnitNavigationUrl(navData.unitId),
                        });
                    }
                    if (navData.lessonId) {
                        const lesson = await getLessonById(navData.lessonId);
                        if (lesson) {
                            navigationLinks.push({
                                label: lesson.title,
                                url: await getLessonNavigationUrl(lesson.id, lesson.type),
                            });
                        }
                    }
                    processedActions.push(action);
                }
                // Process test action - generate actual test
                else if (action.type === "test" && action.data?.lessonId) {
                    const test = await generateTestFromLesson(action.data.lessonId, 10);
                    if (test) {
                        const lesson = await getLessonById(test.lessonId);
                        if (lesson) {
                            navigationLinks.push({
                                label: `${lesson.title} - Test`,
                                url: await getLessonNavigationUrl(lesson.id, lesson.type, "test"),
                            });
                        }
                        processedActions.push({
                            type: "test",
                            data: {
                                lessonId: test.lessonId,
                                testQuestions: test.questions,
                            },
                        });
                    }
                }
                // Process practice action - extract navigation links from practice suggestions
                else if (action.type === "practice" && action.data?.practiceSuggestions) {
                    const practiceSuggestions = action.data.practiceSuggestions as Array<{
                        type: string;
                        description: string;
                        url?: string;
                        lessonId?: number;
                    }>;
                    
                    // Extract navigation links from practice suggestions that have URLs
                    for (const suggestion of practiceSuggestions) {
                        if (suggestion.url) {
                            navigationLinks.push({
                                label: suggestion.description || `Practice: ${suggestion.type}`,
                                url: suggestion.url,
                            });
                        } else if (suggestion.lessonId) {
                            // If no URL but has lessonId, generate practice URL
                            const lesson = await getLessonById(suggestion.lessonId);
                            if (lesson && lesson.type === "vocabulary") {
                                navigationLinks.push({
                                    label: suggestion.description || `${lesson.title} - Practice`,
                                    url: await getLessonNavigationUrl(lesson.id, lesson.type, "practice"),
                                });
                            }
                        }
                    }
                    
                    processedActions.push(action);
                }
                // Other actions (explain) - pass through
                else {
                    processedActions.push(action);
                }
            }
        }

        // Add navigation links from response if provided
        if (aiResponse.navigationLinks && Array.isArray(aiResponse.navigationLinks)) {
            navigationLinks.push(...aiResponse.navigationLinks);
        }

        // Handle "take me there" and similar navigation requests
        const lowerPrompt = prompt.toLowerCase();
        const navigationRequestKeywords = ["take me there", "go there", "navigate", "show me", "open", "let's go"];
        const isNavigationRequest = navigationRequestKeywords.some(keyword => lowerPrompt.includes(keyword));
        
        // If user is asking to navigate but no links were provided, check conversation history
        if (isNavigationRequest && navigationLinks.length === 0 && conversationHistory && conversationHistory.length > 0) {
            // Look for lesson mentions in recent conversation history
            for (let i = conversationHistory.length - 1; i >= 0 && i >= conversationHistory.length - 3; i--) {
                const msg = conversationHistory[i];
                if (msg.role === "assistant" && msg.content) {
                    // Try to extract lesson number from message (e.g., "Lesson 1.3", "lesson 1.3", "1.3")
                    const lessonMatch = msg.content.match(/(?:lesson|unit)\s*(\d+)\.(\d+)/i) || 
                                       msg.content.match(/(\d+)\.(\d+)/);
                    
                    if (lessonMatch) {
                        const unitNum = parseInt(lessonMatch[1]);
                        const lessonNum = parseInt(lessonMatch[2]);
                        
                        // Find the lesson by matching unit and lesson numbers
                        for (const book of allBooks) {
                            const units = await getUnitsByBook(book.id);
                            const unit = units.find(u => u.order === unitNum);
                            if (unit) {
                                const lessons = await getLessonsByUnit(unit.id);
                                const lesson = lessons.find(l => l.order === lessonNum && l.type === "vocabulary");
                                if (lesson) {
                                    const url = await getLessonNavigationUrl(lesson.id, lesson.type);
                                    navigationLinks.push({
                                        label: lesson.title,
                                        url,
                                    });
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Also check if previous message had navigation links that we can reuse
                    if (msg.navigationLinks && msg.navigationLinks.length > 0) {
                        navigationLinks.push(...msg.navigationLinks);
                        break;
                    }
                    
                    // Check if previous message had practice actions with URLs
                    if (msg.result?.actions) {
                        for (const action of msg.result.actions) {
                            if (action.type === "practice" && action.data?.practiceSuggestions) {
                                const suggestions = action.data.practiceSuggestions as Array<{
                                    type: string;
                                    description: string;
                                    url?: string;
                                }>;
                                suggestions.forEach(suggestion => {
                                    if (suggestion.url && !navigationLinks.some(link => link.url === suggestion.url)) {
                                        navigationLinks.push({
                                            label: suggestion.description || `Practice: ${suggestion.type}`,
                                            url: suggestion.url,
                                        });
                                    }
                                });
                            }
                        }
                    }
                    
                    if (navigationLinks.length > 0) break;
                }
            }
        }

        // Auto-suggest lessons for resuming learning if user asks about continuing/next steps
        const resumeKeywords = ["continue", "next", "resume", "where did i", "what should i study", "what's next", "keep learning", "go back to"];
        const shouldSuggestResume = resumeKeywords.some(keyword => lowerPrompt.includes(keyword));

        if (shouldSuggestResume && navigationLinks.length === 0) {
            // Find lessons with partial progress or recent activity
            const lessonsToSuggest: Array<{ lessonId: number; title: string; progress: number; lastActivity: Date | null }> = [];
            
            for (const book of allBooks) {
                const units = await getUnitsByBook(book.id);
                for (const unit of units) {
                    const lessons = await getLessonsByUnit(unit.id);
                    for (const lesson of lessons) {
                        if (lesson.type === "vocabulary") {
                            const lessonProgress = await getLessonProgress(lesson.id);
                            // Suggest lessons that are:
                            // 1. Started but not completed (0% < progress < 100%)
                            // 2. Not started but have recent activity in the unit
                            // 3. Have recent activity
                            if (lessonProgress.totalWords > 0) {
                                const progressPercent = lessonProgress.completionPercentage;
                                if ((progressPercent > 0 && progressPercent < 100) || 
                                    (progressPercent === 0 && lessonProgress.lastActivityDate)) {
                                    lessonsToSuggest.push({
                                        lessonId: lesson.id,
                                        title: lesson.title,
                                        progress: progressPercent,
                                        lastActivity: lessonProgress.lastActivityDate,
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Sort by: recent activity first, then by progress (partial progress preferred)
            lessonsToSuggest.sort((a, b) => {
                if (a.lastActivity && b.lastActivity) {
                    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
                }
                if (a.lastActivity) return -1;
                if (b.lastActivity) return 1;
                // Prefer partial progress over not started
                if (a.progress > 0 && b.progress === 0) return -1;
                if (b.progress > 0 && a.progress === 0) return 1;
                return b.progress - a.progress;
            });

            // Add top 3 suggestions
            for (const lesson of lessonsToSuggest.slice(0, 3)) {
                const lessonObj = await getLessonById(lesson.lessonId);
                if (lessonObj) {
                    const url = await getLessonNavigationUrl(lessonObj.id, lessonObj.type);
                    navigationLinks.push({
                        label: `Continue: ${lesson.title} (${lesson.progress}% complete)`,
                        url,
                    });
                }
            }
        }

        return {
            success: true,
            message: aiResponse.message || "Request processed successfully",
            actions: processedActions.length > 0 ? processedActions : undefined,
            navigationLinks: navigationLinks.length > 0 ? navigationLinks : undefined,
        };
    } catch (error) {
        console.error("Failed to process AI learning request:", error);
        return {
            success: false,
            message: "Failed to process request",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

export async function processAITodoRequest(
    prompt: string, 
    model: string, 
    conversationHistory?: ConversationMessage[]
): Promise<ProcessAITodoResult> {
    const session = await getSession();
    if (!session) {
        return {
            success: false,
            message: "Unauthorized",
            executedActions: [],
            error: "You must be logged in to use AI features",
        };
    }

    // Check if AI is available for this user
    const aiAvailable = await isAIAvailableForUser();
    if (!aiAvailable) {
        return {
            success: false,
            message: "AI features are currently disabled",
            executedActions: [],
            error: "AI features are disabled globally or for your account. Please contact an administrator.",
        };
    }

    try {
        // Get current todos and groups for context
        const [currentTodos, userGroups] = await Promise.all([getTodos(), getGroups()]);

        // Get OpenRouter config
        const { callOpenRouter } = await import("@/lib/openrouter");

        // Construct system prompt
        const groupsInfo = userGroups.length > 0 
            ? `\nAvailable groups:\n${userGroups.map(g => `- ID: ${g.id}, Name: "${g.name}"${g.description ? `, Description: "${g.description}"` : ""}`).join("\n")}`
            : "\nNo groups available.";

        const todosInfo = currentTodos.length === 0 
            ? "No todos yet." 
            : currentTodos.map(t => {
                const groupInfo = t.group ? `, Group: "${t.group.name}" (ID: ${t.group.id})` : ", Group: None";
                return `- ID: ${t.id}, Content: "${t.content}", Completed: ${t.completed}${groupInfo}`;
            }).join("\n");

        const systemPrompt = `You are a helpful assistant that manages todo lists. The user will give you instructions about their todos, and you need to respond with a JSON object containing an array of actions to perform.

Current todos:
${todosInfo}${groupsInfo}

You can perform the following actions:
1. "add" - Add a new todo. Requires: {"type": "add", "content": "task description", "groupId": <group_id_or_name>} (groupId is optional - omit or set to null for no group. Can be a number ID or group name string)
2. "edit" - Edit an existing todo. Requires: {"type": "edit", "id": <todo_id>, "content": "updated content", "groupId": <group_id_or_name>} (groupId is optional - omit to keep current group, set to null to remove from group. Can be a number ID or group name string)
3. "complete" - Mark a todo as completed. Requires: {"type": "complete", "id": <todo_id>}
4. "uncomplete" - Mark a completed todo as active (uncomplete it). Requires: {"type": "uncomplete", "id": <todo_id>}
5. "delete" - Delete a todo. Requires: {"type": "delete", "id": <todo_id>}
6. "create_group" - Create a new group. Requires: {"type": "create_group", "groupName": "group name", "groupColor": "#3B82F6", "groupDescription": "optional description"}. groupColor and groupDescription are optional. After creating a group, you can immediately use its name in subsequent "add" actions in the same request.
7. "delete_group" - Delete a group. Requires: {"type": "delete_group", "groupId": <group_id_or_name>}. This will move all todos in the group to "Uncategorized" (no group). groupId can be a number ID or group name string.

CRITICAL: You MUST respond with ONLY valid JSON. No additional text, explanations, or markdown formatting outside the JSON. Your response must be parseable JSON.

Respond ONLY with valid JSON in this exact format:
{
  "actions": [
    {"type": "add", "content": "Task description", "groupId": 1},
    {"type": "add", "content": "Task without group"},
    {"type": "edit", "id": 1, "content": "Updated content", "groupId": 2},
    {"type": "complete", "id": 2},
    {"type": "uncomplete", "id": 3},
    {"type": "delete", "id": 4},
    {"type": "create_group", "groupName": "Work", "groupColor": "#3B82F6", "groupDescription": "Work-related tasks"},
    {"type": "add", "content": "Finish report", "groupId": "Work"},
    {"type": "delete_group", "groupId": 1}
  ],
  "message": "Brief explanation (keep it short, 1-2 sentences max)"
}

Important:
- Only reference todo IDs that exist in the current todos list
- For groupId in "add", "edit", and "delete_group" actions, you can use either:
  * A number (the group ID from the available groups list)
  * A string (the group name) - the system will resolve it to the ID
- For "edit", "complete", "uncomplete", and "delete" actions, the todo ID must exist
- For "create_group" action, groupName is required. groupColor (hex color like "#3B82F6") and groupDescription are optional
- For "delete_group" action, groupId can be a number ID or group name string
- Group names must be unique per user - check existing groups before creating to avoid duplicates
- You can perform multiple actions in one response, and actions are executed in order
- CRITICAL: After creating a group with "create_group", you can immediately use that group's NAME in subsequent "add" actions in the same request. The system will automatically resolve the group name to its ID.
- Example workflow: [{"type": "create_group", "groupName": "Work"}, {"type": "add", "content": "Finish report", "groupId": "Work"}] - this creates a group and adds a task to it in one request
- If the user's request is unclear or cannot be fulfilled, return an empty actions array and explain in the message field
- You have access to the full conversation history, so you can understand context and follow-up questions
- When the user says "second one", "first task", etc., refer to the todos list above to identify the correct ID
- When the user mentions a group name that doesn't exist, create it first with "create_group", then use it in subsequent actions
- For "add" and "edit" actions, you can optionally include "groupId" to assign todos to groups
- If groupId is not specified in an action, the todo will have no group (or keep its current group for edits)
- When deleting a group, all todos in that group will be moved to "Uncategorized" (no group)
- When creating a group, if it's the user's first group, it will automatically be set as the default group
- ALWAYS return complete, valid JSON - do not truncate or leave JSON incomplete
- Keep the "message" field brief (1-2 sentences) to avoid token limits
- Your response should be concise - the JSON structure is small, so focus on completing it properly`;

        // Build messages array with conversation history
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt },
        ];

        // Add conversation history if provided (limit to last 10 messages to prevent token overflow)
        if (conversationHistory && conversationHistory.length > 0) {
            // Only include the most recent messages to save tokens
            const recentHistory = conversationHistory.slice(-10);
            recentHistory.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content,
                });
            });
        }

        // Add current user prompt
        messages.push({ role: "user", content: prompt });

        // Call OpenRouter
        const response = await callOpenRouter(model, messages, {
            temperature: 0.3, // Lower temperature for more consistent JSON output
            max_tokens: 2000, // Increased to ensure complete JSON responses even with longer messages
        });

        // Extract response content
        const responseContent = response.choices[0]?.message?.content || "";
        
        // Check if response was truncated
        const finishReason = response.choices[0]?.finish_reason;
        if (finishReason === "length") {
            return {
                success: false,
                message: "AI response was too long and got truncated. Please try rephrasing your request.",
                executedActions: [],
                error: "Response truncated due to token limit",
            };
        }
        
        // Parse JSON response (handle code blocks if present)
        let aiResponse: AITodoResponse;
        try {
            // Clean the response - remove markdown code blocks if present
            let cleanedContent = responseContent.trim();
            
            // Remove markdown code blocks
            cleanedContent = cleanedContent.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
            cleanedContent = cleanedContent.replace(/\s*```\s*$/i, "");
            
            // Try to extract JSON object
            const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0];
                // Try to fix incomplete JSON by checking if it ends properly
                let fixedJson = jsonString;
                
                // If JSON seems incomplete, try to close it
                if (!jsonString.trim().endsWith("}")) {
                    // Count open braces
                    const openBraces = (jsonString.match(/\{/g) || []).length;
                    const closeBraces = (jsonString.match(/\}/g) || []).length;
                    const missingBraces = openBraces - closeBraces;
                    
                    // If we're inside an array, try to close it
                    if (jsonString.includes('"actions"') && jsonString.includes('[')) {
                        const openBrackets = (jsonString.match(/\[/g) || []).length;
                        const closeBrackets = (jsonString.match(/\]/g) || []).length;
                        const missingBrackets = openBrackets - closeBrackets;
                        
                        if (missingBrackets > 0) {
                            fixedJson = jsonString + "]".repeat(missingBrackets);
                        }
                    }
                    
                    // Close any missing braces
                    if (missingBraces > 0) {
                        fixedJson = fixedJson + "}".repeat(missingBraces);
                    }
                }
                
                aiResponse = JSON.parse(fixedJson) as AITodoResponse;
            } else {
                // Try parsing the whole content
                aiResponse = JSON.parse(cleanedContent) as AITodoResponse;
            }
        } catch (parseError) {
            const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parsing error";
            // Include the user's request in the error for context
            const userRequest = prompt.length > 100 ? prompt.substring(0, 100) + "..." : prompt;
            return {
                success: false,
                message: `Failed to parse AI response. Your request: "${userRequest}"`,
                executedActions: [],
                error: `Invalid JSON response from AI: ${errorMessage}. Response preview: ${responseContent.substring(0, 300)}`,
            };
        }

        // Validate response structure
        if (!aiResponse.actions || !Array.isArray(aiResponse.actions)) {
            return {
                success: false,
                message: "Invalid response format from AI",
                executedActions: [],
                error: "AI response does not contain a valid actions array",
            };
        }

        // Execute actions
        const executedActions: ProcessAITodoResult["executedActions"] = [];
        let currentGroups = userGroups; // Keep track of groups, updating after creates

        // Helper function to resolve group by name or ID
        const resolveGroup = (groupIdOrName: number | string | null | undefined): number | null => {
            if (groupIdOrName === null || groupIdOrName === undefined) {
                return null;
            }
            if (typeof groupIdOrName === "number") {
                const group = currentGroups.find(g => g.id === groupIdOrName);
                return group ? group.id : null;
            }
            // It's a string (group name)
            const group = currentGroups.find(g => g.name.toLowerCase() === groupIdOrName.toLowerCase().trim());
            return group ? group.id : null;
        };

        for (const action of aiResponse.actions) {
            try {
                // Validate action
                if (!action.type || !["add", "edit", "complete", "uncomplete", "delete", "delete_group", "create_group"].includes(action.type)) {
                    executedActions.push({
                        ...action,
                        success: false,
                        error: "Invalid action type",
                    });
                    continue;
                }

                // Execute based on action type
                switch (action.type) {
                    case "add":
                        if (!action.content || action.content.trim() === "") {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: "Content is required for add action",
                            });
                            break;
                        }
                        // Verify groupId if provided (can be number ID or string name)
                        let addGroupId: number | null = null;
                        if (action.groupId !== undefined && action.groupId !== null) {
                            const resolvedId = resolveGroup(action.groupId);
                            if (resolvedId === null) {
                                executedActions.push({
                                    ...action,
                                    success: false,
                                    error: `Group "${action.groupId}" not found`,
                                });
                                break;
                            }
                            addGroupId = resolvedId;
                        }
                        await db.insert(todos).values({
                            content: action.content.trim(),
                            userId: session.user.id,
                            groupId: addGroupId,
                        });
                        executedActions.push({
                            ...action,
                            success: true,
                        });
                        break;

                    case "edit":
                        if (!action.id || !action.content) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: "ID and content are required for edit action",
                            });
                            break;
                        }
                        // Verify todo belongs to user
                        const editTodo = currentTodos.find(t => t.id === action.id);
                        if (!editTodo) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: `Todo with ID ${action.id} not found`,
                            });
                            break;
                        }
                        // Verify groupId if provided (can be number ID or string name)
                        let editGroupId: number | null | undefined = undefined;
                        if (action.groupId !== undefined) {
                            if (action.groupId !== null) {
                                const resolvedId = resolveGroup(action.groupId);
                                if (resolvedId === null) {
                                    executedActions.push({
                                        ...action,
                                        success: false,
                                        error: `Group "${action.groupId}" not found`,
                                    });
                                    break;
                                }
                                editGroupId = resolvedId;
                            } else {
                                editGroupId = null;
                            }
                        }
                        const updateData: { content: string; groupId?: number | null } = { content: action.content.trim() };
                        if (editGroupId !== undefined) {
                            updateData.groupId = editGroupId;
                        }
                        await db
                            .update(todos)
                            .set(updateData)
                            .where(and(eq(todos.id, action.id), eq(todos.userId, session.user.id)));
                        executedActions.push({
                            ...action,
                            success: true,
                        });
                        break;

                    case "complete":
                        if (!action.id) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: "ID is required for complete action",
                            });
                            break;
                        }
                        // Verify todo belongs to user
                        const completeTodo = currentTodos.find(t => t.id === action.id);
                        if (!completeTodo) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: `Todo with ID ${action.id} not found`,
                            });
                            break;
                        }
                        await db
                            .update(todos)
                            .set({ completed: true })
                            .where(and(eq(todos.id, action.id), eq(todos.userId, session.user.id)));
                        executedActions.push({
                            ...action,
                            success: true,
                        });
                        break;

                    case "uncomplete":
                        if (!action.id) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: "ID is required for uncomplete action",
                            });
                            break;
                        }
                        // Verify todo belongs to user
                        const uncompleteTodo = currentTodos.find(t => t.id === action.id);
                        if (!uncompleteTodo) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: `Todo with ID ${action.id} not found`,
                            });
                            break;
                        }
                        await db
                            .update(todos)
                            .set({ completed: false })
                            .where(and(eq(todos.id, action.id), eq(todos.userId, session.user.id)));
                        executedActions.push({
                            ...action,
                            success: true,
                        });
                        break;

                    case "delete":
                        if (!action.id) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: "ID is required for delete action",
                            });
                            break;
                        }
                        // Verify todo belongs to user
                        const deleteTodo = currentTodos.find(t => t.id === action.id);
                        if (!deleteTodo) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: `Todo with ID ${action.id} not found`,
                            });
                            break;
                        }
                        await db
                            .delete(todos)
                            .where(and(eq(todos.id, action.id), eq(todos.userId, session.user.id)));
                        executedActions.push({
                            ...action,
                            success: true,
                        });
                        break;

                    case "create_group":
                        if (!action.groupName || action.groupName.trim() === "") {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: "groupName is required for create_group action",
                            });
                            break;
                        }
                        // Check if group name already exists
                        if (userGroups.some(g => g.name.toLowerCase() === action.groupName!.toLowerCase().trim())) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: `A group with the name "${action.groupName}" already exists`,
                            });
                            break;
                        }
                        // Create the group using FormData
                        const groupFormData = new FormData();
                        groupFormData.append("name", action.groupName.trim());
                        if (action.groupColor) {
                            groupFormData.append("color", action.groupColor.trim());
                        }
                        if (action.groupDescription) {
                            groupFormData.append("description", action.groupDescription.trim());
                        }
                        await createGroup(groupFormData);
                        
                        // Refresh groups list so subsequent actions can use the newly created group
                        currentGroups = await getGroups();
                        
                        executedActions.push({
                            ...action,
                            success: true,
                        });
                        break;

                    case "delete_group":
                        if (action.groupId === undefined || action.groupId === null) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: "groupId is required for delete_group action",
                            });
                            break;
                        }
                        // Resolve group by ID or name
                        const groupToDeleteId = resolveGroup(action.groupId);
                        if (groupToDeleteId === null) {
                            executedActions.push({
                                ...action,
                                success: false,
                                error: `Group "${action.groupId}" not found`,
                            });
                            break;
                        }
                        // Delete the group (this will set todos' groupId to null)
                        await deleteGroup(groupToDeleteId);
                        
                        // Refresh groups list after deletion
                        currentGroups = await getGroups();
                        
                        executedActions.push({
                            ...action,
                            success: true,
                        });
                        break;
                }
            } catch (actionError) {
                executedActions.push({
                    ...action,
                    success: false,
                    error: actionError instanceof Error ? actionError.message : "Unknown error",
                });
            }
        }

        // Revalidate the page
        revalidatePath("/");

        const successCount = executedActions.filter(a => a.success).length;
        const failureCount = executedActions.filter(a => !a.success).length;

        return {
            success: successCount > 0,
            message: aiResponse.message || `Executed ${successCount} action(s)${failureCount > 0 ? `, ${failureCount} failed` : ""}`,
            executedActions,
        };
    } catch (error) {
        console.error("Failed to process AI todo request:", error);
        return {
            success: false,
            message: "Failed to process request",
            executedActions: [],
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

export async function getAvailableModelsForUsersAction() {
    const { getAvailableModelsForUsers } = await import("@/lib/openrouter");
    return await getAvailableModelsForUsers();
}

export async function getDefaultModelAction() {
    const { getDefaultModel } = await import("@/lib/openrouter");
    return await getDefaultModel();
}

export async function isOpenRouterAvailable() {
    try {
        const { getOpenRouterConfig } = await import("@/lib/openrouter");
        const config = await getOpenRouterConfig();
        
        if (!config || !config.apiKey) {
            return false;
        }
        
        if (!config.supportedModels || config.supportedModels.length === 0) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("Failed to check OpenRouter availability:", error);
        return false;
    }
}

/**
 * Check if AI is available for the current user
 * This checks:
 * 1. Global AI setting (must be enabled)
 * 2. User-specific AI setting (must be enabled)
 * 3. OpenRouter configuration (must be configured)
 */
export async function isAIAvailableForUser(): Promise<boolean> {
    try {
        // First check OpenRouter configuration
        const openRouterAvailable = await isOpenRouterAvailable();
        if (!openRouterAvailable) {
            return false;
        }

        // Check global AI setting
        const globalAISetting = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "ai.global_enabled"))
            .limit(1);

        // If global setting exists and is false, AI is disabled
        if (globalAISetting.length > 0) {
            const globalEnabled = JSON.parse(globalAISetting[0].value) === true;
            if (!globalEnabled) {
                return false;
            }
        }
        // If global setting doesn't exist, default to enabled

        // Check user-specific setting
        const session = await getSession();
        if (!session) {
            return false;
        }

        const currentUser = await db
            .select({ aiEnabled: user.aiEnabled })
            .from(user)
            .where(eq(user.id, session.user.id))
            .limit(1);

        if (currentUser.length === 0) {
            return false;
        }

        // User AI setting defaults to true if not set (null/undefined)
        const userAIEnabled = currentUser[0].aiEnabled !== false;

        return userAIEnabled;
    } catch (error) {
        console.error("Failed to check AI availability for user:", error);
        return false;
    }
}

// Book and Content Management Actions (User-facing)
export async function getBooks() {
    const session = await getSession();
    if (!session) return [];

    try {
        return await db
            .select()
            .from(books)
            .where(eq(books.enabled, true))
            .orderBy(asc(books.order), asc(books.id));
    } catch (error) {
        console.error("Failed to fetch books:", error);
        return [];
    }
}

// Public function to get books with statistics (no auth required)
export async function getBooksWithStats() {
    try {
        const allBooks = await db
            .select()
            .from(books)
            .where(eq(books.enabled, true))
            .orderBy(asc(books.order), asc(books.id));

        const booksWithStats = await Promise.all(
            allBooks.map(async (book) => {
                // Count units (only enabled ones)
                const bookUnits = await db
                    .select({ id: units.id })
                    .from(units)
                    .where(and(eq(units.bookId, book.id), eq(units.enabled, true)));
                
                const unitIds = bookUnits.map(u => u.id);
                
                // Count lessons (only enabled ones)
                let lessonCount = 0;
                if (unitIds.length > 0) {
                    const lessonsResult = await db
                        .select({ count: sql<number>`COUNT(*)`.as('count') })
                        .from(lessons)
                        .where(and(inArray(lessons.unitId, unitIds), eq(lessons.enabled, true)));
                    lessonCount = Number(lessonsResult[0]?.count || 0);
                }
                
                // Count vocabulary words (only from enabled lessons)
                let vocabularyCount = 0;
                if (unitIds.length > 0) {
                    const vocabularyResult = await db
                        .select({ count: sql<number>`COUNT(*)`.as('count') })
                        .from(vocabularyWords)
                        .innerJoin(lessons, eq(vocabularyWords.lessonId, lessons.id))
                        .where(and(inArray(lessons.unitId, unitIds), eq(lessons.enabled, true)));
                    vocabularyCount = Number(vocabularyResult[0]?.count || 0);
                }

                return {
                    ...book,
                    stats: {
                        units: bookUnits.length,
                        lessons: lessonCount,
                        vocabularyWords: vocabularyCount,
                    },
                };
            })
        );

        return booksWithStats;
    } catch (error) {
        console.error("Failed to fetch books with stats:", error);
        return [];
    }
}

export async function getBookById(id: number) {
    const session = await getSession();
    if (!session) return null;

    try {
        const [book] = await db
            .select()
            .from(books)
            .where(and(eq(books.id, id), eq(books.enabled, true)))
            .limit(1);
        return book || null;
    } catch (error) {
        console.error("Failed to fetch book:", error);
        return null;
    }
}

export async function getUnitsByBook(bookId: number) {
    const session = await getSession();
    if (!session) return [];

    try {
        // First check if the book is enabled
        const [book] = await db
            .select()
            .from(books)
            .where(and(eq(books.id, bookId), eq(books.enabled, true)))
            .limit(1);
        
        if (!book) return [];

        return await db
            .select()
            .from(units)
            .where(and(eq(units.bookId, bookId), eq(units.enabled, true)))
            .orderBy(asc(units.order), asc(units.id));
    } catch (error) {
        console.error("Failed to fetch units:", error);
        return [];
    }
}

export async function getUnitById(id: number) {
    const session = await getSession();
    if (!session) return null;

    try {
        // Get unit and verify it and its book are enabled
        const [unit] = await db
            .select({
                id: units.id,
                bookId: units.bookId,
                title: units.title,
                order: units.order,
                enabled: units.enabled,
                createdAt: units.createdAt,
                updatedAt: units.updatedAt,
            })
            .from(units)
            .innerJoin(books, eq(units.bookId, books.id))
            .where(and(
                eq(units.id, id),
                eq(units.enabled, true),
                eq(books.enabled, true)
            ))
            .limit(1);
        return unit || null;
    } catch (error) {
        console.error("Failed to fetch unit:", error);
        return null;
    }
}

export async function getLessonsByUnit(unitId: number) {
    const session = await getSession();
    if (!session) return [];

    try {
        // First check if the unit and its book are enabled
        const [unit] = await db
            .select()
            .from(units)
            .innerJoin(books, eq(units.bookId, books.id))
            .where(and(
                eq(units.id, unitId),
                eq(units.enabled, true),
                eq(books.enabled, true)
            ))
            .limit(1);
        
        if (!unit) return [];

        return await db
            .select()
            .from(lessons)
            .where(and(eq(lessons.unitId, unitId), eq(lessons.enabled, true)))
            .orderBy(asc(lessons.order), asc(lessons.id));
    } catch (error) {
        console.error("Failed to fetch lessons:", error);
        return [];
    }
}

export async function getLessonById(id: number) {
    const session = await getSession();
    if (!session) return null;

    try {
        // Get lesson and verify it, its unit, and its book are all enabled
        const [lesson] = await db
            .select({
                id: lessons.id,
                unitId: lessons.unitId,
                title: lessons.title,
                type: lessons.type,
                order: lessons.order,
                enabled: lessons.enabled,
                createdAt: lessons.createdAt,
                updatedAt: lessons.updatedAt,
            })
            .from(lessons)
            .innerJoin(units, eq(lessons.unitId, units.id))
            .innerJoin(books, eq(units.bookId, books.id))
            .where(and(
                eq(lessons.id, id),
                eq(lessons.enabled, true),
                eq(units.enabled, true),
                eq(books.enabled, true)
            ))
            .limit(1);
        return lesson || null;
    } catch (error) {
        console.error("Failed to fetch lesson:", error);
        return null;
    }
}

export async function getVocabularyWordsByLesson(lessonId: number) {
    const session = await getSession();
    if (!session) return [];

    try {
        // First verify that the lesson, unit, and book are all enabled
        const [lesson] = await db
            .select()
            .from(lessons)
            .innerJoin(units, eq(lessons.unitId, units.id))
            .innerJoin(books, eq(units.bookId, books.id))
            .where(and(
                eq(lessons.id, lessonId),
                eq(lessons.enabled, true),
                eq(units.enabled, true),
                eq(books.enabled, true)
            ))
            .limit(1);
        
        if (!lesson) return [];

        return await db
            .select()
            .from(vocabularyWords)
            .where(eq(vocabularyWords.lessonId, lessonId))
            .orderBy(asc(vocabularyWords.order), asc(vocabularyWords.id));
    } catch (error) {
        console.error("Failed to fetch vocabulary words:", error);
        return [];
    }
}

export async function getConversationSentencesByLesson(lessonId: number) {
    const session = await getSession();
    if (!session) return [];

    try {
        // First verify that the lesson, unit, and book are all enabled
        const [lesson] = await db
            .select()
            .from(lessons)
            .innerJoin(units, eq(lessons.unitId, units.id))
            .innerJoin(books, eq(units.bookId, books.id))
            .where(and(
                eq(lessons.id, lessonId),
                eq(lessons.enabled, true),
                eq(units.enabled, true),
                eq(books.enabled, true)
            ))
            .limit(1);
        
        if (!lesson) return [];

        return await db
            .select()
            .from(conversationSentences)
            .where(eq(conversationSentences.lessonId, lessonId))
            .orderBy(asc(conversationSentences.order), asc(conversationSentences.id));
    } catch (error) {
        console.error("Failed to fetch conversation sentences:", error);
        return [];
    }
}

// Progress Tracking Actions
export async function getUserProgress(lessonId: number) {
    const session = await getSession();
    if (!session) return {};

    try {
        // Get all words for this lesson
        const words = await getVocabularyWordsByLesson(lessonId);
        const wordIds = words.map(w => w.id);

        if (wordIds.length === 0) return {};

        // Get progress for all words
        const progress = await db
            .select()
            .from(userProgress)
            .where(
                and(
                    eq(userProgress.userId, session.user.id),
                    inArray(userProgress.wordId, wordIds)
                )
            );

        // Create a map of wordId -> progress
        const progressMap: Record<number, typeof userProgress.$inferSelect> = {};
        progress.forEach(p => {
            progressMap[p.wordId] = p;
        });

        return progressMap;
    } catch (error) {
        console.error("Failed to fetch user progress:", error);
        return {};
    }
}

export async function updateUserProgress(wordId: number, data: { seen?: boolean; correct?: boolean; incorrect?: boolean }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    try {
        // Check if progress exists
        const [existing] = await db
            .select()
            .from(userProgress)
            .where(
                and(
                    eq(userProgress.userId, session.user.id),
                    eq(userProgress.wordId, wordId)
                )
            )
            .limit(1);

        const updateData: {
            seen?: boolean;
            correctCount?: number;
            incorrectCount?: number;
            lastReviewedAt?: Date;
            updatedAt: Date;
        } = {
            updatedAt: new Date(),
        };

        if (data.seen !== undefined) {
            updateData.seen = data.seen;
        }

        if (existing) {
            // Update existing progress
            if (data.correct) {
                updateData.correctCount = (existing.correctCount || 0) + 1;
            }
            if (data.incorrect) {
                updateData.incorrectCount = (existing.incorrectCount || 0) + 1;
            }
            if (data.seen !== undefined || data.correct || data.incorrect) {
                updateData.lastReviewedAt = new Date();
            }

            await db
                .update(userProgress)
                .set(updateData)
                .where(
                    and(
                        eq(userProgress.userId, session.user.id),
                        eq(userProgress.wordId, wordId)
                    )
                );
        } else {
            // Create new progress
            const newProgress: typeof userProgress.$inferInsert = {
                userId: session.user.id,
                wordId,
                seen: data.seen ?? false,
                correctCount: data.correct ? 1 : 0,
                incorrectCount: data.incorrect ? 1 : 0,
                lastReviewedAt: (data.seen !== undefined || data.correct || data.incorrect) ? new Date() : null,
            };

            await db.insert(userProgress).values(newProgress);
        }

        // Find lessonId from wordId to revalidate
        const [word] = await db
            .select({ lessonId: vocabularyWords.lessonId })
            .from(vocabularyWords)
            .where(eq(vocabularyWords.id, wordId))
            .limit(1);
        
        if (word) {
            revalidatePath(`/lessons/${word.lessonId}/vocabulary`);
        }
    } catch (error) {
        console.error("Failed to update user progress:", error);
        throw error;
    }
}

// Progress Calculation Types
export type ProgressData = {
    totalWords: number;
    wordsSeen: number;
    wordsMastered: number;
    completionPercentage: number;
    lastActivityDate: Date | null;
};

// Calculate progress for a lesson
export async function getLessonProgress(lessonId: number): Promise<ProgressData> {
    const session = await getSession();
    if (!session) {
        return {
            totalWords: 0,
            wordsSeen: 0,
            wordsMastered: 0,
            completionPercentage: 0,
            lastActivityDate: null,
        };
    }

    try {
        // Get all words for this lesson
        const words = await getVocabularyWordsByLesson(lessonId);
        const wordIds = words.map(w => w.id);

        if (wordIds.length === 0) {
            return {
                totalWords: 0,
                wordsSeen: 0,
                wordsMastered: 0,
                completionPercentage: 0,
                lastActivityDate: null,
            };
        }

        // Get progress for all words
        const progress = await db
            .select()
            .from(userProgress)
            .where(
                and(
                    eq(userProgress.userId, session.user.id),
                    inArray(userProgress.wordId, wordIds)
                )
            );

        // Create a map of wordId -> progress
        const progressMap: Record<number, typeof userProgress.$inferSelect> = {};
        progress.forEach(p => {
            progressMap[p.wordId] = p;
        });

        // Calculate metrics
        const totalWords = wordIds.length;
        let wordsSeen = 0;
        let wordsMastered = 0;
        let lastActivityDate: Date | null = null;

        words.forEach(word => {
            const prog = progressMap[word.id];
            if (prog) {
                if (prog.seen) {
                    wordsSeen++;
                }
                // Word is mastered if correctCount > incorrectCount OR correctCount >= 2
                if (prog.correctCount > prog.incorrectCount || prog.correctCount >= 2) {
                    wordsMastered++;
                }
                if (prog.lastReviewedAt) {
                    const reviewDate = new Date(prog.lastReviewedAt);
                    if (!lastActivityDate || reviewDate > lastActivityDate) {
                        lastActivityDate = reviewDate;
                    }
                }
            }
        });

        const completionPercentage = totalWords > 0 ? Math.round((wordsMastered / totalWords) * 100) : 0;

        return {
            totalWords,
            wordsSeen,
            wordsMastered,
            completionPercentage,
            lastActivityDate,
        };
    } catch (error) {
        console.error("Failed to calculate lesson progress:", error);
        return {
            totalWords: 0,
            wordsSeen: 0,
            wordsMastered: 0,
            completionPercentage: 0,
            lastActivityDate: null,
        };
    }
}

// Calculate progress for a unit
export async function getUnitProgress(unitId: number): Promise<ProgressData> {
    const session = await getSession();
    if (!session) {
        return {
            totalWords: 0,
            wordsSeen: 0,
            wordsMastered: 0,
            completionPercentage: 0,
            lastActivityDate: null,
        };
    }

    try {
        // Get all lessons in this unit
        const unitLessons = await getLessonsByUnit(unitId);
        
        // Only count vocabulary lessons
        const vocabularyLessons = unitLessons.filter(l => l.type === "vocabulary");
        
        if (vocabularyLessons.length === 0) {
            return {
                totalWords: 0,
                wordsSeen: 0,
                wordsMastered: 0,
                completionPercentage: 0,
                lastActivityDate: null,
            };
        }

        // Aggregate progress from all lessons
        let totalWords = 0;
        let wordsSeen = 0;
        let wordsMastered = 0;
        let lastActivityDate: Date | null = null;

        for (const lesson of vocabularyLessons) {
            const lessonProgress = await getLessonProgress(lesson.id);
            totalWords += lessonProgress.totalWords;
            wordsSeen += lessonProgress.wordsSeen;
            wordsMastered += lessonProgress.wordsMastered;
            
            if (lessonProgress.lastActivityDate) {
                const activityDate = new Date(lessonProgress.lastActivityDate);
                if (!lastActivityDate || activityDate > lastActivityDate) {
                    lastActivityDate = activityDate;
                }
            }
        }

        const completionPercentage = totalWords > 0 ? Math.round((wordsMastered / totalWords) * 100) : 0;

        return {
            totalWords,
            wordsSeen,
            wordsMastered,
            completionPercentage,
            lastActivityDate,
        };
    } catch (error) {
        console.error("Failed to calculate unit progress:", error);
        return {
            totalWords: 0,
            wordsSeen: 0,
            wordsMastered: 0,
            completionPercentage: 0,
            lastActivityDate: null,
        };
    }
}

// Reset progress for a lesson
export async function resetLessonProgress(lessonId: number) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    try {
        // Get all words for this lesson
        const words = await getVocabularyWordsByLesson(lessonId);
        const wordIds = words.map(w => w.id);

        if (wordIds.length === 0) {
            return { success: true, message: "No words found in this lesson" };
        }

        // Delete all progress entries for these words for the current user
        await db
            .delete(userProgress)
            .where(
                and(
                    eq(userProgress.userId, session.user.id),
                    inArray(userProgress.wordId, wordIds)
                )
            );

        // Revalidate the lesson page
        revalidatePath(`/lessons/${lessonId}/vocabulary`);

        return { success: true, message: "Progress reset successfully" };
    } catch (error) {
        console.error("Failed to reset lesson progress:", error);
        throw error;
    }
}

// Calculate progress for a book
export async function getBookProgress(bookId: number): Promise<ProgressData> {
    const session = await getSession();
    if (!session) {
        return {
            totalWords: 0,
            wordsSeen: 0,
            wordsMastered: 0,
            completionPercentage: 0,
            lastActivityDate: null,
        };
    }

    try {
        // Get all units in this book
        const bookUnits = await getUnitsByBook(bookId);
        
        if (bookUnits.length === 0) {
            return {
                totalWords: 0,
                wordsSeen: 0,
                wordsMastered: 0,
                completionPercentage: 0,
                lastActivityDate: null,
            };
        }

        // Aggregate progress from all units
        let totalWords = 0;
        let wordsSeen = 0;
        let wordsMastered = 0;
        let lastActivityDate: Date | null = null;

        for (const unit of bookUnits) {
            const unitProgress = await getUnitProgress(unit.id);
            totalWords += unitProgress.totalWords;
            wordsSeen += unitProgress.wordsSeen;
            wordsMastered += unitProgress.wordsMastered;
            
            if (unitProgress.lastActivityDate) {
                const activityDate = new Date(unitProgress.lastActivityDate);
                if (!lastActivityDate || activityDate > lastActivityDate) {
                    lastActivityDate = activityDate;
                }
            }
        }

        const completionPercentage = totalWords > 0 ? Math.round((wordsMastered / totalWords) * 100) : 0;

        return {
            totalWords,
            wordsSeen,
            wordsMastered,
            completionPercentage,
            lastActivityDate,
        };
    } catch (error) {
        console.error("Failed to calculate book progress:", error);
        return {
            totalWords: 0,
            wordsSeen: 0,
            wordsMastered: 0,
            completionPercentage: 0,
            lastActivityDate: null,
        };
    }
}

// Get progress for all books
export async function getAllBooksProgress(): Promise<Record<number, ProgressData>> {
    const session = await getSession();
    if (!session) {
        return {};
    }

    try {
        const allBooks = await getBooks();
        const progressMap: Record<number, ProgressData> = {};

        for (const book of allBooks) {
            progressMap[book.id] = await getBookProgress(book.id);
        }

        return progressMap;
    } catch (error) {
        console.error("Failed to calculate all books progress:", error);
        return {};
    }
}

// User-facing Analytics Functions (no admin required)
export async function getUserDailyActivity(
    startDate: Date,
    endDate: Date
): Promise<Array<{ date: string; wordsReviewed: number; practiceSessions: number; testSessions: number }>> {
    const session = await getSession();
    if (!session) return [];

    try {
        const conditions = [
            eq(userProgress.userId, session.user.id),
            gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]),
            lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]),
        ];

        const dailyWords = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                count: sql<number>`COUNT(DISTINCT ${userProgress.wordId})`.as('count'),
            })
            .from(userProgress)
            .where(and(...conditions))
            .groupBy(sql`DATE(${userProgress.lastReviewedAt})`);

        const practiceSessions = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                count: sql<number>`COUNT(DISTINCT DATE(${userProgress.lastReviewedAt}))`.as('count'),
            })
            .from(userProgress)
            .where(and(...conditions))
            .groupBy(sql`DATE(${userProgress.lastReviewedAt})`);

        const testSessions = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                wordCount: sql<number>`COUNT(DISTINCT ${userProgress.wordId})`.as('word_count'),
            })
            .from(userProgress)
            .where(and(...conditions))
            .groupBy(sql`DATE(${userProgress.lastReviewedAt})`)
            .having(sql`COUNT(DISTINCT ${userProgress.wordId}) >= 5`);

        const dateMap = new Map<string, { date: string; wordsReviewed: number; practiceSessions: number; testSessions: number }>();
        const allDates = new Set<string>();

        dailyWords.forEach(item => allDates.add(item.date));
        practiceSessions.forEach(item => allDates.add(item.date));
        testSessions.forEach(item => allDates.add(item.date));

        allDates.forEach(date => {
            dateMap.set(date, { date, wordsReviewed: 0, practiceSessions: 0, testSessions: 0 });
        });

        dailyWords.forEach(item => {
            const existing = dateMap.get(item.date);
            if (existing) existing.wordsReviewed = Number(item.count);
        });

        practiceSessions.forEach(item => {
            const existing = dateMap.get(item.date);
            if (existing) existing.practiceSessions = Number(item.count);
        });

        testSessions.forEach(item => {
            const existing = dateMap.get(item.date);
            if (existing) existing.testSessions = 1;
        });

        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("Failed to fetch user daily activity:", error);
        return [];
    }
}

export async function getUserPracticeMetrics(
    startDate?: Date,
    endDate?: Date
): Promise<{
    totalWordsPracticed: number;
    accuracyRate: number;
    wordsSeen: number;
    wordsNotSeen: number;
    totalCorrect: number;
    totalIncorrect: number;
}> {
    const session = await getSession();
    if (!session) {
        return {
            totalWordsPracticed: 0,
            accuracyRate: 0,
            wordsSeen: 0,
            wordsNotSeen: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
        };
    }

    try {
        const conditions = [eq(userProgress.userId, session.user.id)];
        if (startDate) {
            conditions.push(gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]));
        }
        if (endDate) {
            conditions.push(lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]));
        }

        const allProgress = await db
            .select({
                wordId: userProgress.wordId,
                correctCount: userProgress.correctCount,
                incorrectCount: userProgress.incorrectCount,
                seen: userProgress.seen,
            })
            .from(userProgress)
            .where(and(...conditions));

        const totalWordsPracticed = new Set(allProgress.map(p => p.wordId)).size;
        const totalCorrect = allProgress.reduce((sum, p) => sum + p.correctCount, 0);
        const totalIncorrect = allProgress.reduce((sum, p) => sum + p.incorrectCount, 0);
        const wordsSeen = allProgress.filter(p => p.seen).length;
        const wordsNotSeen = allProgress.filter(p => !p.seen).length;

        const accuracyRate =
            totalCorrect + totalIncorrect > 0
                ? (totalCorrect / (totalCorrect + totalIncorrect)) * 100
                : 0;

        return {
            totalWordsPracticed,
            accuracyRate,
            wordsSeen,
            wordsNotSeen,
            totalCorrect,
            totalIncorrect,
        };
    } catch (error) {
        console.error("Failed to fetch user practice metrics:", error);
        return {
            totalWordsPracticed: 0,
            accuracyRate: 0,
            wordsSeen: 0,
            wordsNotSeen: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
        };
    }
}

export async function getUserTestResults(
    startDate?: Date,
    endDate?: Date
): Promise<Array<{ date: string; score: number; totalWords: number; correctWords: number; lessonId: number | null; lessonTitle: string | null }>> {
    const session = await getSession();
    if (!session) return [];

    try {
        const conditions = [eq(userProgress.userId, session.user.id)];
        if (startDate) {
            conditions.push(gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]));
        }
        if (endDate) {
            conditions.push(lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]));
        }

        const dailyProgress = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                wordId: userProgress.wordId,
                correctCount: userProgress.correctCount,
                incorrectCount: userProgress.incorrectCount,
            })
            .from(userProgress)
            .where(and(...conditions));

        const testSessions = new Map<string, {
            date: string;
            wordIds: Set<number>;
            correct: number;
            incorrect: number;
        }>();

        dailyProgress.forEach(item => {
            const key = `${item.date}`;
            if (!testSessions.has(key)) {
                testSessions.set(key, {
                    date: item.date,
                    wordIds: new Set(),
                    correct: 0,
                    incorrect: 0,
                });
            }
            const session = testSessions.get(key)!;
            session.wordIds.add(item.wordId);
            session.correct += item.correctCount;
            session.incorrect += item.incorrectCount;
        });

        const testResults: Array<{ date: string; score: number; totalWords: number; correctWords: number; lessonId: number | null; lessonTitle: string | null }> = [];

        testSessions.forEach(session => {
            if (session.wordIds.size >= 5) {
                const total = session.correct + session.incorrect;
                testResults.push({
                    date: session.date,
                    score: total > 0 ? (session.correct / total) * 100 : 0,
                    totalWords: session.wordIds.size,
                    correctWords: session.correct,
                    lessonId: null,
                    lessonTitle: null,
                });
            }
        });

        return testResults.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("Failed to fetch user test results:", error);
        return [];
    }
}

export async function getUserActivitySummary(
    startDate?: Date,
    endDate?: Date
): Promise<{
    totalWordsReviewed: number;
    totalPracticeSessions: number;
    totalTestSessions: number;
    averageAccuracy: number;
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
}> {
    const session = await getSession();
    if (!session) {
        return {
            totalWordsReviewed: 0,
            totalPracticeSessions: 0,
            totalTestSessions: 0,
            averageAccuracy: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastActivityDate: null,
        };
    }

    try {
        const conditions = [eq(userProgress.userId, session.user.id)];
        if (startDate) {
            conditions.push(gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]));
        }
        if (endDate) {
            conditions.push(lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]));
        }

        const allProgress = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                wordId: userProgress.wordId,
                correctCount: userProgress.correctCount,
                incorrectCount: userProgress.incorrectCount,
            })
            .from(userProgress)
            .where(and(...conditions));

        const totalWordsReviewed = new Set(allProgress.map(p => `${p.wordId}`)).size;
        const totalCorrect = allProgress.reduce((sum, p) => sum + p.correctCount, 0);
        const totalIncorrect = allProgress.reduce((sum, p) => sum + p.incorrectCount, 0);

        const averageAccuracy =
            totalCorrect + totalIncorrect > 0
                ? (totalCorrect / (totalCorrect + totalIncorrect)) * 100
                : 0;

        const practiceSessions = new Set(allProgress.map(p => p.date)).size;

        const dailyWordCounts = new Map<string, number>();
        allProgress.forEach(p => {
            dailyWordCounts.set(p.date, (dailyWordCounts.get(p.date) || 0) + 1);
        });

        const testSessions = Array.from(dailyWordCounts.values()).filter(count => count >= 5).length;

        const userDates = new Set(allProgress.map(p => p.date));
        const sortedDates = Array.from(userDates).sort().reverse();

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        const today = new Date().toISOString().split('T')[0];
        let lastDate: string | null = null;

        sortedDates.forEach(date => {
            if (lastDate === null) {
                lastDate = date;
                if (date === today) {
                    currentStreak = 1;
                    tempStreak = 1;
                }
            } else {
                const lastDateObj = new Date(lastDate);
                const dateObj = new Date(date);
                const diffDays = Math.floor((lastDateObj.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    tempStreak++;
                    if (lastDate === today) {
                        currentStreak = tempStreak;
                    }
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
                lastDate = date;
            }
        });
        longestStreak = Math.max(longestStreak, tempStreak);

        const lastActivityDate = sortedDates.length > 0 ? sortedDates[0] : null;

        return {
            totalWordsReviewed,
            totalPracticeSessions: practiceSessions,
            totalTestSessions: testSessions,
            averageAccuracy,
            currentStreak,
            longestStreak,
            lastActivityDate,
        };
    } catch (error) {
        console.error("Failed to fetch user activity summary:", error);
        return {
            totalWordsReviewed: 0,
            totalPracticeSessions: 0,
            totalTestSessions: 0,
            averageAccuracy: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastActivityDate: null,
        };
    }
}

// Get daily activity metrics per book
export async function getUserDailyActivityByBook(
    startDate: Date,
    endDate: Date
): Promise<Record<number, {
    bookId: number;
    bookTitle: string;
    dailyActivity: Array<{ date: string; wordsReviewed: number; practiceSessions: number; testSessions: number }>;
    summary: {
        totalWordsReviewed: number;
        totalPracticeSessions: number;
        totalTestSessions: number;
        averageAccuracy: number;
    };
}>> {
    const session = await getSession();
    if (!session) return {};

    try {
        const conditions = [
            eq(userProgress.userId, session.user.id),
            gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]),
            lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]),
        ];

        // Get all progress with book information
        const progressWithBooks = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                wordId: userProgress.wordId,
                correctCount: userProgress.correctCount,
                incorrectCount: userProgress.incorrectCount,
                bookId: books.id,
                bookTitle: books.title,
            })
            .from(userProgress)
            .innerJoin(vocabularyWords, eq(userProgress.wordId, vocabularyWords.id))
            .innerJoin(lessons, eq(vocabularyWords.lessonId, lessons.id))
            .innerJoin(units, eq(lessons.unitId, units.id))
            .innerJoin(books, eq(units.bookId, books.id))
            .where(and(...conditions));

        // Group by book
        const bookMap = new Map<number, {
            bookId: number;
            bookTitle: string;
            progress: typeof progressWithBooks;
        }>();

        progressWithBooks.forEach(p => {
            if (!bookMap.has(p.bookId)) {
                bookMap.set(p.bookId, {
                    bookId: p.bookId,
                    bookTitle: p.bookTitle,
                    progress: [],
                });
            }
            bookMap.get(p.bookId)!.progress.push(p);
        });

        // Process each book
        const result: Record<number, {
            bookId: number;
            bookTitle: string;
            dailyActivity: Array<{ date: string; wordsReviewed: number; practiceSessions: number; testSessions: number }>;
            summary: {
                totalWordsReviewed: number;
                totalPracticeSessions: number;
                totalTestSessions: number;
                averageAccuracy: number;
            };
        }> = {};

        bookMap.forEach((bookData, bookId) => {
            const { progress } = bookData;

            // Get daily words reviewed
            const dailyWordsMap = new Map<string, Set<number>>();
            progress.forEach(p => {
                if (!dailyWordsMap.has(p.date)) {
                    dailyWordsMap.set(p.date, new Set());
                }
                dailyWordsMap.get(p.date)!.add(p.wordId);
            });

            // Get practice sessions (unique dates)
            const practiceSessionsSet = new Set(progress.map(p => p.date));

            // Get test sessions (dates with >= 5 words)
            const testSessionsSet = new Set<string>();
            dailyWordsMap.forEach((wordIds, date) => {
                if (wordIds.size >= 5) {
                    testSessionsSet.add(date);
                }
            });

            // Build daily activity array
            const allDates = new Set([
                ...dailyWordsMap.keys(),
                ...practiceSessionsSet,
                ...testSessionsSet,
            ]);

            const dailyActivity = Array.from(allDates).map(date => ({
                date,
                wordsReviewed: dailyWordsMap.get(date)?.size || 0,
                practiceSessions: practiceSessionsSet.has(date) ? 1 : 0,
                testSessions: testSessionsSet.has(date) ? 1 : 0,
            })).sort((a, b) => a.date.localeCompare(b.date));

            // Calculate summary
            const totalWordsReviewed = new Set(progress.map(p => p.wordId)).size;
            const totalCorrect = progress.reduce((sum, p) => sum + p.correctCount, 0);
            const totalIncorrect = progress.reduce((sum, p) => sum + p.incorrectCount, 0);
            const averageAccuracy = totalCorrect + totalIncorrect > 0
                ? (totalCorrect / (totalCorrect + totalIncorrect)) * 100
                : 0;

            result[bookId] = {
                bookId,
                bookTitle: bookData.bookTitle,
                dailyActivity,
                summary: {
                    totalWordsReviewed,
                    totalPracticeSessions: practiceSessionsSet.size,
                    totalTestSessions: testSessionsSet.size,
                    averageAccuracy,
                },
            };
        });

        return result;
    } catch (error) {
        console.error("Failed to fetch user daily activity by book:", error);
        return {};
    }
}
