import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { toolRegistry, tools } from "./tools";

const anthropic = new Anthropic();
const model = "claude-3-5-haiku-latest";

const userHexCode = "#e11d48"; // Hex code for user's color
const claudeHexCode = "#d97757"; // Hex code for Claude's color
const toolHexCode = "#0d9488"; // Hex code for tools color

async function processToolUse(
  toolUse: Anthropic.ToolUseBlock
): Promise<Anthropic.ContentBlockParam> {
  const handler = toolRegistry[toolUse.name];
  if (!handler) {
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: `Unknown tool: ${toolUse.name}`,
    };
  }

  const result = await handler(toolUse.input);
  return {
    type: "tool_result",
    tool_use_id: toolUse.id,
    content: result,
  };
}

async function chat() {
  const messages: Anthropic.MessageParam[] = [];
  const sessionId = `sess_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}`;
  const sessionDir = resolve(sessionId);

  await mkdir(sessionDir, { recursive: true });

  let messageCounter = 1;

  let stopReason: Anthropic.StopReason | null = null;

  while (true) {
    if (stopReason !== "tool_use") {
      const userInput = prompt(chalk.hex(userHexCode).bold("You:"));

      if (!userInput || userInput.toLowerCase() === "exit") {
        console.log("Goodbye!");
        break;
      }

      messages.push({ role: "user", content: userInput });
    }

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ContentBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(
          `${chalk.hex(claudeHexCode).bold("Claude:")} ${block.text}`
        );
      } else if (block.type === "tool_use") {
        console.log(
          `${chalk.hex(toolHexCode).bold(`${block.name}`)} with args:\n`,
          block.input
        );
        toolResults.push(await processToolUse(block));
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
      await Bun.write(
        resolve(sessionDir, `${messageCounter}.json`),
        JSON.stringify(messages, null, 2)
      );
      messageCounter++;
    }

    stopReason = response.stop_reason;
  }
}

function showWelcome() {
  const title = "Welcome to nano-claude-code!";
  console.log();
  console.log(chalk.hex(claudeHexCode).bold(title));
  console.log();
}

showWelcome();
chat().catch(console.error);
