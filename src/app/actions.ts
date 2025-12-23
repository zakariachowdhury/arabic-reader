"use server";

import { db } from "@/db";
import { todos, verification, user, groups, settings, books, units, lessons, vocabularyWords, userProgress } from "@/db/schema";
import { eq, asc, and, desc, inArray } from "drizzle-orm";
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
            .orderBy(asc(books.title));
    } catch (error) {
        console.error("Failed to fetch books:", error);
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
            .where(eq(books.id, id))
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
        return await db
            .select()
            .from(units)
            .where(eq(units.bookId, bookId))
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
        const [unit] = await db
            .select()
            .from(units)
            .where(eq(units.id, id))
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
        return await db
            .select()
            .from(lessons)
            .where(eq(lessons.unitId, unitId))
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
        const [lesson] = await db
            .select()
            .from(lessons)
            .where(eq(lessons.id, id))
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
