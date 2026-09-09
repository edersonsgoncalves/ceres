import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { resolveProductName, computeEanPrefixFromBarcode } from "@/lib/invoice-items";

interface ClientInvoiceData {
  storeName: string;
  cnpj?: string;
  date?: string;
  total: number;
  paymentMethod?: string;
  items: Array<{
    productName: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    barcode?: string;
    category?: string;
  }>;
}

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
    rawImageUrl: invoice.rawImageUrl,
    createdAt: invoice.createdAt,
    items: (invoice.items as Array<Record<string, unknown>> | undefined)?.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      barcode: item.barcode,
    })) || [],
  };
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

    const body = await request.json();
    const { invoiceData } = body as { invoiceData: ClientInvoiceData };

    if (!invoiceData) {
      return NextResponse.json({ error: "Dados da nota fiscal sao obrigatorios" }, { status: 400 });
    }

    if (!invoiceData.items || invoiceData.items.length === 0) {
      return NextResponse.json({ error: "Nenhum item encontrado na nota fiscal" }, { status: 400 });
    }

    console.log("[QR-Client] Dados recebidos:", JSON.stringify({
      store: invoiceData.storeName,
      items: invoiceData.items.length,
      total: invoiceData.total,
    }));

    const storeName = invoiceData.storeName || "Loja nao informada";
    const storeCnpj = invoiceData.cnpj || null;

    let store = storeCnpj
      ? await prisma.store.findFirst({ where: { cnpj: storeCnpj } })
      : null;
    if (!store) store = await prisma.store.findFirst({ where: { name: storeName } });
    if (!store) {
      store = await prisma.store.create({
        data: { name: storeName, cnpj: storeCnpj, address: "", city: "", state: "" },
      });
    }

    const calculatedTotal = invoiceData.total || invoiceData.items.reduce((sum, item) => sum + item.totalPrice, 0);

    const issueDate = invoiceData.date ? new Date(invoiceData.date) : new Date();
    const dayStart = new Date(issueDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(issueDate); dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.invoice.findFirst({
      where: {
        userId: user.id,
        storeId: store.id,
        totalAmount: calculatedTotal,
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
        invoiceNumber: `NF-${Date.now()}`,
        issueDate: issueDate,
        totalAmount: calculatedTotal,
        totalItemsCount: invoiceData.items.length,
      },
    });

    for (const item of invoiceData.items) {
      const eanPrefix = computeEanPrefixFromBarcode(item.barcode);
      const productName = await resolveProductName(eanPrefix, item.name);

      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          productName,
          name: item.name,
          barcode: item.barcode || null,
          eanPrefix,
          category: item.category || null,
          quantity: item.quantity,
          unit: item.unit || "un",
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        },
      });
    }

    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true, store: true },
    });

    return NextResponse.json({
      invoice: serializeInvoice(fullInvoice as unknown as Record<string, unknown>),
      source: "qr_code_client",
    });
  } catch (error) {
    console.error("Erro ao processar nota fiscal (client):", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao processar nota fiscal" },
      { status: 500 }
    );
  }
}
