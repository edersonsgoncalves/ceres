import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const stores = await prisma.store.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ stores });
  } catch (error) {
    console.error("Erro ao buscar estabelecimentos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, cnpj, address, city, state } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 }
      );
    }

    const store = await prisma.store.create({
      data: {
        name,
        cnpj: cnpj || null,
        address: address || null,
        city: city || null,
        state: state || null,
      },
    });

    return NextResponse.json({ store });
  } catch (error) {
    console.error("Erro ao criar estabelecimento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
