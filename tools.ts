import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "ollama";

export async function ls_directory(args: { path: string }): Promise<string> {
  try {
    const files = await readdir(args.path);
    return `Directoty: ${args.path}\n=============\n${files.join("\n")}`;
  } catch (error) {
    return `Error reading file: ${error instanceof Error ? error.message : String(error)
      }`;
  }
}

export async function read_file(args: { path: string }): Promise<string> {
  try {
    const file = Bun.file(resolve(args.path));
    return await file.text();
  } catch (error) {
    return `Error reading file: ${error instanceof Error ? error.message : String(error)
      }`;
  }
}

export async function write_file(args: {
  path: string;
  content: string;
}): Promise<string> {
  try {
    const absPath = resolve(args.path);
    await Bun.write(absPath, args.content);
    return "File written successfully";
  } catch (error) {
    return `Error writing file: ${error instanceof Error ? error.message : String(error)
      }`;
  }
}

export async function execute_bash(args: { command: string }): Promise<string> {
  try {
    const proc = Bun.spawn(["sh", "-c", args.command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    await proc.exited;

    if (stderr) {
      return `STDERR:\n${stderr}\nSTDOUT:\n${stdout}`;
    }
    return stdout;
  } catch (error) {
    return `Error executing command: ${error instanceof Error ? error.message : String(error)
      }`;
  }
}

type ArgsType = { command: string, path: string, content: string };

type ToolHandler = (args: ArgsType) => Promise<string>;

export const toolRegistry: Record<string, ToolHandler> = {
  ls_directory,
  read_file,
  write_file,
  execute_bash,
};

export const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "ls_directory",
      description:
        "List all files and folders inside the given directory path on the local file system.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the directory to read.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file to read.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file (overwrites existing content)",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file to write.",
          },
          content: {
            type: "string",
            description: "The content to write to the file.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_bash",
      description:
        "Execute a bash command and return its output. Only use for tasks that cannot be done with any other provided tool.",
      parameters: {
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
  },
];
