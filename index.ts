import Anthropic from "@anthropic-ai/sdk";
import { execute_bash, list_files, read_file, write_file } from "./tools";

const anthropic = new Anthropic();
const model = "claude-3-5-haiku-latest";

type ToolHandler = (input: any) => Promise<string>;

const toolRegistry: Record<string, ToolHandler> = {
  list_files,
  read_file,
  write_file,
  execute_bash,
};

const tools: Anthropic.Tool[] = [
  {
    name: "list_files",
    description: "List files in a directory",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The path to the directory to list files from, e.g., '.' or './src'.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The path to the file to read." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file (overwrites existing content)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The path to the file to write." },
        content: {
          type: "string",
          description: "The content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "execute_bash",
    description: "Execute a bash command and return its output",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute.",
        },
      },
      required: ["command"],
    },
  },
];

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

  while (true) {
    const userInput = prompt("You:");

    if (!userInput || userInput.toLowerCase() === "exit") {
      console.log("Goodbye!");
      break;
    }

    messages.push({ role: "user", content: userInput });

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
        console.log(`Claude: ${block.text}`);
      } else if (block.type === "tool_use") {
        toolResults.push(await processToolUse(block));
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }

    console.log(JSON.stringify(messages, null, 2));

    if (response.stop_reason === "end_turn") {
      break;
    }
  }
}

chat().catch(console.error);
