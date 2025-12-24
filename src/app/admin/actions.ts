"use server";

import { db } from "@/db";
import { user, todos, groups, settings, books, units, lessons, vocabularyWords, conversationSentences, userProgress } from "@/db/schema";
import { eq, desc, asc, and, sql, gte, lte, count, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// User Management Actions
export async function getAllUsers() {
    await requireAdmin();

    try {
        return await db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                isAdmin: user.isAdmin,
                aiEnabled: user.aiEnabled,
                defaultGroupId: user.defaultGroupId,
                arabicFontSizeMultiplier: user.arabicFontSizeMultiplier,
                englishFontSizeMultiplier: user.englishFontSizeMultiplier,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })
            .from(user)
            .orderBy(desc(user.createdAt));
    } catch (error) {
        console.error("Failed to fetch users:", error);
        throw new Error("Failed to fetch users");
    }
}

export async function updateUser(userId: string, data: { name?: string; email?: string; isAdmin?: boolean; aiEnabled?: boolean }) {
    await requireAdmin();

    try {
        await db
            .update(user)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(user.id, userId));
        revalidatePath("/admin/users");
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update user:", error);
        throw new Error("Failed to update user");
    }
}

export async function deleteUser(userId: string) {
    await requireAdmin();

    try {
        // First delete all todos for this user
        await db.delete(todos).where(eq(todos.userId, userId));
        // Then delete the user
        await db.delete(user).where(eq(user.id, userId));
        revalidatePath("/admin/users");
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to delete user:", error);
        throw new Error("Failed to delete user");
    }
}

// Todo Management Actions
export async function getAllTodos() {
    await requireAdmin();

    try {
        return await db
            .select({
                id: todos.id,
                content: todos.content,
                completed: todos.completed,
                userId: todos.userId,
                groupId: todos.groupId,
                createdAt: todos.createdAt,
                user: {
                    name: user.name,
                    email: user.email,
                },
                group: {
                    id: groups.id,
                    name: groups.name,
                    color: groups.color,
                },
            })
            .from(todos)
            .leftJoin(user, eq(todos.userId, user.id))
            .leftJoin(groups, eq(todos.groupId, groups.id))
            .orderBy(desc(todos.createdAt));
    } catch (error) {
        console.error("Failed to fetch todos:", error);
        throw new Error("Failed to fetch todos");
    }
}

export async function adminUpdateTodo(id: number, data: { content?: string; completed?: boolean }) {
    await requireAdmin();

    try {
        await db
            .update(todos)
            .set(data)
            .where(eq(todos.id, id));
        revalidatePath("/admin/todos");
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update todo:", error);
        throw new Error("Failed to update todo");
    }
}

export async function adminDeleteTodo(id: number) {
    await requireAdmin();

    try {
        await db.delete(todos).where(eq(todos.id, id));
        revalidatePath("/admin/todos");
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to delete todo:", error);
        throw new Error("Failed to delete todo");
    }
}

export async function getAdminStats() {
    await requireAdmin();

    try {
        const allUsers = await db.select().from(user);
        const allTodos = await db.select().from(todos);
        const allGroups = await db.select().from(groups);
        const allBooks = await db.select().from(books);
        const allUnits = await db.select().from(units);
        const allLessons = await db.select().from(lessons);
        const allVocabulary = await db.select().from(vocabularyWords);
        const completedTodos = allTodos.filter(t => t.completed);
        const adminUsers = allUsers.filter(u => u.isAdmin);

        return {
            totalUsers: allUsers.length,
            totalTodos: allTodos.length,
            completedTodos: completedTodos.length,
            totalAdmins: adminUsers.length,
            totalGroups: allGroups.length,
            totalBooks: allBooks.length,
            totalUnits: allUnits.length,
            totalLessons: allLessons.length,
            totalVocabulary: allVocabulary.length,
        };
    } catch (error) {
        console.error("Failed to fetch admin stats:", error);
        return {
            totalUsers: 0,
            totalTodos: 0,
            completedTodos: 0,
            totalAdmins: 0,
            totalGroups: 0,
            totalBooks: 0,
            totalUnits: 0,
            totalLessons: 0,
            totalVocabulary: 0,
        };
    }
}

// Group Management Actions
export async function getAllGroups() {
    await requireAdmin();

    try {
        return await db
            .select({
                id: groups.id,
                name: groups.name,
                color: groups.color,
                description: groups.description,
                userId: groups.userId,
                createdAt: groups.createdAt,
                updatedAt: groups.updatedAt,
                user: {
                    name: user.name,
                    email: user.email,
                },
            })
            .from(groups)
            .leftJoin(user, eq(groups.userId, user.id))
            .orderBy(desc(groups.createdAt));
    } catch (error) {
        console.error("Failed to fetch groups:", error);
        throw new Error("Failed to fetch groups");
    }
}

export async function adminUpdateGroup(id: number, data: { name?: string; color?: string | null; description?: string | null }) {
    await requireAdmin();

    try {
        await db
            .update(groups)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(groups.id, id));
        revalidatePath("/admin/groups");
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update group:", error);
        throw new Error("Failed to update group");
    }
}

export async function adminDeleteGroup(id: number) {
    await requireAdmin();

    try {
        // Set todos' groupId to null instead of cascading delete
        await db
            .update(todos)
            .set({ groupId: null })
            .where(eq(todos.groupId, id));

        // Clear defaultGroupId if this was a default group
        await db
            .update(user)
            .set({ defaultGroupId: null, updatedAt: new Date() })
            .where(eq(user.defaultGroupId, id));

        // Delete the group
        await db.delete(groups).where(eq(groups.id, id));
        revalidatePath("/admin/groups");
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to delete group:", error);
        throw new Error("Failed to delete group");
    }
}

// AI Settings Management
export async function getGlobalAIEnabled(): Promise<boolean> {
    await requireAdmin();

    try {
        const result = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "ai.global_enabled"))
            .limit(1);

        if (result.length === 0) {
            // Initialize the setting to true (enabled) by default
            const session = await auth.api.getSession({
                headers: await headers(),
            });

            if (session) {
                await db.insert(settings).values({
                    key: "ai.global_enabled",
                    value: JSON.stringify(true),
                    updatedBy: session.user.id,
                });
            }
            return true;
        }

        return JSON.parse(result[0].value) === true;
    } catch (error) {
        console.error("Failed to fetch global AI setting:", error);
        return true; // Default to enabled on error
    }
}

export async function setGlobalAIEnabled(enabled: boolean) {
    await requireAdmin();

    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            throw new Error("Unauthorized");
        }

        const existing = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "ai.global_enabled"))
            .limit(1);

        if (existing.length > 0) {
            await db
                .update(settings)
                .set({
                    value: JSON.stringify(enabled),
                    updatedAt: new Date(),
                    updatedBy: session.user.id,
                })
                .where(eq(settings.key, "ai.global_enabled"));
        } else {
            await db.insert(settings).values({
                key: "ai.global_enabled",
                value: JSON.stringify(enabled),
                updatedBy: session.user.id,
            });
        }

        revalidatePath("/admin");
        revalidatePath("/admin/users");
        revalidatePath("/"); // Revalidate root to update AI icon visibility
    } catch (error) {
        console.error("Failed to update global AI setting:", error);
        throw new Error("Failed to update global AI setting");
    }
}

// Book Management Actions
export async function getAllBooks() {
    await requireAdmin();

    try {
        return await db
            .select()
            .from(books)
            .orderBy(asc(books.order), asc(books.id));
    } catch (error) {
        console.error("Failed to fetch books:", error);
        throw new Error("Failed to fetch books");
    }
}

export async function getBookById(id: number) {
    await requireAdmin();

    try {
        const [book] = await db
            .select()
            .from(books)
            .where(eq(books.id, id))
            .limit(1);
        return book || null;
    } catch (error) {
        console.error("Failed to fetch book:", error);
        throw new Error("Failed to fetch book");
    }
}

export async function createBook(data: { title: string; description?: string | null }) {
    await requireAdmin();

    try {
        // Get the max order value to set the new book's order
        const maxOrderResult = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${books.order}), -1)` })
            .from(books);
        const maxOrder = maxOrderResult[0]?.maxOrder ?? -1;

        const [newBook] = await db
            .insert(books)
            .values({
                title: data.title.trim(),
                description: data.description?.trim() || null,
                order: maxOrder + 1,
            })
            .returning();
        revalidatePath("/admin/books");
        revalidatePath("/admin");
        return newBook;
    } catch (error) {
        console.error("Failed to create book:", error);
        throw new Error("Failed to create book");
    }
}

export async function updateBook(id: number, data: { title?: string; description?: string | null; order?: number; enabled?: boolean }) {
    await requireAdmin();

    try {
        const updateData: { title?: string; description?: string | null; order?: number; enabled?: boolean; updatedAt: Date } = {
            updatedAt: new Date(),
        };
        if (data.title !== undefined) {
            updateData.title = data.title.trim();
        }
        if (data.description !== undefined) {
            updateData.description = data.description?.trim() || null;
        }
        if (data.order !== undefined) {
            updateData.order = data.order;
        }
        if (data.enabled !== undefined) {
            updateData.enabled = data.enabled;
        }

        await db
            .update(books)
            .set(updateData)
            .where(eq(books.id, id));
        revalidatePath("/admin/books");
        revalidatePath(`/admin/books/${id}/units`);
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update book:", error);
        throw new Error("Failed to update book");
    }
}

export async function updateBookOrder(bookIds: number[]) {
    await requireAdmin();

    try {
        // Update order for all books in the provided order
        // Using Promise.all since Neon HTTP may not support transactions
        await Promise.all(
            bookIds.map((bookId, index) =>
                db
                    .update(books)
                    .set({
                        order: index,
                        updatedAt: new Date(),
                    })
                    .where(eq(books.id, bookId))
            )
        );
        revalidatePath("/admin/books");
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update book order:", error);
        throw new Error("Failed to update book order");
    }
}

export async function deleteBook(id: number) {
    await requireAdmin();

    try {
        await db.delete(books).where(eq(books.id, id));
        revalidatePath("/admin/books");
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to delete book:", error);
        throw new Error("Failed to delete book");
    }
}

// Unit Management Actions
export async function getUnitsByBook(bookId: number) {
    await requireAdmin();

    try {
        return await db
            .select()
            .from(units)
            .where(eq(units.bookId, bookId))
            .orderBy(asc(units.order), asc(units.id));
    } catch (error) {
        console.error("Failed to fetch units:", error);
        throw new Error("Failed to fetch units");
    }
}

export async function getUnitById(id: number) {
    await requireAdmin();

    try {
        const [unit] = await db
            .select()
            .from(units)
            .where(eq(units.id, id))
            .limit(1);
        return unit || null;
    } catch (error) {
        console.error("Failed to fetch unit:", error);
        throw new Error("Failed to fetch unit");
    }
}

export async function createUnit(bookId: number, data: { title: string; order?: number }) {
    await requireAdmin();

    try {
        // Verify book exists
        const book = await getBookById(bookId);
        if (!book) {
            throw new Error("Book not found");
        }

        // Get the max order value for this book to set the new unit's order
        const maxOrderResult = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${units.order}), -1)` })
            .from(units)
            .where(eq(units.bookId, bookId));
        const maxOrder = maxOrderResult[0]?.maxOrder ?? -1;

        const [newUnit] = await db
            .insert(units)
            .values({
                bookId,
                title: data.title.trim(),
                order: data.order ?? maxOrder + 1,
            })
            .returning();
        revalidatePath(`/admin/books/${bookId}/units`);
        revalidatePath("/admin");
        return newUnit;
    } catch (error) {
        console.error("Failed to create unit:", error);
        throw new Error("Failed to create unit");
    }
}

export async function updateUnit(id: number, data: { title?: string; order?: number; enabled?: boolean }) {
    await requireAdmin();

    try {
        const updateData: { title?: string; order?: number; enabled?: boolean; updatedAt: Date } = {
            updatedAt: new Date(),
        };
        if (data.title !== undefined) {
            updateData.title = data.title.trim();
        }
        if (data.order !== undefined) {
            updateData.order = data.order;
        }
        if (data.enabled !== undefined) {
            updateData.enabled = data.enabled;
        }

        await db
            .update(units)
            .set(updateData)
            .where(eq(units.id, id));
        
        const [unit] = await db.select({ bookId: units.bookId }).from(units).where(eq(units.id, id)).limit(1);
        if (unit) {
            revalidatePath(`/admin/books/${unit.bookId}/units`);
        }
        revalidatePath(`/admin/units/${id}/lessons`);
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update unit:", error);
        throw new Error("Failed to update unit");
    }
}

export async function updateUnitOrder(unitIds: number[]) {
    await requireAdmin();

    try {
        // Update order for all units in the provided order
        // Using Promise.all since Neon HTTP may not support transactions
        await Promise.all(
            unitIds.map((unitId, index) =>
                db
                    .update(units)
                    .set({
                        order: index,
                        updatedAt: new Date(),
                    })
                    .where(eq(units.id, unitId))
            )
        );
        
        // Get bookId from first unit to revalidate
        if (unitIds.length > 0) {
            const [unit] = await db.select({ bookId: units.bookId }).from(units).where(eq(units.id, unitIds[0])).limit(1);
            if (unit) {
                revalidatePath(`/admin/books/${unit.bookId}/units`);
            }
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update unit order:", error);
        throw new Error("Failed to update unit order");
    }
}

export async function deleteUnit(id: number) {
    await requireAdmin();

    try {
        const [unit] = await db.select({ bookId: units.bookId }).from(units).where(eq(units.id, id)).limit(1);
        await db.delete(units).where(eq(units.id, id));
        if (unit) {
            revalidatePath(`/admin/books/${unit.bookId}/units`);
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to delete unit:", error);
        throw new Error("Failed to delete unit");
    }
}

// Lesson Management Actions
export async function getLessonsByUnit(unitId: number) {
    await requireAdmin();

    try {
        return await db
            .select()
            .from(lessons)
            .where(eq(lessons.unitId, unitId))
            .orderBy(asc(lessons.order), asc(lessons.id));
    } catch (error) {
        console.error("Failed to fetch lessons:", error);
        throw new Error("Failed to fetch lessons");
    }
}

export async function getLessonById(id: number) {
    await requireAdmin();

    try {
        const [lesson] = await db
            .select()
            .from(lessons)
            .where(eq(lessons.id, id))
            .limit(1);
        return lesson || null;
    } catch (error) {
        console.error("Failed to fetch lesson:", error);
        throw new Error("Failed to fetch lesson");
    }
}

export async function createLesson(unitId: number, data: { title: string; type: string; order?: number }) {
    await requireAdmin();

    try {
        // Verify unit exists
        const unit = await getUnitById(unitId);
        if (!unit) {
            throw new Error("Unit not found");
        }

        // Get the max order value for this unit to set the new lesson's order
        const maxOrderResult = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${lessons.order}), -1)` })
            .from(lessons)
            .where(eq(lessons.unitId, unitId));
        const maxOrder = maxOrderResult[0]?.maxOrder ?? -1;

        const [newLesson] = await db
            .insert(lessons)
            .values({
                unitId,
                title: data.title.trim(),
                type: data.type.trim(),
                order: data.order ?? maxOrder + 1,
            })
            .returning();
        revalidatePath(`/admin/units/${unitId}/lessons`);
        revalidatePath("/admin");
        return newLesson;
    } catch (error) {
        console.error("Failed to create lesson:", error);
        throw new Error("Failed to create lesson");
    }
}

export async function updateLesson(id: number, data: { title?: string; type?: string; order?: number; enabled?: boolean }) {
    await requireAdmin();

    try {
        const updateData: { title?: string; type?: string; order?: number; enabled?: boolean; updatedAt: Date } = {
            updatedAt: new Date(),
        };
        if (data.title !== undefined) {
            updateData.title = data.title.trim();
        }
        if (data.type !== undefined) {
            updateData.type = data.type.trim();
        }
        if (data.order !== undefined) {
            updateData.order = data.order;
        }
        if (data.enabled !== undefined) {
            updateData.enabled = data.enabled;
        }

        await db
            .update(lessons)
            .set(updateData)
            .where(eq(lessons.id, id));
        
        const [lesson] = await db.select({ unitId: lessons.unitId }).from(lessons).where(eq(lessons.id, id)).limit(1);
        if (lesson) {
            revalidatePath(`/admin/units/${lesson.unitId}/lessons`);
        }
        revalidatePath(`/admin/lessons/${id}/vocabulary`);
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update lesson:", error);
        throw new Error("Failed to update lesson");
    }
}

export async function updateLessonOrder(lessonIds: number[]) {
    await requireAdmin();

    try {
        // Update order for all lessons in the provided order
        // Using Promise.all since Neon HTTP may not support transactions
        await Promise.all(
            lessonIds.map((lessonId, index) =>
                db
                    .update(lessons)
                    .set({
                        order: index,
                        updatedAt: new Date(),
                    })
                    .where(eq(lessons.id, lessonId))
            )
        );
        
        // Get unitId from first lesson to revalidate
        if (lessonIds.length > 0) {
            const [lesson] = await db.select({ unitId: lessons.unitId }).from(lessons).where(eq(lessons.id, lessonIds[0])).limit(1);
            if (lesson) {
                revalidatePath(`/admin/units/${lesson.unitId}/lessons`);
            }
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update lesson order:", error);
        throw new Error("Failed to update lesson order");
    }
}

export async function deleteLesson(id: number) {
    await requireAdmin();

    try {
        const [lesson] = await db.select({ unitId: lessons.unitId }).from(lessons).where(eq(lessons.id, id)).limit(1);
        await db.delete(lessons).where(eq(lessons.id, id));
        if (lesson) {
            revalidatePath(`/admin/units/${lesson.unitId}/lessons`);
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to delete lesson:", error);
        throw new Error("Failed to delete lesson");
    }
}

// Vocabulary Management Actions
export async function getVocabularyWordsByLesson(lessonId: number) {
    await requireAdmin();

    try {
        return await db
            .select()
            .from(vocabularyWords)
            .where(eq(vocabularyWords.lessonId, lessonId))
            .orderBy(asc(vocabularyWords.order), asc(vocabularyWords.id));
    } catch (error) {
        console.error("Failed to fetch vocabulary words:", error);
        throw new Error("Failed to fetch vocabulary words");
    }
}

export async function addVocabularyWord(lessonId: number, data: { arabic: string; english: string; order?: number }) {
    await requireAdmin();

    try {
        // Verify lesson exists and is vocabulary type
        const lesson = await getLessonById(lessonId);
        if (!lesson) {
            throw new Error("Lesson not found");
        }
        if (lesson.type !== "vocabulary") {
            throw new Error("Lesson is not a vocabulary lesson");
        }

        // Get the max order value for this lesson to set the new word's order
        const maxOrderResult = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${vocabularyWords.order}), -1)` })
            .from(vocabularyWords)
            .where(eq(vocabularyWords.lessonId, lessonId));
        const maxOrder = maxOrderResult[0]?.maxOrder ?? -1;

        const [newWord] = await db
            .insert(vocabularyWords)
            .values({
                lessonId,
                arabic: data.arabic.trim(),
                english: data.english.trim(),
                order: data.order ?? maxOrder + 1,
            })
            .returning();
        revalidatePath(`/admin/lessons/${lessonId}/vocabulary`);
        revalidatePath("/admin");
        return newWord;
    } catch (error) {
        console.error("Failed to add vocabulary word:", error);
        throw new Error("Failed to add vocabulary word");
    }
}

export async function updateVocabularyWord(id: number, data: { arabic?: string; english?: string; order?: number }) {
    await requireAdmin();

    try {
        const updateData: { arabic?: string; english?: string; order?: number } = {};
        if (data.arabic !== undefined) {
            updateData.arabic = data.arabic.trim();
        }
        if (data.english !== undefined) {
            updateData.english = data.english.trim();
        }
        if (data.order !== undefined) {
            updateData.order = data.order;
        }

        await db
            .update(vocabularyWords)
            .set(updateData)
            .where(eq(vocabularyWords.id, id));
        
        const [word] = await db.select({ lessonId: vocabularyWords.lessonId }).from(vocabularyWords).where(eq(vocabularyWords.id, id)).limit(1);
        if (word) {
            revalidatePath(`/admin/lessons/${word.lessonId}/vocabulary`);
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update vocabulary word:", error);
        throw new Error("Failed to update vocabulary word");
    }
}

export async function updateVocabularyOrder(wordIds: number[]) {
    await requireAdmin();

    try {
        // Update order for all vocabulary words in the provided order
        // Using Promise.all since Neon HTTP may not support transactions
        await Promise.all(
            wordIds.map((wordId, index) =>
                db
                    .update(vocabularyWords)
                    .set({
                        order: index,
                    })
                    .where(eq(vocabularyWords.id, wordId))
            )
        );
        
        // Get lessonId from first word to revalidate
        if (wordIds.length > 0) {
            const [word] = await db.select({ lessonId: vocabularyWords.lessonId }).from(vocabularyWords).where(eq(vocabularyWords.id, wordIds[0])).limit(1);
            if (word) {
                revalidatePath(`/admin/lessons/${word.lessonId}/vocabulary`);
            }
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update vocabulary order:", error);
        throw new Error("Failed to update vocabulary order");
    }
}

export async function deleteVocabularyWord(id: number) {
    await requireAdmin();

    try {
        const [word] = await db.select({ lessonId: vocabularyWords.lessonId }).from(vocabularyWords).where(eq(vocabularyWords.id, id)).limit(1);
        await db.delete(vocabularyWords).where(eq(vocabularyWords.id, id));
        if (word) {
            revalidatePath(`/admin/lessons/${word.lessonId}/vocabulary`);
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to delete vocabulary word:", error);
        throw new Error("Failed to delete vocabulary word");
    }
}

export async function bulkAddVocabularyWords(
    lessonId: number,
    words: Array<{ arabic: string; english: string; order?: number }>
) {
    await requireAdmin();

    try {
        // Verify lesson exists and is vocabulary type
        const lesson = await getLessonById(lessonId);
        if (!lesson) {
            throw new Error("Lesson not found");
        }
        if (lesson.type !== "vocabulary") {
            throw new Error("Lesson is not a vocabulary lesson");
        }

        if (!words || words.length === 0) {
            throw new Error("No words provided");
        }

        // Get current max order for this lesson
        const existingWords = await db
            .select({ order: vocabularyWords.order })
            .from(vocabularyWords)
            .where(eq(vocabularyWords.lessonId, lessonId))
            .orderBy(desc(vocabularyWords.order))
            .limit(1);

        let startOrder = 0;
        if (existingWords.length > 0 && existingWords[0].order !== null) {
            startOrder = existingWords[0].order + 1;
        }

        // Insert all words
        const newWords = await db
            .insert(vocabularyWords)
            .values(
                words.map((word, index) => ({
                    lessonId,
                    arabic: word.arabic.trim(),
                    english: word.english.trim(),
                    order: word.order ?? startOrder + index,
                }))
            )
            .returning();

        revalidatePath(`/admin/lessons/${lessonId}/vocabulary`);
        revalidatePath("/admin");
        return newWords;
    } catch (error) {
        console.error("Failed to bulk add vocabulary words:", error);
        throw new Error("Failed to bulk add vocabulary words");
    }
}

// Conversation Management Actions
export async function getConversationSentencesByLesson(lessonId: number) {
    await requireAdmin();

    try {
        return await db
            .select()
            .from(conversationSentences)
            .where(eq(conversationSentences.lessonId, lessonId))
            .orderBy(asc(conversationSentences.order), asc(conversationSentences.id));
    } catch (error) {
        console.error("Failed to fetch conversation sentences:", error);
        throw new Error("Failed to fetch conversation sentences");
    }
}

export async function addConversationSentence(lessonId: number, data: { arabic: string; english?: string; order?: number; isTitle?: boolean }) {
    await requireAdmin();

    try {
        // Verify lesson exists and is conversation or reading type
        const lesson = await getLessonById(lessonId);
        if (!lesson) {
            throw new Error("Lesson not found");
        }
        if (lesson.type !== "conversation" && lesson.type !== "reading") {
            throw new Error("Lesson is not a conversation or reading lesson");
        }

        // Get the max order value for this lesson to set the new sentence's order
        const maxOrderResult = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${conversationSentences.order}), -1)` })
            .from(conversationSentences)
            .where(eq(conversationSentences.lessonId, lessonId));
        const maxOrder = maxOrderResult[0]?.maxOrder ?? -1;

        const [newSentence] = await db
            .insert(conversationSentences)
            .values({
                lessonId,
                arabic: data.arabic.trim(),
                english: data.english?.trim() || null,
                order: data.order ?? maxOrder + 1,
                isTitle: data.isTitle ?? false,
            })
            .returning();
        // Reuse the lesson variable from validation above
        if (lesson.type === "conversation") {
            revalidatePath(`/admin/lessons/${lessonId}/conversation`);
        } else if (lesson.type === "reading") {
            revalidatePath(`/admin/lessons/${lessonId}/reading`);
        }
        revalidatePath("/admin");
        return newSentence;
    } catch (error) {
        console.error("Failed to add conversation sentence:", error);
        throw new Error("Failed to add conversation sentence");
    }
}

export async function updateConversationSentence(id: number, data: { arabic?: string; english?: string | null; order?: number; isTitle?: boolean }) {
    await requireAdmin();

    try {
        const updateData: { arabic?: string; english?: string | null; order?: number; isTitle?: boolean } = {};
        if (data.arabic !== undefined) {
            updateData.arabic = data.arabic.trim();
        }
        if (data.english !== undefined) {
            updateData.english = data.english?.trim() || null;
        }
        if (data.order !== undefined) {
            updateData.order = data.order;
        }
        if (data.isTitle !== undefined) {
            updateData.isTitle = data.isTitle;
        }

        await db
            .update(conversationSentences)
            .set(updateData)
            .where(eq(conversationSentences.id, id));
        
        const [sentence] = await db.select({ lessonId: conversationSentences.lessonId }).from(conversationSentences).where(eq(conversationSentences.id, id)).limit(1);
        if (sentence) {
            const lesson = await getLessonById(sentence.lessonId);
            if (lesson) {
                if (lesson.type === "conversation") {
                    revalidatePath(`/admin/lessons/${sentence.lessonId}/conversation`);
                } else if (lesson.type === "reading") {
                    revalidatePath(`/admin/lessons/${sentence.lessonId}/reading`);
                }
            }
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update conversation sentence:", error);
        throw new Error("Failed to update conversation sentence");
    }
}

export async function updateConversationOrder(sentenceIds: number[]) {
    await requireAdmin();

    try {
        // Update order for all conversation sentences in the provided order
        // Using Promise.all since Neon HTTP may not support transactions
        await Promise.all(
            sentenceIds.map((sentenceId, index) =>
                db
                    .update(conversationSentences)
                    .set({ order: index })
                    .where(eq(conversationSentences.id, sentenceId))
            )
        );
        
        if (sentenceIds.length > 0) {
            const [sentence] = await db.select({ lessonId: conversationSentences.lessonId }).from(conversationSentences).where(eq(conversationSentences.id, sentenceIds[0])).limit(1);
            if (sentence) {
                const lesson = await getLessonById(sentence.lessonId);
                if (lesson) {
                    if (lesson.type === "conversation") {
                        revalidatePath(`/admin/lessons/${sentence.lessonId}/conversation`);
                    } else if (lesson.type === "reading") {
                        revalidatePath(`/admin/lessons/${sentence.lessonId}/reading`);
                    }
                }
            }
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update conversation order:", error);
        throw new Error("Failed to update conversation order");
    }
}

export async function deleteConversationSentence(id: number) {
    await requireAdmin();

    try {
        const [sentence] = await db.select({ lessonId: conversationSentences.lessonId }).from(conversationSentences).where(eq(conversationSentences.id, id)).limit(1);
        await db.delete(conversationSentences).where(eq(conversationSentences.id, id));
        if (sentence) {
            const lesson = await getLessonById(sentence.lessonId);
            if (lesson) {
                if (lesson.type === "conversation") {
                    revalidatePath(`/admin/lessons/${sentence.lessonId}/conversation`);
                } else if (lesson.type === "reading") {
                    revalidatePath(`/admin/lessons/${sentence.lessonId}/reading`);
                }
            }
        }
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to delete conversation sentence:", error);
        throw new Error("Failed to delete conversation sentence");
    }
}

export async function bulkAddConversationSentences(
    lessonId: number,
    sentences: Array<{ arabic: string; english?: string; order?: number; isTitle?: boolean }>
) {
    await requireAdmin();

    try {
        // Verify lesson exists and is conversation or reading type
        const lesson = await getLessonById(lessonId);
        if (!lesson) {
            throw new Error("Lesson not found");
        }
        if (lesson.type !== "conversation" && lesson.type !== "reading") {
            throw new Error("Lesson is not a conversation or reading lesson");
        }

        if (!sentences || sentences.length === 0) {
            throw new Error("No sentences provided");
        }

        // Get current max order for this lesson
        const existingSentences = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${conversationSentences.order}), -1)` })
            .from(conversationSentences)
            .where(eq(conversationSentences.lessonId, lessonId));
        const maxOrder = existingSentences[0]?.maxOrder ?? -1;

        // Insert all sentences with proper ordering
        const newSentences = await db
            .insert(conversationSentences)
            .values(
                sentences.map((sentence, index) => ({
                    lessonId,
                    arabic: sentence.arabic.trim(),
                    english: sentence.english?.trim() || null,
                    order: sentence.order ?? maxOrder + 1 + index,
                    isTitle: sentence.isTitle ?? false,
                }))
            )
            .returning();

        // Reuse the lesson variable from validation above
        if (lesson.type === "conversation") {
            revalidatePath(`/admin/lessons/${lessonId}/conversation`);
        } else if (lesson.type === "reading") {
            revalidatePath(`/admin/lessons/${lessonId}/reading`);
        }
        revalidatePath("/admin");
        return newSentences;
    } catch (error) {
        console.error("Failed to bulk add conversation sentences:", error);
        throw new Error("Failed to bulk add conversation sentences");
    }
}

// Analytics Functions
export type DailyActivityData = {
    date: string;
    wordsReviewed: number;
    practiceSessions: number;
    testSessions: number;
    activeUsers: number;
};

export type PracticeMetrics = {
    totalWordsPracticed: number;
    accuracyRate: number;
    wordsSeen: number;
    wordsNotSeen: number;
    totalCorrect: number;
    totalIncorrect: number;
    practiceActivityByLesson: Array<{
        lessonId: number;
        lessonTitle: string;
        wordsPracticed: number;
        accuracy: number;
    }>;
};

export type TestResult = {
    date: string;
    score: number;
    totalWords: number;
    correctWords: number;
    lessonId: number | null;
    lessonTitle: string | null;
};

export type UserActivitySummary = {
    totalWordsReviewed: number;
    totalPracticeSessions: number;
    totalTestSessions: number;
    averageAccuracy: number;
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
};

export async function getDailyUserActivity(
    startDate: Date,
    endDate: Date,
    userId?: string
): Promise<DailyActivityData[]> {
    await requireAdmin();

    try {
        // Build base query conditions
        const conditions = [
            gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]),
            lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]),
        ];

        if (userId) {
            conditions.push(eq(userProgress.userId, userId));
        }

        // Get daily words reviewed
        const dailyWords = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                count: sql<number>`COUNT(DISTINCT ${userProgress.wordId})`.as('count'),
            })
            .from(userProgress)
            .where(and(...conditions))
            .groupBy(sql`DATE(${userProgress.lastReviewedAt})`);

        // Get daily active users (for admin view)
        const dailyActiveUsers = userId
            ? []
            : await db
                  .select({
                      date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                      count: sql<number>`COUNT(DISTINCT ${userProgress.userId})`.as('count'),
                  })
                  .from(userProgress)
                  .where(and(...conditions))
                  .groupBy(sql`DATE(${userProgress.lastReviewedAt})`);

        // Estimate practice sessions (words reviewed with correct/incorrect in same day)
        // A practice session is when a user reviews words - we'll count distinct user+date combinations
        const practiceSessions = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                count: sql<number>`COUNT(DISTINCT ${userProgress.userId} || '-' || DATE(${userProgress.lastReviewedAt}))`.as('count'),
            })
            .from(userProgress)
            .where(and(...conditions))
            .groupBy(sql`DATE(${userProgress.lastReviewedAt})`);

        // Estimate test sessions (multiple words reviewed in quick succession)
        // For now, we'll approximate: if a user reviewed 5+ words on the same day, count as a test
        const testSessions = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                userId: userProgress.userId,
                wordCount: sql<number>`COUNT(DISTINCT ${userProgress.wordId})`.as('word_count'),
            })
            .from(userProgress)
            .where(and(...conditions))
            .groupBy(sql`DATE(${userProgress.lastReviewedAt})`, userProgress.userId)
            .having(sql`COUNT(DISTINCT ${userProgress.wordId}) >= 5`);

        // Aggregate test sessions by date
        const testSessionsByDate = testSessions.reduce((acc, session) => {
            const date = session.date;
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Combine all data by date
        const dateMap = new Map<string, DailyActivityData>();
        const allDates = new Set<string>();

        dailyWords.forEach(item => allDates.add(item.date));
        dailyActiveUsers.forEach(item => allDates.add(item.date));
        practiceSessions.forEach(item => allDates.add(item.date));
        Object.keys(testSessionsByDate).forEach(date => allDates.add(date));

        allDates.forEach(date => {
            dateMap.set(date, {
                date,
                wordsReviewed: 0,
                practiceSessions: 0,
                testSessions: 0,
                activeUsers: 0,
            });
        });

        dailyWords.forEach(item => {
            const existing = dateMap.get(item.date) || {
                date: item.date,
                wordsReviewed: 0,
                practiceSessions: 0,
                testSessions: 0,
                activeUsers: 0,
            };
            existing.wordsReviewed = Number(item.count);
            dateMap.set(item.date, existing);
        });

        practiceSessions.forEach(item => {
            const existing = dateMap.get(item.date);
            if (existing) {
                existing.practiceSessions = Number(item.count);
            }
        });

        dailyActiveUsers.forEach(item => {
            const existing = dateMap.get(item.date);
            if (existing) {
                existing.activeUsers = Number(item.count);
            }
        });

        Object.entries(testSessionsByDate).forEach(([date, count]) => {
            const existing = dateMap.get(date);
            if (existing) {
                existing.testSessions = count;
            }
        });

        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("Failed to fetch daily user activity:", error);
        return [];
    }
}

export async function getPracticeMetrics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
): Promise<PracticeMetrics> {
    await requireAdmin();

    try {
        const conditions = [];
        if (userId) {
            conditions.push(eq(userProgress.userId, userId));
        }
        if (startDate) {
            conditions.push(gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]));
        }
        if (endDate) {
            conditions.push(lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total practice stats
        const allProgress = await db
            .select({
                wordId: userProgress.wordId,
                correctCount: userProgress.correctCount,
                incorrectCount: userProgress.incorrectCount,
                seen: userProgress.seen,
            })
            .from(userProgress)
            .where(whereClause);

        const totalWordsPracticed = new Set(allProgress.map(p => p.wordId)).size;
        const totalCorrect = allProgress.reduce((sum, p) => sum + p.correctCount, 0);
        const totalIncorrect = allProgress.reduce((sum, p) => sum + p.incorrectCount, 0);
        const wordsSeen = allProgress.filter(p => p.seen).length;
        const wordsNotSeen = allProgress.filter(p => !p.seen).length;

        const accuracyRate =
            totalCorrect + totalIncorrect > 0
                ? (totalCorrect / (totalCorrect + totalIncorrect)) * 100
                : 0;

        // Get practice activity by lesson
        const progressWithLessons = await db
            .select({
                lessonId: vocabularyWords.lessonId,
                correctCount: userProgress.correctCount,
                incorrectCount: userProgress.incorrectCount,
            })
            .from(userProgress)
            .innerJoin(vocabularyWords, eq(userProgress.wordId, vocabularyWords.id))
            .where(whereClause);

        const lessonStats = new Map<number, { correct: number; incorrect: number; wordIds: Set<number> }>();

        progressWithLessons.forEach(item => {
            if (!lessonStats.has(item.lessonId)) {
                lessonStats.set(item.lessonId, { correct: 0, incorrect: 0, wordIds: new Set() });
            }
            const stats = lessonStats.get(item.lessonId)!;
            stats.correct += item.correctCount;
            stats.incorrect += item.incorrectCount;
        });

        // Get lesson titles
        const lessonIds = Array.from(lessonStats.keys());
        const lessonsData = lessonIds.length > 0
            ? await db
                  .select({
                      id: lessons.id,
                      title: lessons.title,
                  })
                  .from(lessons)
                  .where(inArray(lessons.id, lessonIds))
            : [];

        const lessonMap = new Map(lessonsData.map(l => [l.id, l.title]));

        const practiceActivityByLesson = Array.from(lessonStats.entries()).map(([lessonId, stats]) => {
            const total = stats.correct + stats.incorrect;
            return {
                lessonId,
                lessonTitle: lessonMap.get(lessonId) || `Lesson ${lessonId}`,
                wordsPracticed: stats.wordIds.size,
                accuracy: total > 0 ? (stats.correct / total) * 100 : 0,
            };
        });

        return {
            totalWordsPracticed,
            accuracyRate,
            wordsSeen,
            wordsNotSeen,
            totalCorrect,
            totalIncorrect,
            practiceActivityByLesson,
        };
    } catch (error) {
        console.error("Failed to fetch practice metrics:", error);
        return {
            totalWordsPracticed: 0,
            accuracyRate: 0,
            wordsSeen: 0,
            wordsNotSeen: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            practiceActivityByLesson: [],
        };
    }
}

export async function getTestResults(
    userId?: string,
    startDate?: Date,
    endDate?: Date
): Promise<TestResult[]> {
    await requireAdmin();

    try {
        // Estimate test sessions: days where user reviewed 5+ words
        // Group by user, date, and lesson to get test scores
        const conditions = [];
        if (userId) {
            conditions.push(eq(userProgress.userId, userId));
        }
        if (startDate) {
            conditions.push(gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]));
        }
        if (endDate) {
            conditions.push(lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get daily word reviews with progress data
        const dailyProgress = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                userId: userProgress.userId,
                wordId: userProgress.wordId,
                lessonId: vocabularyWords.lessonId,
                correctCount: userProgress.correctCount,
                incorrectCount: userProgress.incorrectCount,
            })
            .from(userProgress)
            .innerJoin(vocabularyWords, eq(userProgress.wordId, vocabularyWords.id))
            .where(whereClause);

        // Group by user, date, and lesson
        const testSessions = new Map<string, {
            date: string;
            userId: string;
            lessonId: number | null;
            wordIds: Set<number>;
            correct: number;
            incorrect: number;
        }>();

        dailyProgress.forEach(item => {
            const key = `${item.userId}-${item.date}-${item.lessonId || 'null'}`;
            if (!testSessions.has(key)) {
                testSessions.set(key, {
                    date: item.date,
                    userId: item.userId,
                    lessonId: item.lessonId,
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

        // Filter to sessions with 5+ words (likely tests)
        const testResults: TestResult[] = [];
        const lessonIds = new Set<number>();

        testSessions.forEach(session => {
            if (session.wordIds.size >= 5) {
                if (session.lessonId) {
                    lessonIds.add(session.lessonId);
                }
                const total = session.correct + session.incorrect;
                testResults.push({
                    date: session.date,
                    score: total > 0 ? (session.correct / total) * 100 : 0,
                    totalWords: session.wordIds.size,
                    correctWords: session.correct,
                    lessonId: session.lessonId,
                    lessonTitle: null, // Will be filled below
                });
            }
        });

        // Get lesson titles
        if (lessonIds.size > 0) {
            const lessonsData = await db
                .select({
                    id: lessons.id,
                    title: lessons.title,
                })
                .from(lessons)
                .where(inArray(lessons.id, Array.from(lessonIds)));

            const lessonMap = new Map(lessonsData.map(l => [l.id, l.title]));

            testResults.forEach(result => {
                if (result.lessonId) {
                    result.lessonTitle = lessonMap.get(result.lessonId) || null;
                }
            });
        }

        return testResults.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("Failed to fetch test results:", error);
        return [];
    }
}

export async function getUserActivitySummary(
    userId?: string,
    startDate?: Date,
    endDate?: Date
): Promise<UserActivitySummary> {
    await requireAdmin();

    try {
        const conditions = [];
        if (userId) {
            conditions.push(eq(userProgress.userId, userId));
        }
        if (startDate) {
            conditions.push(gte(sql`DATE(${userProgress.lastReviewedAt})`, startDate.toISOString().split('T')[0]));
        }
        if (endDate) {
            conditions.push(lte(sql`DATE(${userProgress.lastReviewedAt})`, endDate.toISOString().split('T')[0]));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get all progress data
        const allProgress = await db
            .select({
                date: sql<string>`DATE(${userProgress.lastReviewedAt})`.as('date'),
                userId: userProgress.userId,
                wordId: userProgress.wordId,
                correctCount: userProgress.correctCount,
                incorrectCount: userProgress.incorrectCount,
            })
            .from(userProgress)
            .where(whereClause);

        const totalWordsReviewed = new Set(allProgress.map(p => `${p.userId}-${p.wordId}`)).size;
        const totalCorrect = allProgress.reduce((sum, p) => sum + p.correctCount, 0);
        const totalIncorrect = allProgress.reduce((sum, p) => sum + p.incorrectCount, 0);

        const averageAccuracy =
            totalCorrect + totalIncorrect > 0
                ? (totalCorrect / (totalCorrect + totalIncorrect)) * 100
                : 0;

        // Count practice sessions (distinct user-date combinations)
        const practiceSessions = new Set(
            allProgress.map(p => `${p.userId}-${p.date}`)
        ).size;

        // Count test sessions (user-date combinations with 5+ words)
        const dailyWordCounts = new Map<string, number>();
        allProgress.forEach(p => {
            const key = `${p.userId}-${p.date}`;
            dailyWordCounts.set(key, (dailyWordCounts.get(key) || 0) + 1);
        });

        const testSessions = Array.from(dailyWordCounts.values()).filter(count => count >= 5).length;

        // Calculate streaks
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

