import type { JSONContent } from "@tiptap/core";

export type ExtractedTask = {
  taskId: string;
  text: string;
  progress: number;
  pieceId: string | null;
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
 * Walk a Tiptap JSON document and extract all task items.
 */
export function extractTasks(doc: JSONContent): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];

  function walk(node: JSONContent) {
    if (node.type === "taskItem") {
      const taskId = (node.attrs?.taskId as string) || crypto.randomUUID();
      const text = getTextContent(node).trim();
      // Support both new progress attr and legacy checked boolean
      const progress =
        typeof node.attrs?.progress === "number"
          ? node.attrs.progress
          : (node.attrs?.checked as boolean)
            ? 4
            : 0;
      const pieceId = findPieceMentionId(node);

      if (text) {
        tasks.push({ taskId, text, progress, pieceId });
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
