import type { JSONContent } from "@tiptap/core";
import type { TaskStyle } from "@/lib/types";

export type ExtractedTask = {
  taskId: string;
  text: string;
  completed: boolean;
  pieceId: string | null;
  style: TaskStyle;
};

function getTextContent(node: JSONContent): string {
  if (node.text) return node.text;
  if (node.type === "metronomeMarking" && node.attrs?.bpm) {
    return `♩=${node.attrs.bpm}`;
  }
  if (!node.content) return "";
  return node.content.map(getTextContent).join("");
}

function findPieceMentionId(node: JSONContent): string | null {
  if (node.type === "pieceMention" && node.attrs?.id) {
    return node.attrs.id as string;
  }
  if (node.content) {
    for (const child of node.content) {
      const id = findPieceMentionId(child);
      if (id) return id;
    }
  }
  return null;
}

/**
 * Walk a Tiptap JSON document and extract all task items and goal blocks.
 * Both are stored as tasks; goal blocks get style: 'goal'.
 */
export function extractTasks(doc: JSONContent): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];

  function walk(node: JSONContent) {
    if (node.type === "taskItem") {
      const taskId = (node.attrs?.taskId as string) || crypto.randomUUID();
      const text = getTextContent(node).trim();
      const completed = (node.attrs?.checked as boolean) ?? false;
      const pieceId = findPieceMentionId(node);

      if (text) {
        tasks.push({ taskId, text, completed, pieceId, style: "default" });
      }
    } else if (node.type === "goalBlock") {
      const taskId = (node.attrs?.goalId as string) || crypto.randomUUID();
      const text = getTextContent(node).trim();
      const completed = (node.attrs?.completed as boolean) ?? false;
      const pieceId = findPieceMentionId(node);

      if (text) {
        tasks.push({ taskId, text, completed, pieceId, style: "goal" });
      }
    }

    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(doc);
  return tasks;
}
