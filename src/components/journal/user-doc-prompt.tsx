"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function UserDocPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can fail (e.g. insecure context) — leave the button as-is.
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <p className="font-serif text-sm text-foreground">
        Don&apos;t want to write this from scratch?
      </p>
      <p className="mt-1 font-serif text-xs italic text-muted-foreground">
        Copy this prompt, paste it into a chatbot like ChatGPT or Claude, and
        answer its questions. It&apos;ll write your profile — paste the result
        back here.
      </p>
      <button
        type="button"
        onClick={copyPrompt}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 font-serif text-sm text-foreground transition-colors hover:bg-muted"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy prompt
          </>
        )}
      </button>
    </div>
  );
}
