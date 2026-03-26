const env = process.env.NEXT_PUBLIC_SUPABASE_ENV;

export const supabaseUrl =
  env === "production"
    ? process.env.NEXT_PUBLIC_SUPABASE_PROD_URL!
    : env === "local"
      ? process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL!
      : process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const supabaseAnonKey =
  env === "production"
    ? process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY!
    : env === "local"
      ? process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY!
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
