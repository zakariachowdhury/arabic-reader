"use server";

import { db } from "@/db";
import { user, todos, groups, settings, books, units, lessons, vocabularyWords } from "@/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
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
        const completedTodos = allTodos.filter(t => t.completed);
        const adminUsers = allUsers.filter(u => u.isAdmin);

        return {
            totalUsers: allUsers.length,
            totalTodos: allTodos.length,
            completedTodos: completedTodos.length,
            totalAdmins: adminUsers.length,
            totalGroups: allGroups.length,
        };
    } catch (error) {
        console.error("Failed to fetch admin stats:", error);
        return {
            totalUsers: 0,
            totalTodos: 0,
            completedTodos: 0,
            totalAdmins: 0,
            totalGroups: 0,
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
            .orderBy(asc(books.title));
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
        const [newBook] = await db
            .insert(books)
            .values({
                title: data.title.trim(),
                description: data.description?.trim() || null,
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

export async function updateBook(id: number, data: { title?: string; description?: string | null }) {
    await requireAdmin();

    try {
        await db
            .update(books)
            .set({
                ...data,
                title: data.title?.trim(),
                description: data.description?.trim() || null,
                updatedAt: new Date(),
            })
            .where(eq(books.id, id));
        revalidatePath("/admin/books");
        revalidatePath(`/admin/books/${id}/units`);
        revalidatePath("/admin");
    } catch (error) {
        console.error("Failed to update book:", error);
        throw new Error("Failed to update book");
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

        const [newUnit] = await db
            .insert(units)
            .values({
                bookId,
                title: data.title.trim(),
                order: data.order ?? 0,
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

export async function updateUnit(id: number, data: { title?: string; order?: number }) {
    await requireAdmin();

    try {
        const updateData: { title?: string; order?: number; updatedAt: Date } = {
            updatedAt: new Date(),
        };
        if (data.title !== undefined) {
            updateData.title = data.title.trim();
        }
        if (data.order !== undefined) {
            updateData.order = data.order;
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

        const [newLesson] = await db
            .insert(lessons)
            .values({
                unitId,
                title: data.title.trim(),
                type: data.type.trim(),
                order: data.order ?? 0,
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

export async function updateLesson(id: number, data: { title?: string; type?: string; order?: number }) {
    await requireAdmin();

    try {
        const updateData: { title?: string; type?: string; order?: number; updatedAt: Date } = {
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

        const [newWord] = await db
            .insert(vocabularyWords)
            .values({
                lessonId,
                arabic: data.arabic.trim(),
                english: data.english.trim(),
                order: data.order ?? 0,
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

