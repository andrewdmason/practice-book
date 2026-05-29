import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Dev-only: lists family members so the login page can offer a quick switcher.
// Never available against production Supabase.
export async function GET() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_PUBLIC_SUPABASE_ENV === "production"
  ) {
    return NextResponse.json({ members: [] }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("journal_members")
    .select("email, name, is_owner")
    .order("is_owner", { ascending: false })
    .order("created_at", { ascending: true });

  return NextResponse.json({ members: data ?? [] });
}
