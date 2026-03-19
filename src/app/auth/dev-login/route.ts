import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Local Supabase well-known service role key (never used in production)
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const email = process.env.AUTHORIZED_EMAIL;
  if (!email) {
    return NextResponse.json(
      { error: "AUTHORIZED_EMAIL not set" },
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Use admin client to create/get user and generate a link
  const admin = createClient(supabaseUrl, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  return NextResponse.redirect(origin);
}
