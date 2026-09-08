import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (err) {
            // Server Components nao permitem setAll - ignorar silenciosamente
            // Route Handlers devem usar createRouteHandlerClient
            if (process.env.NODE_ENV === "development") {
              console.warn("[supabase] setAll ignorado:", err);
            }
          }
        },
      },
    }
  );
}
