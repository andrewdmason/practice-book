"use server";

import { createClient } from "@/lib/supabase/server";
import type { SearchResult, TypeaheadResult } from "@/lib/types";

/**
 * Fast typeahead search for pieces and works by name/composer.
 * Called on each keystroke (debounced client-side).
 */
export async function searchTypeahead(
  query: string
): Promise<TypeaheadResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = await createClient();
  const pattern = `%${query}%`;

  const [{ data: pieces }, { data: works }] = await Promise.all([
    supabase
      .from("pieces")
      .select("id, name, composer")
      .or(`name.ilike.${pattern},composer.ilike.${pattern}`)
      .order("name")
      .limit(6),
    supabase
      .from("works")
      .select("id, name, composer")
      .or(`name.ilike.${pattern},composer.ilike.${pattern}`)
      .order("name")
      .limit(3),
  ]);

  const results: TypeaheadResult[] = [];

  if (pieces) {
    for (const p of pieces) {
      results.push({
        id: p.id,
        name: p.name,
        composer: p.composer,
        type: "piece",
        url: `/practice/repertoire/${p.id}`,
      });
    }
  }

  if (works) {
    for (const w of works) {
      results.push({
        id: w.id,
        name: w.name,
        composer: w.composer,
        type: "work",
        url: `/practice/repertoire/works/${w.id}`,
      });
    }
  }

  return results;
}

/**
 * Full-text search across all content types via the search_all RPC.
 * Triggered on Enter or after a debounce pause.
 */
export async function searchAll(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_all", {
    query_text: query,
    result_limit: 20,
  });

  if (error) {
    console.error("search_all error:", error);
    return [];
  }

  return (data as SearchResult[]) ?? [];
}
