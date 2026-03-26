const isProduction = process.env.NEXT_PUBLIC_SUPABASE_ENV === "production";

export const supabaseUrl = isProduction
  ? process.env.NEXT_PUBLIC_SUPABASE_PROD_URL!
  : process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL!;

export const supabaseAnonKey = isProduction
  ? process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY!
  : process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY!;
