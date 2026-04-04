import type { JSONContent } from "@tiptap/core";

export type ExtractedAssignment = {
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

/**
 * Walk a Tiptap JSON document and extract all assignment items.
 */
export function extractAssignments(doc: JSONContent): ExtractedAssignment[] {
  const assignments: ExtractedAssignment[] = [];

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

      if (text) {
        assignments.push({ taskId, text, progress, pieceId: null });
      }
    }

    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(doc);
  return assignments;
}
