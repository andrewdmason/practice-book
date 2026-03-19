import type { JSONContent } from "@tiptap/core";

export type ExtractedGoal = {
  goalId: string;
  text: string;
  completed: boolean;
  pieceId: string | null;
};

function getTextContent(node: JSONContent): string {
  if (node.text) return node.text;
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
 * Walk a Tiptap JSON document and extract all goal blocks.
 * If a goal contains a piece mention, links it to that piece.
 */
export function extractGoals(doc: JSONContent): ExtractedGoal[] {
  const goals: ExtractedGoal[] = [];

  function walk(node: JSONContent) {
    if (node.type === "goalBlock") {
      const goalId = (node.attrs?.goalId as string) || crypto.randomUUID();
      const text = getTextContent(node).trim();
      const completed = (node.attrs?.completed as boolean) ?? false;
      const pieceId = findPieceMentionId(node);

      if (text) {
        goals.push({ goalId, text, completed, pieceId });
      }
    }

    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(doc);
  return goals;
}
