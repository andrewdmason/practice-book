/**
 * Join names into a natural-language list:
 *   []                       -> ""
 *   ["Jenny"]                -> "Jenny"
 *   ["Jenny", "Oscar"]       -> "Jenny and Oscar"
 *   ["Jenny", "Oscar", "Mae"]-> "Jenny, Oscar, and Mae"
 */
export function formatCommenters(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Build a post byline: the author's name, plus "with comments from …" when
 * other family members have commented. No trailing period, to sit cleanly
 * beside the date in both the post header and the feed.
 *
 *   buildByline("Andrew", [])                  -> "Andrew"
 *   buildByline("Andrew", ["Jenny", "Oscar"])  -> "Andrew with comments from Jenny and Oscar"
 */
export function buildByline(authorName: string, commenterNames: string[]): string {
  const list = formatCommenters(commenterNames);
  return list ? `${authorName} with comments from ${list}` : authorName;
}
