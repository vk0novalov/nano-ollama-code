#!/usr/bin/env bun
import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { read_file, toolRegistry, tools } from "./tools";

const anthropic = new Anthropic();
const model = "claude-3-5-haiku-latest";
const maxTokens = 4096;

// Define colors for different roles when printing messages.
const userHexCode = "#e11d48";
const claudeHexCode = "#d97757";
const toolHexCode = "#0d9488";

async function processToolUse(
  toolUse: Anthropic.ToolUseBlock
): Promise<Anthropic.ToolResultBlockParam> {
  const handler = toolRegistry[toolUse.name];
  if (!handler) throw new Error(`Unknown tool: ${toolUse.name}`);
  const result = await handler(toolUse.input);
  return {
    type: "tool_result",
    tool_use_id: toolUse.id,
    content: result,
  };
}

async function chat() {
  const messages: Anthropic.MessageParam[] = [];
  let stopReason: Anthropic.StopReason | null = null;

  while (true) {
    // If the last response was not a tool use, prompt for user input.
    if (stopReason !== "tool_use") {
      const userInput = prompt(chalk.hex(userHexCode).bold("You:"));

      if (!userInput || userInput.toLowerCase() === "exit") {
        console.log("Goodbye!");
        break;
      }

      messages.push({ role: "user", content: userInput });
    }

    const instructions = await read_file({
      path: new URL("prompt.md", import.meta.url).pathname,
    });

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      tools,
      messages,
      system: instructions,
    });

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ContentBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(
          `${chalk.hex(claudeHexCode).bold("Claude:")} ${block.text}`
        );
      } else if (block.type === "tool_use") {
        const toolResult = await processToolUse(block);
        toolResults.push(toolResult);

        console.log(`\n${chalk.hex(toolHexCode).bold(`🔧 ${block.name}`)}`);
        console.log(chalk.gray("─".repeat(50)));

        console.log(chalk.hex(toolHexCode)("Arguments:"));
        console.log(chalk.gray(JSON.stringify(block.input, null, 2)));

        console.log(chalk.hex(toolHexCode)("Result:"));
        console.log(chalk.gray(toolResult.content));
        console.log(chalk.gray("─".repeat(50)));
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }

    stopReason = response.stop_reason;
  }
}

console.log();
console.log(chalk.hex(claudeHexCode).bold("Welcome to nano-claude-code!"));
console.log();
chat().catch(console.error);
