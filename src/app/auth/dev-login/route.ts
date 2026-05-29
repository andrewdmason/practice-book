import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProvisioned } from "@/lib/journal/provisioning";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_ENV === "production") {
    return NextResponse.json(
      { error: "Dev login is not available when using production Supabase. Use the normal login flow." },
      { status: 403 }
    );
  }

  // Sign in as any family member for local testing. Defaults to the owner.
  const { searchParams } = new URL(request.url);
  const ownerEmail = process.env.AUTHORIZED_EMAIL;
  const email = (searchParams.get("email") ?? ownerEmail)?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json(
      { error: "No email given and AUTHORIZED_EMAIL not set" },
      { status: 500 }
    );
  }

  // Use admin client to create/get user and generate a link
  const admin = createAdminClient();

  // Ensure user exists
  const { data: users } = await admin.auth.admin.listUsers();
  let userId: string | undefined;

  const existingUser = users?.users?.find((u) => u.email === email);
  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    userId = newUser.user.id;
  }

  // Dev convenience: make sure this email is on the family allowlist so you can
  // sign in as the owner or as a kid to test provisioning + per-user isolation.
  // (In production the owner adds members explicitly.)
  await admin
    .from("journal_members")
    .upsert(
      { email, user_id: userId, is_owner: email === ownerEmail?.toLowerCase().trim() },
      { onConflict: "email" }
    );

  // Generate a magic link
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData) {
    return NextResponse.json(
      { error: linkError?.message ?? "Failed to generate link" },
      { status: 500 }
    );
  }

  // Extract the token hash and use it to verify OTP
  const tokenHash = linkData.properties.hashed_token;
  const { origin } = new URL(request.url);

  // Create a server client and verify the OTP to establish the session
  const cookieStore = await cookies();
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                // Long-lived cookies for dev
                maxAge: 365 * 24 * 60 * 60,
              })
            );
          } catch {
            // Ignored
          }
        },
      },
    }
  );

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyError) {
    return NextResponse.json(
      { error: verifyError.message },
      { status: 500 }
    );
  }

  // Seed this member's journal on first dev-login (idempotent thereafter).
  await ensureProvisioned({ id: userId, email });

  return NextResponse.redirect(origin);
}
