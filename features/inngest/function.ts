import { prisma } from "@/lib/db";
import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";

import {
  createAgent,
  createNetwork,
  createState,
  createTool,
  gemini,
} from "@inngest/agent-kit";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/lib/prompt";
import z from "zod";
import {
  agentOutputText,
  connectSandbox,
  lastAssistantTextMessageContent,
} from "./utils";
import { MessageType, MessageRole } from "@/lib/generated/prisma/browser";

export interface CodeAgentState {
  sandboxId: string;
  summary: string;
  files: Record<string, string>;
}

export function formatErrorMessage(error: unknown): string {
  const rawMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted") ||
    lower.includes("too many requests") ||
    lower.includes("exceeded your current quota")
  ) {
    return "API rate limit reached. The Gemini API quota has been exceeded. Please check your API quota or wait a few moments before trying again.";
  }

  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "API authentication error. Please verify your GEMINI_API_KEY.";
  }

  if (
    lower.includes("sandbox") ||
    lower.includes("e2b") ||
    lower.includes("timeout")
  ) {
    return "Execution environment error. The code sandbox failed to start or timed out. Please try again.";
  }

  return rawMessage
    ? `Generation failed: ${rawMessage}`
    : "Something went wrong during generation. Please try again.";
}

export const codeAgentFunction = inngest.createFunction(
  {
    id: "code-agent",
    triggers: { event: "code-agent/run" },
    retries: 0,
    onFailure: async ({ error, event, step }) => {
      const projectId = event.data?.event?.data?.projectId;
      if (!projectId) return;

      await step.run("record-on-failure", async () => {
        const lastMsg = await prisma.message.findFirst({
          where: { projectId },
          orderBy: { createdAt: "desc" },
        });

        if (lastMsg && lastMsg.role === MessageRole.USER) {
          await prisma.message.create({
            data: {
              projectId,
              content: formatErrorMessage(error),
              role: MessageRole.ASSISTANT,
              type: MessageType.ERROR,
            },
          });
        }
      });
    },
  },
  async ({ event, step }) => {
    const projectId = event.data.projectId;

    try {
      const sandboxId = await step.run("get-sandbox-id", async () => {
        const sandbox = await Sandbox.create({
          template: "cco0mg416isro6vo32gt",
        });

        return sandbox.sandboxId;
      });

      const previousMessages = await step.run(
        "get-previous-messages",
        async () => {
          const messages = await prisma.message.findMany({
            where: {
              projectId,
            },
            orderBy: {
              createdAt: "asc",
            },
          });

          return messages.map((message) => ({
            type: "text" as const,
            role:
              message.role === MessageRole.ASSISTANT
                ? ("assistant" as const)
                : ("user" as const),
            content: message.content,
          }));
        },
      );

      const state = createState<CodeAgentState>(
        { sandboxId, summary: "", files: {} },
        { messages: previousMessages },
      );

      const geminiModel = gemini({
        model: "gemini-2.5-flash",
        step,
        apiKey: process.env.GEMINI_API_KEY!,
        defaultParameters: {
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 0 },
          },
        },
      } as Parameters<typeof gemini>[0]);

      const codeAgent = createAgent({
        name: "code-agent",
        description: "An expert coding agent",
        system: PROMPT,
        model: gemini({ model: "gemini-2.5-flash" }),
        tools: [
          // 1. Terminal
          createTool({
            name: "terminal",
            description: "Use the terminal to run commands",
            parameters: z.object({
              command: z.string(),
            }),
            handler: async ({ command }, { step }) => {
              return await step?.run("terminal", async () => {
                const buffers = { stdout: "", stderr: "" };

                try {
                  const sandbox = await Sandbox.connect(sandboxId);

                  const result = await sandbox.commands.run(command, {
                    onStdout: (data) => {
                      buffers.stdout += data;
                    },

                    onStderr: (data) => {
                      buffers.stderr += data;
                    },
                  });

                  return result.stdout;
                } catch (error) {
                  console.log(
                    `Command failed: ${error} \n stdout: ${buffers.stdout}\n stderr: ${buffers.stderr}`,
                  );

                  return `Command failed: ${error} \n stdout: ${buffers.stdout}\n stderr: ${buffers.stderr}`;
                }
              });
            },
          }),

          // 2. createOrUpdateFiles
          createTool({
            name: "createOrUpdateFiles",
            description: "Create or update files in the sanbox",
            parameters: z.object({
              files: z.array(
                z.object({
                  path: z.string(),
                  content: z.string(),
                }),
              ),
            }),

            handler: async ({ files }, { step, network }) => {
              const newFiles = await step?.run(
                "createOrUpdateFiles",
                async () => {
                  try {
                    const updatedFiles = network?.state?.data.files || {};

                    const sanbox = await Sandbox.connect(sandboxId);

                    for (const file of files) {
                      await sanbox.files.write(file.path, file.content);
                      updatedFiles[file.path] = file.content;
                    }

                    return updatedFiles;
                  } catch (error) {
                    return "Error" + error;
                  }
                },
              );

              if (typeof newFiles === "object") {
                network.state.data.files = newFiles;
              }
            },
          }),
          // 3. readFiles
          createTool({
            name: "readFiles",
            description: "Read files in the sandbox",

            parameters: z.object({
              files: z.array(z.string()),
            }),
            handler: async ({ files }, { step }) => {
              return await step?.run("readFiles", async () => {
                try {
                  const sanbox = await Sandbox.connect(sandboxId);

                  const contents: any = [];

                  for (const file of files) {
                    const content = await sanbox.files.read(file);
                    contents.push({ path: file, content });
                  }
                  return JSON.stringify(contents);
                } catch (error) {
                  return "Error" + error;
                }
              });
            },
          }),
        ],

        lifecycle: {
          onResponse: async ({ result, network }) => {
            const lastAssistantMessageText =
              lastAssistantTextMessageContent(result);

            if (lastAssistantMessageText && network) {
              if (lastAssistantMessageText.includes("<task_summary>")) {
                network.state.data.summary = lastAssistantMessageText;
              }
            }

            return result;
          },
        },
      });

      const network = createNetwork({
        name: "code-agent-network",
        agents: [codeAgent],
        maxIter: 15,
        router: async ({ network }) => {
          const summary = network.state.data.summary;

          if (summary) {
            return;
          }

          return codeAgent;
        },
      });

      const result = await network.run(event.data.value, { state });
      const { summary, files } = result.state.data;

      const isError =
        !result.state.data.summary ||
        Object.keys(result.state.data.files || {}).length === 0;

      if (isError) {
        await step.run("save-error-result", async () => {
          return prisma.message.create({
            data: {
              projectId,
              content: "The AI agent was unable to generate the requested files. Please try rephrasing your prompt.",
              role: MessageRole.ASSISTANT,
              type: MessageType.ERROR,
            },
          });
        });

        return { error: "No files generated" };
      }

      const makeTextAgent = (name: string, system: string) =>
        createAgent({ name, system, model: geminiModel });

      const fragmentTitleGenerator = makeTextAgent(
        "fragment-title-generator",
        FRAGMENT_TITLE_PROMPT,
      );
      const responseGenerator = makeTextAgent(
        "response-generator",
        RESPONSE_PROMPT,
      );

      const [{ output: fragmentTitleOutput }, { output: responseOutput }] =
        await Promise.all([
          fragmentTitleGenerator.run(summary, { step }),
          responseGenerator.run(summary, { step }),
        ]);

      const fragmentTitle = agentOutputText(fragmentTitleOutput, "Untitled");
      const responseText = agentOutputText(responseOutput, "Here you go");

      const sandboxUrl = await step.run("get-sandbox-url", async () => {
        const sandbox = await connectSandbox(sandboxId);
        return `http://${sandbox.getHost(3000)}`;
      });

      await step.run("save-result", async () => {
        return prisma.message.create({
          data: {
            projectId,
            content: responseText,
            role: MessageRole.ASSISTANT,
            type: MessageType.RESULT,
            fragments: {
              create: {
                sandboxUrl,
                title: fragmentTitle,
                files,
              },
            },
          },
        });
      });

      return {
        url: sandboxUrl,
        title: fragmentTitle,
        files,
        summary,
      };
    } catch (error) {
      console.error("❌ Error in codeAgentFunction:", error);
      const errorMessage = formatErrorMessage(error);

      await step.run("save-caught-error", async () => {
        return prisma.message.create({
          data: {
            projectId,
            content: errorMessage,
            role: MessageRole.ASSISTANT,
            type: MessageType.ERROR,
          },
        });
      });

      return { error: errorMessage };
    }
  },
);
