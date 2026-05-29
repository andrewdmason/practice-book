import { anthropic, JOURNAL_MODEL } from "@/lib/journal/anthropic";

const SUMMARY_TOOL = {
  name: "write_recap_summary",
  description:
    "Write the one-sentence subtitle for a monthly chatbot recap. The recap is a " +
    "list of the threads and topics someone explored with their AI chatbot over a " +
    "month. The subtitle sits under the recap's title in a journal feed.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description:
          "A SINGLE short sentence, 10–18 words MAX — it has to fit on two lines " +
          "in a narrow column. Name just two or three of the biggest threads, then " +
          "stop; don't try to list everything. Be concrete. Don't start with 'This " +
          "recap' or 'A summary of'. Plain, warm, no lists, no markdown.",
      },
    },
    required: ["summary"],
  },
};

/**
 * Produce a one-sentence subtitle summarizing a recap's body, for the journal
 * feed. Resilient by design: any failure (missing key, rate limit, malformed
 * tool call) is logged and returns null so the recap still saves — the summary
 * is a nice-to-have, not a gate on capturing the content.
 */
export async function summarizeRecap(body: string): Promise<string | null> {
  const trimmed = body.trim();
  if (!trimmed) return null;

  try {
    const client = anthropic();
    const message = await client.messages.create({
      model: JOURNAL_MODEL,
      max_tokens: 256,
      system:
        "You summarize monthly recaps of someone's conversations with their AI " +
        "chatbot into a single subtitle sentence. Call write_recap_summary exactly once.",
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "tool", name: SUMMARY_TOOL.name },
      messages: [{ role: "user", content: trimmed }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    const input = toolUse.input as { summary?: unknown };
    const summary = typeof input.summary === "string" ? input.summary.trim() : "";
    return summary.length > 0 ? summary : null;
  } catch (err) {
    console.error(
      "[journal/recap-summary] Anthropic call failed:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
