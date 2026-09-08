import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });

    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    for (const cookie of cookieStore.getAll()) {
      response.cookies.set(cookie.name, cookie.value, cookie.options as any);
    }

    return response;
  } catch (error) {
    console.error("Erro no logout:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
