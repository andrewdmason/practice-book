import { buildByline } from "@/lib/journal/byline";

/**
 * A family post's byline: the author's name, plus "with comments from …" when
 * other members have commented. Matches the muted serif of the date it sits
 * beside.
 */
export function EntryByline({
  authorName,
  commenterNames,
}: {
  authorName: string;
  commenterNames: string[];
}) {
  return (
    <p className="font-serif text-sm text-muted-foreground">
      {buildByline(authorName, commenterNames)}
    </p>
  );
}
