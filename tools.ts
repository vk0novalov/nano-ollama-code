import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export async function list_files(args: { path: string }): Promise<string> {
  try {
    const absPath = resolve(args.path);
    const files = await readdir(absPath);
    return files.join("\n");
  } catch (error) {
    return `Error listing files: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function read_file(args: { path: string }): Promise<string> {
  try {
    const file = Bun.file(resolve(args.path));
    return await file.text();
  } catch (error) {
    return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function write_file(args: {
  path: string;
  content: string;
}): Promise<string> {
  try {
    const absPath = resolve(args.path);
    await Bun.write(absPath, args.content);
    return `File written to ${absPath}`;
  } catch (error) {
    return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
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
    return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Test runner for execute_bash
if (import.meta.main) {
  console.log("Testing execute_bash with 'echo Hello World'");
  const result = await execute_bash({ command: "echo Hello World" });
  console.log("Result:", result.trim());
}
