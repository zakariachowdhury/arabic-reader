import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getOpenRouterConfig } from "@/lib/openrouter";

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
        const existingWordsJson = formData.get("existingWords") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No image file provided" }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "File must be an image" }, { status: 400 });
        }

        // Parse existing words for duplicate checking
        let existingWords: Array<{ arabic: string; english: string }> = [];
        if (existingWordsJson) {
            try {
                existingWords = JSON.parse(existingWordsJson);
            } catch (e) {
                console.error("Failed to parse existing words:", e);
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
        // Try to find a vision model in supported models, otherwise use a default
        const visionModels = [
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "anthropic/claude-3.5-sonnet",
            "anthropic/claude-3-opus",
            "google/gemini-pro-vision",
        ];

        let model = visionModels[0]; // Default
        if (selectedModel && config.supportedModels.includes(selectedModel)) {
            // Use selected model if it's in supported list
            model = selectedModel;
        } else if (config.supportedModels.length > 0) {
            // Find first supported vision model
            const supportedVisionModel = visionModels.find((m) =>
                config.supportedModels.includes(m)
            );
            if (supportedVisionModel) {
                model = supportedVisionModel;
            }
        }

        // Build the base prompt
        let basePrompt = `You are an expert in Arabic language education. Analyze this image of a vocabulary page from an Arabic textbook. Extract all Arabic-English word pairs from the page.

CRITICAL: You must extract the EXACT words as they appear in the image. Do NOT generate, paraphrase, translate, or create new words. Copy the text character-by-character exactly as it appears in the image.

The image shows a vocabulary dictionary page with a TWO-COLUMN layout:
- **Left column**: Contains English translations, explanations, or contextual information
- **Right column**: Contains Arabic words/phrases (or vice versa depending on page layout)
- Sometimes there may be a third column with additional information like root forms, phonetic breakdowns, or morphological analysis

IMPORTANT: The page has TWO main columns for word pairs. You must extract word pairs from BOTH columns, not just the first one. Look for:
- English text in one column paired with Arabic text in another column
- Each row typically represents one vocabulary word pair
- Some rows may have additional information (morphological breakdowns, root forms, etc.) - extract the main word pair

Please extract ALL word pairs from BOTH columns and return them as a JSON array in this exact format:
[
  {
    "arabic": "الْعَرَبِيَّةُ",
    "english": "Arabic"
  },
  {
    "arabic": "الْإِنْجِلِيزِيَّةُ",
    "english": "English"
  }
]

Important extraction rules:
- Extract word pairs from BOTH the left and right columns (or all columns if there are more)
- Extract only actual vocabulary word pairs (Arabic and English)
- Ignore headers, titles, page numbers, section titles, and other metadata
- COPY THE EXACT TEXT from the image - do not translate, paraphrase, or generate alternative words
- For Arabic words: Copy the exact Arabic text as it appears, including all diacritics (tashkeel)
- For English words: Copy the exact English text as it appears, including capitalization and punctuation
- If a word has multiple translations shown, extract the exact text of the primary/main translation as it appears
- If there are morphological breakdowns in parentheses, extract the main word exactly as shown (not the breakdown)
- DO NOT create synonyms or alternative translations - use only what is visible in the image
- Return ONLY valid JSON, no additional text or explanation
- If you find no word pairs, return an empty array: []`;

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
        let wordPairs: Array<{ arabic: string; english: string }> = [];
        let duplicates: Array<{ arabic: string; english: string }> = [];
        
        try {
            // Try to extract JSON from the response (in case there's extra text)
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                wordPairs = JSON.parse(jsonMatch[0]);
            } else {
                // Try parsing the whole content
                wordPairs = JSON.parse(content);
            }

            // Validate the structure
            if (!Array.isArray(wordPairs)) {
                throw new Error("Response is not an array");
            }

            // Filter and validate word pairs
            wordPairs = wordPairs
                .filter((pair) => pair.arabic && pair.english)
                .map((pair) => ({
                    arabic: String(pair.arabic).trim(),
                    english: String(pair.english).trim(),
                }))
                .filter((pair) => pair.arabic.length > 0 && pair.english.length > 0);

            // Filter out duplicates based on existing words
            // Normalize for comparison (case-insensitive, trim whitespace)
            const normalizeWord = (text: string) => text.toLowerCase().trim();
            const existingWordsSet = new Set(
                existingWords.map((w) => 
                    `${normalizeWord(w.arabic)}|${normalizeWord(w.english)}`
                )
            );

            const duplicates: Array<{ arabic: string; english: string }> = [];
            const uniqueWordPairs = wordPairs.filter((pair) => {
                const normalized = `${normalizeWord(pair.arabic)}|${normalizeWord(pair.english)}`;
                if (existingWordsSet.has(normalized)) {
                    duplicates.push(pair);
                    return false;
                }
                return true;
            });

            wordPairs = uniqueWordPairs;
        } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            console.error("Response content:", content);
            return NextResponse.json(
                {
                    error: "Failed to parse extracted word pairs. The AI response was not in the expected format.",
                    rawResponse: content,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            wordPairs,
            duplicates: duplicates || [],
            model: data.model || model,
        });
    } catch (error) {
        console.error("Error parsing vocabulary image:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to parse vocabulary image",
            },
            { status: 500 }
        );
    }
}

