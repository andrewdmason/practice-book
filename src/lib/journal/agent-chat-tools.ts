import { createClient } from "@/lib/supabase/server";
import type { JournalAgentFileName } from "@/lib/types";

const ALLOWED_NAMES: JournalAgentFileName[] = ["Interviewer", "User"];

export const AGENT_CHAT_TOOLS = [
  {
    name: "read_agent_file",
    description:
      "Read the current content of one of the agent files. " +
      "Both files are already included in your system prompt, so you " +
      "rarely need this — only call it after you've made an edit and want to " +
      "verify the resulting state.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          enum: ALLOWED_NAMES,
          description: "Which agent file to read.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_agent_file",
    description:
      "Make a surgical edit to an agent file by replacing one exact substring. " +
      "`find` must match exactly once in the current file content. Include " +
      "enough surrounding context to make the match unique. To insert new " +
      "text without removing anything, use `append_to_agent_file`. " +
      "If the match fails or is ambiguous, the tool returns an error and you " +
      "should reread the file and retry with better context, or ask the user " +
      "for clarification.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", enum: ALLOWED_NAMES },
        find: { type: "string", description: "Exact substring to replace." },
        replace: { type: "string", description: "New text to put in its place." },
      },
      required: ["name", "find", "replace"],
    },
  },
  {
    name: "append_to_agent_file",
    description:
      "Append text to the end of an agent file (with a leading newline if the " +
      "file doesn't already end with one). Convenient for adding a new bullet " +
      "to Interviewer or a new section to Me without having to specify a find target.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", enum: ALLOWED_NAMES },
        text: { type: "string", description: "Text to append." },
      },
      required: ["name", "text"],
    },
  },
  {
    name: "replace_agent_file",
    description:
      "Overwrite the entire contents of an agent file. Use sparingly — only " +
      "for top-to-bottom rewrites the user has explicitly asked for. Prefer " +
      "`edit_agent_file` for targeted changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", enum: ALLOWED_NAMES },
        content: { type: "string", description: "Full new content of the file." },
      },
      required: ["name", "content"],
    },
  },
];

export type ToolExecResult = {
  // Returned to Claude as the tool_result content.
  toolResult: string;
  // Short human-readable marker streamed inline to the user (e.g. "[updated User]").
  marker?: string;
  isError?: boolean;
};

function parseName(input: Record<string, unknown>): JournalAgentFileName | null {
  const n = input.name;
  if (typeof n !== "string") return null;
  if (!ALLOWED_NAMES.includes(n as JournalAgentFileName)) return null;
  return n as JournalAgentFileName;
}

export async function executeAgentChatTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolExecResult> {
  const supabase = await createClient();

  if (toolName === "read_agent_file") {
    const name = parseName(input);
    if (!name) return error("read_agent_file: invalid `name`.");
    const { data, error: e } = await supabase
      .from("journal_agent_files")
      .select("content")
      .eq("name", name)
      .single();
    if (e || !data) return error(`read_agent_file: ${e?.message ?? "not found"}.`);
    return { toolResult: data.content ?? "" };
  }

  if (toolName === "edit_agent_file") {
    const name = parseName(input);
    const find = typeof input.find === "string" ? input.find : null;
    const replace = typeof input.replace === "string" ? input.replace : null;
    if (!name || find === null || replace === null) {
      return error("edit_agent_file: missing `name`, `find`, or `replace`.");
    }
    if (find.length === 0) {
      return error("edit_agent_file: `find` must not be empty.");
    }

    const { data, error: e } = await supabase
      .from("journal_agent_files")
      .select("id, content")
      .eq("name", name)
      .single();
    if (e || !data) return error(`edit_agent_file: ${e?.message ?? "not found"}.`);

    const current = data.content ?? "";
    const first = current.indexOf(find);
    if (first === -1) {
      return error(
        `edit_agent_file: \`find\` was not found in ${name}. Reread the file and retry with the exact existing text.`
      );
    }
    const second = current.indexOf(find, first + find.length);
    if (second !== -1) {
      return error(
        `edit_agent_file: \`find\` matched more than once in ${name}. Include more surrounding context so the match is unique.`
      );
    }
    const next = current.slice(0, first) + replace + current.slice(first + find.length);

    const { error: writeErr } = await supabase
      .from("journal_agent_files")
      .update({ content: next })
      .eq("id", data.id);
    if (writeErr) return error(`edit_agent_file: ${writeErr.message}`);

    return {
      toolResult: `Edited ${name} (replaced ${find.length} chars with ${replace.length}).`,
      marker: `[updated ${name}]`,
    };
  }

  if (toolName === "append_to_agent_file") {
    const name = parseName(input);
    const text = typeof input.text === "string" ? input.text : null;
    if (!name || text === null) {
      return error("append_to_agent_file: missing `name` or `text`.");
    }
    const { data, error: e } = await supabase
      .from("journal_agent_files")
      .select("id, content")
      .eq("name", name)
      .single();
    if (e || !data) return error(`append_to_agent_file: ${e?.message ?? "not found"}.`);

    const current = data.content ?? "";
    const sep = current.length === 0 || current.endsWith("\n") ? "" : "\n";
    const next = current + sep + text + (text.endsWith("\n") ? "" : "\n");

    const { error: writeErr } = await supabase
      .from("journal_agent_files")
      .update({ content: next })
      .eq("id", data.id);
    if (writeErr) return error(`append_to_agent_file: ${writeErr.message}`);

    return {
      toolResult: `Appended ${text.length} chars to ${name}.`,
      marker: `[updated ${name}]`,
    };
  }

  if (toolName === "replace_agent_file") {
    const name = parseName(input);
    const content = typeof input.content === "string" ? input.content : null;
    if (!name || content === null) {
      return error("replace_agent_file: missing `name` or `content`.");
    }
    const { error: writeErr } = await supabase
      .from("journal_agent_files")
      .update({ content })
      .eq("name", name);
    if (writeErr) return error(`replace_agent_file: ${writeErr.message}`);
    return {
      toolResult: `Replaced full contents of ${name} (${content.length} chars).`,
      marker: `[updated ${name}]`,
    };
  }

  return error(`Unknown tool: ${toolName}`);
}

function error(msg: string): ToolExecResult {
  return { toolResult: msg, isError: true };
}
