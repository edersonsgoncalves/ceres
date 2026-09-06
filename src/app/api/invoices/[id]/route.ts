import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

function serializeInvoice(invoice: Record<string, unknown>) {
  const store = invoice.store as Record<string, unknown> | undefined;
  const items = invoice.items as Array<Record<string, unknown>> | undefined;
  return {
    id: invoice.id,
    storeName: store?.name || "Desconhecido",
    storeId: invoice.storeId,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.issueDate,
    total: Number(invoice.totalAmount),
    totalItemsCount: invoice.totalItemsCount,
    rawImageUrl: invoice.rawImageUrl,
    createdAt: invoice.createdAt,
    items: items?.map((item) => ({
      id: item.id,
      name: item.name,
      productName: item.productName,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      barcode: item.barcode,
      category: item.category,
    })) || [],
  };
}

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
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, store: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Nota fiscal não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ invoice: serializeInvoice(invoice as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error("Erro ao buscar nota fiscal:", error);
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
    const { items, totalAmount } = body;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Nota fiscal não encontrada" },
        { status: 404 }
      );
    }

    if (items && Array.isArray(items)) {
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      for (const item of items) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: id,
            productName: item.productName || item.name || "Sem nome",
            name: item.name,
            barcode: item.barcode || null,
            category: item.category || null,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        totalAmount: totalAmount || existingInvoice.totalAmount,
        totalItemsCount: items ? items.length : existingInvoice.totalItemsCount,
      },
      include: { items: true, store: true },
    });

    return NextResponse.json({ invoice: serializeInvoice(invoice as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error("Erro ao atualizar nota fiscal:", error);
    return NextResponse.json(
      { error: "Erro ao processar nota fiscal" },
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
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Nota fiscal não encontrada" },
        { status: 404 }
      );
    }

    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: id },
    });

    await prisma.invoice.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar nota fiscal:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
