import { pgTable, serial, text, boolean, timestamp, integer, real } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    isAdmin: boolean("is_admin").default(false).notNull(),
    aiEnabled: boolean("ai_enabled").default(true).notNull(),
    defaultGroupId: integer("default_group_id"),
    arabicFontSizeMultiplier: real("arabic_font_size_multiplier").default(1.5).notNull(),
    englishFontSizeMultiplier: real("english_font_size_multiplier").default(1.0).notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id),
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
});

export const groups = pgTable("groups", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color"),
    description: text("description"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const todos = pgTable("todos", {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    completed: boolean("completed").default(false).notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id),
    groupId: integer("group_id")
        .references(() => groups.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(), // Unique key for each setting (e.g., "openrouter.api_key", "openrouter.supported_models")
    value: text("value").notNull(), // JSON string value
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: text("updated_by")
        .references(() => user.id),
});

export const books = pgTable("books", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    order: integer("order").default(0).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const units = pgTable("units", {
    id: serial("id").primaryKey(),
    bookId: integer("book_id")
        .notNull()
        .references(() => books.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    order: integer("order").default(0).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lessons = pgTable("lessons", {
    id: serial("id").primaryKey(),
    unitId: integer("unit_id")
        .notNull()
        .references(() => units.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").notNull(), // e.g., "vocabulary", "reading", "grammar"
    order: integer("order").default(0).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vocabularyWords = pgTable("vocabulary_words", {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
        .notNull()
        .references(() => lessons.id, { onDelete: "cascade" }),
    arabic: text("arabic").notNull(),
    english: text("english").notNull(),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationSentences = pgTable("conversation_sentences", {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
        .notNull()
        .references(() => lessons.id, { onDelete: "cascade" }),
    arabic: text("arabic").notNull(),
    english: text("english"),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userProgress = pgTable("user_progress", {
    id: serial("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
        .notNull()
        .references(() => vocabularyWords.id, { onDelete: "cascade" }),
    seen: boolean("seen").default(false).notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    incorrectCount: integer("incorrect_count").default(0).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type VocabularyWord = typeof vocabularyWords.$inferSelect;
export type NewVocabularyWord = typeof vocabularyWords.$inferInsert;
export type ConversationSentence = typeof conversationSentences.$inferSelect;
export type NewConversationSentence = typeof conversationSentences.$inferInsert;
export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;
