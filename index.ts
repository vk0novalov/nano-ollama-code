#!/usr/bin/env bun
import chalk from "chalk";
import type { Message, ToolCall } from "ollama";
import { Ollama } from "ollama";
import { read_file, toolRegistry, tools } from "./tools";

const ollama = new Ollama({ host: "http://localhost:11434" });
const model = "qwen3:8b";

// Define colors for different roles when printing messages.
const userHexCode = "#e11d48";
const assistantHexCode = "#d97757";
const toolHexCode = "#0d9488";

async function processToolCall(toolCall: ToolCall): Promise<Message> {
  const handler = toolRegistry[toolCall.function.name];
  if (!handler) throw new Error(`Unknown tool: ${toolCall.function.name}`);

  const args =
    typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;
  const result = await handler(args);

  return {
    role: "tool",
    content: result,
  };
}

async function chat() {
  const messages: Message[] = [];

  while (true) {
    const userInput = prompt(chalk.hex(userHexCode).bold("You:"));

    if (!userInput || userInput.toLowerCase() === "exit") {
      console.log("Goodbye!");
      break;
    }

    messages.push({ role: "user", content: userInput });

    const instructions = await read_file({
      path: new URL("prompt.md", import.meta.url).pathname,
    });

    try {
      const response = await ollama.chat({
        model,
        messages: [{ role: "system", content: instructions }, ...messages],
        tools,
      });

      if (response.message.content) {
        console.log(
          `${chalk.hex(assistantHexCode).bold("Assistant:")} ${response.message.content}`,
        );
      }

      messages.push(response.message);

      // Handle tool calls
      if (
        response.message.tool_calls &&
        response.message.tool_calls.length > 0
      ) {
        for (const toolCall of response.message.tool_calls) {
          console.log(
            `\n${chalk.hex(toolHexCode).bold(`🔧 ${toolCall.function.name}`)}`,
          );
          console.log(chalk.gray("─".repeat(50)));

          console.log(chalk.hex(toolHexCode)("Arguments:"));
          console.log(chalk.gray(toolCall.function.arguments));

          const toolResult = await processToolCall(toolCall);

          console.log(chalk.hex(toolHexCode)("Result:"));
          console.log(chalk.gray(toolResult.content));
          console.log(chalk.gray("─".repeat(50)));

          messages.push(toolResult);
        }

        // Get the final response after tool execution
        const finalResponse = await ollama.chat({
          model,
          messages: [{ role: "system", content: instructions }, ...messages],
          tools,
        });

        if (finalResponse.message.content) {
          console.log(
            `${chalk.hex(assistantHexCode).bold("Assistant:")} ${finalResponse.message.content}`,
          );
        }

        messages.push(finalResponse.message);
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error);
    }
  }
}

console.log();
console.log(chalk.hex(assistantHexCode).bold("Welcome to nano-ollama-code!"));
console.log(chalk.gray("Make sure Ollama is running locally on port 11434"));
console.log();
chat().catch(console.error);
