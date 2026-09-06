import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user as Record<string, unknown>).role || "user",
    });
  } catch (error) {
    console.error("Erro ao buscar usuario:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
