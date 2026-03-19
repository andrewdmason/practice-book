import type { JSONContent } from "@tiptap/core";

export type ExtractedMention = {
  pieceId: string;
  contextSnippet: string;
};

function getTextContent(node: JSONContent): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(getTextContent).join("");
}

/**
 * Walk a Tiptap JSON document and extract all piece mentions.
 * Returns piece IDs with their surrounding paragraph text as context.
 */
export function extractMentions(doc: JSONContent): ExtractedMention[] {
  const mentions: ExtractedMention[] = [];

  function walkBlock(block: JSONContent) {
    if (!block.content) return;

    // Get the paragraph-level text as context
    const blockText = getTextContent(block).slice(0, 150);

    for (const child of block.content) {
      if (child.type === "pieceMention" && child.attrs?.id) {
        mentions.push({
          pieceId: child.attrs.id as string,
          contextSnippet: blockText,
        });
      }
      // Recurse into nested content (e.g. list items)
      if (child.content) {
        walkBlock(child);
      }
    }
  }

  if (doc.content) {
    for (const block of doc.content) {
      walkBlock(block);
    }
  }

  // Deduplicate by pieceId (keep first occurrence with context)
  const seen = new Set<string>();
  return mentions.filter((m) => {
    if (seen.has(m.pieceId)) return false;
    seen.add(m.pieceId);
    return true;
  });
}
