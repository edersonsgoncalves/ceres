import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const items = await prisma.invoiceItem.findMany({
      where: { invoiceId: id },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erro ao buscar itens:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, quantity, unit, unitPrice, totalPrice } = body;

    if (!name || !quantity || !unitPrice) {
      return NextResponse.json(
        { error: "Nome, quantidade e preço são obrigatórios" },
        { status: 400 }
      );
    }

    const item = await prisma.invoiceItem.create({
      data: {
        invoiceId: id,
        name,
        productName: name,
        quantity: quantity || 1,
        unit: unit || "un",
        unitPrice,
        totalPrice: totalPrice || unitPrice * (quantity || 1),
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Erro ao criar item:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
