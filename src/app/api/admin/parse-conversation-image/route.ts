import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getOpenRouterConfig } from "@/lib/openrouter";
import { db } from "@/db";
import { lessons, vocabularyWords, units } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
    try {
        await requireAdmin();
    } catch (error) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("image") as File;
        const selectedModel = formData.get("model") as string | null;
        const customPrompt = formData.get("customPrompt") as string | null;
        const existingSentencesJson = formData.get("existingSentences") as string | null;
        const lessonIdStr = formData.get("lessonId") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No image file provided" }, { status: 400 });
        }

        if (!lessonIdStr) {
            return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
        }

        const lessonId = parseInt(lessonIdStr);
        if (isNaN(lessonId)) {
            return NextResponse.json({ error: "Invalid lesson ID" }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "File must be an image" }, { status: 400 });
        }

        // Parse existing sentences for duplicate checking
        let existingSentences: Array<{ arabic: string; english?: string }> = [];
        if (existingSentencesJson) {
            try {
                existingSentences = JSON.parse(existingSentencesJson);
            } catch (e) {
                console.error("Failed to parse existing sentences:", e);
            }
        }

        // Get lesson to find unitId
        const [lesson] = await db
            .select()
            .from(lessons)
            .where(eq(lessons.id, lessonId))
            .limit(1);

        if (!lesson) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        // Get all vocabulary words from vocabulary lessons in this unit
        const unitLessons = await db
            .select()
            .from(lessons)
            .where(and(eq(lessons.unitId, lesson.unitId), eq(lessons.type, "vocabulary")));

        let vocabularyContext = "";
        if (unitLessons.length > 0) {
            const lessonIds = unitLessons.map(l => l.id);
            const vocabWords = await db
                .select()
                .from(vocabularyWords)
                .where(inArray(vocabularyWords.lessonId, lessonIds))
                .orderBy(vocabularyWords.order);

            if (vocabWords.length > 0) {
                // Build vocabulary context for the AI prompt
                const vocabList = vocabWords.slice(0, 100).map(w => `  - "${w.arabic}" = "${w.english}"`).join("\n");
                vocabularyContext = `\n\nIMPORTANT: Use the following vocabulary from this unit to help translate the Arabic sentences accurately:\n${vocabList}\n\nWhen translating Arabic sentences, prioritize using these vocabulary words and their meanings. If a sentence contains words from this vocabulary list, use the exact English translations provided.`;
            }
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString("base64");
        const mimeType = file.type;

        // Get OpenRouter config
        const config = await getOpenRouterConfig();
        if (!config || !config.apiKey) {
            return NextResponse.json(
                { error: "OpenRouter API key not configured" },
                { status: 500 }
            );
        }

        // Use a vision-capable model (default to gpt-4o or claude-3.5-sonnet if available)
        const visionModels = [
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "anthropic/claude-3.5-sonnet",
            "anthropic/claude-3-opus",
            "google/gemini-pro-vision",
        ];

        let model = visionModels[0]; // Default
        if (selectedModel && config.supportedModels.includes(selectedModel)) {
            model = selectedModel;
        } else if (config.supportedModels.length > 0) {
            const supportedVisionModel = visionModels.find((m) =>
                config.supportedModels.includes(m)
            );
            if (supportedVisionModel) {
                model = supportedVisionModel;
            }
        }

        // Build the base prompt
        let basePrompt = `You are an expert in Arabic language education. Analyze this image of a conversation page from an Arabic textbook. Extract all Arabic sentences from the page, along with their English translations if visible.

CRITICAL: You must extract the EXACT Arabic text as it appears in the image. Do NOT generate, paraphrase, or create new sentences. Copy the text character-by-character exactly as it appears in the image, including all diacritics (tashkeel).

The image shows a conversation page with a TWO-COLUMN layout:
- **Left column**: Contains speech bubbles with Arabic sentences (or English translations)
- **Right column**: Contains speech bubbles with Arabic sentences (or English translations)
- Sentences alternate between left and right columns as the conversation flows
- Each speech bubble typically contains one or more Arabic sentences
- Some speech bubbles may have English translations visible (handwritten notes, annotations, or separate text)

IMPORTANT: The page has TWO main columns for conversation sentences. You must extract sentences from BOTH columns, not just the first one. Look for:
- Arabic sentences in speech bubbles in both left and right columns
- English translations if they appear (in annotations, notes, or separate text)
- The order of sentences should follow the natural flow of the conversation (top to bottom, alternating columns)

Please extract ALL sentences from BOTH columns and return them as a JSON array in this exact format:
[
  {
    "arabic": "السَّلامُ عَلَيْكُمْ !",
    "english": "Peace be upon you!"
  },
  {
    "arabic": "وَعَلَيْكُمُ السَّلامُ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ !",
    "english": "And upon you be peace and God's mercy and blessings!"
  },
  {
    "arabic": "أَنَا سَمِيرٍ مُحَمَّدٍ",
    "english": "I am Samir Muhammad"
  }
]

Important extraction rules:
- Extract sentences from BOTH the left and right columns
- Extract only actual conversation sentences (Arabic text in speech bubbles)
- Ignore headers, titles, page numbers, section titles, character names, and other metadata
- COPY THE EXACT ARABIC TEXT from the image - do not translate, paraphrase, or generate alternative sentences
- For Arabic sentences: Copy the exact Arabic text as it appears, including all diacritics (tashkeel)
- For English translations: If visible in the image, copy the exact English text. If not visible, you may provide a translation based on the vocabulary context provided below, but mark it clearly if it's inferred rather than extracted
- Extract sentences in the order they appear (top to bottom, left to right)
- Each speech bubble typically represents one sentence entry
- If a speech bubble contains multiple sentences, you may split them into separate entries
- Return ONLY valid JSON, no additional text or explanation
- If you find no sentences, return an empty array: []${vocabularyContext}`;

        // Use custom prompt if provided, otherwise use base prompt
        const promptText = customPrompt?.trim() || basePrompt;

        // Prepare the vision message
        const messages = [
            {
                role: "user" as const,
                content: [
                    {
                        type: "text" as const,
                        text: promptText,
                    },
                    {
                        type: "image_url" as const,
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`,
                        },
                    },
                ],
            },
        ];

        // Call OpenRouter API
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "TaskFlow",
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0, // Zero temperature for exact extraction without generation
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error?.message || `OpenRouter API error: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || "";

        // Parse the JSON response
        let sentences: Array<{ arabic: string; english?: string }> = [];
        let duplicates: Array<{ arabic: string; english?: string }> = [];
        
        try {
            // Try to extract JSON from the response (in case there's extra text)
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                sentences = JSON.parse(jsonMatch[0]);
            } else {
                // Try parsing the whole content
                sentences = JSON.parse(content);
            }

            // Validate the structure
            if (!Array.isArray(sentences)) {
                throw new Error("Response is not an array");
            }

            // Filter and validate sentences
            sentences = sentences
                .filter((s) => s.arabic)
                .map((s) => ({
                    arabic: String(s.arabic).trim(),
                    english: s.english ? String(s.english).trim() : undefined,
                }))
                .filter((s) => s.arabic.length > 0);

            // Filter out duplicates based on existing sentences
            // Normalize for comparison (case-insensitive, trim whitespace)
            const normalizeText = (text: string) => text.toLowerCase().trim();
            const existingSentencesSet = new Set(
                existingSentences.map((s) => 
                    normalizeText(s.arabic)
                )
            );

            duplicates = [];
            const uniqueSentences = sentences.filter((sentence) => {
                const normalized = normalizeText(sentence.arabic);
                if (existingSentencesSet.has(normalized)) {
                    duplicates.push(sentence);
                    return false;
                }
                return true;
            });

            sentences = uniqueSentences;
        } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            console.error("Response content:", content);
            return NextResponse.json(
                {
                    error: "Failed to parse extracted sentences. The AI response was not in the expected format.",
                    rawResponse: content,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            sentences,
            duplicates: duplicates || [],
            model: data.model || model,
        });
    } catch (error) {
        console.error("Error parsing conversation image:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to parse conversation image",
            },
            { status: 500 }
        );
    }
}

