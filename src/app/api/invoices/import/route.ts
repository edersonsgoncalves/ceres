import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { resolveProductName, computeEanPrefixFromBarcode } from "@/lib/invoice-items";
import type { InvoiceImportPayload } from "@/types/invoice";

function serializeInvoice(invoice: Record<string, unknown>) {
  const store = invoice.store as Record<string, unknown> | undefined;
  return {
    id: invoice.id,
    storeName: store?.name || "Desconhecido",
    storeId: invoice.storeId,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.issueDate,
    total: Number(invoice.totalAmount),
    totalItemsCount: invoice.totalItemsCount,
    createdAt: invoice.createdAt,
  };
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

    const body: InvoiceImportPayload = await request.json();

    const errors: string[] = [];
    if (!body.store?.name) errors.push("store.name e obrigatorio");
    if (!body.issueDate) errors.push("issueDate e obrigatorio");
    if (body.totalAmount === undefined || body.totalAmount === null) errors.push("totalAmount e obrigatorio");
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) errors.push("items deve ser um array nao vazio");

    for (let i = 0; i < (body.items?.length ?? 0); i++) {
      const item = body.items[i];
      if (!item.productName) errors.push(`items[${i}].productName e obrigatorio`);
      if (!item.quantity || item.quantity <= 0) errors.push(`items[${i}].quantity deve ser > 0`);
      if (!item.unitPrice || item.unitPrice <= 0) errors.push(`items[${i}].unitPrice deve ser > 0`);
      if (!item.unit) errors.push(`items[${i}].unit e obrigatorio`);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Dados invalidos", details: errors }, { status: 400 });
    }

    const storeName = body.store.name;
    const storeCnpj = body.store.cnpj || null;

    let store = storeCnpj
      ? await prisma.store.findFirst({ where: { cnpj: storeCnpj } })
      : null;
    if (!store) store = await prisma.store.findFirst({ where: { name: storeName } });
    if (!store) {
      store = await prisma.store.create({
        data: { name: storeName, cnpj: storeCnpj, address: "", city: "", state: "" },
      });
    }

    const issueDate = new Date(body.issueDate);
    const dayStart = new Date(issueDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(issueDate); dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.invoice.findFirst({
      where: {
        userId: user.id,
        storeId: store.id,
        totalAmount: body.totalAmount,
        issueDate: { gte: dayStart, lte: dayEnd },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Nota fiscal ja cadastrada", existingId: existing.id },
        { status: 409 }
      );
    }

    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        storeId: store.id,
        invoiceNumber: body.invoiceNumber || `NF-${Date.now()}`,
        issueDate,
        totalAmount: body.totalAmount,
        totalItemsCount: body.items.length,
      },
    });

    for (const item of body.items) {
      const eanPrefix = computeEanPrefixFromBarcode(item.barcode);
      const productName = await resolveProductName(eanPrefix, item.productName);
      const totalPrice = item.totalPrice ?? item.quantity * item.unitPrice;

      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          productName,
          name: item.productName,
          barcode: item.barcode || null,
          eanPrefix,
          category: item.category || null,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice,
        },
      });
    }

    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { store: true },
    });

    return NextResponse.json({
      invoice: serializeInvoice(fullInvoice as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Erro ao importar nota fiscal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao importar nota fiscal" },
      { status: 500 }
    );
  }
}
