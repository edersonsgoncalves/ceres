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
    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ store });
  } catch (error) {
    console.error("Erro ao buscar estabelecimento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const { name, cnpj, address, city, state } = body;

    const existingStore = await prisma.store.findUnique({
      where: { id },
    });

    if (!existingStore) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado" },
        { status: 404 }
      );
    }

    const store = await prisma.store.update({
      where: { id },
      data: {
        name: name || existingStore.name,
        cnpj: cnpj !== undefined ? cnpj : existingStore.cnpj,
        address: address !== undefined ? address : existingStore.address,
        city: city !== undefined ? city : existingStore.city,
        state: state !== undefined ? state : existingStore.state,
      },
    });

    return NextResponse.json({ store });
  } catch (error) {
    console.error("Erro ao atualizar estabelecimento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const existingStore = await prisma.store.findUnique({
      where: { id },
    });

    if (!existingStore) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado" },
        { status: 404 }
      );
    }

    await prisma.store.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar estabelecimento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
