import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { extractInvoiceData } from "@/lib/ocr";
import { resolveProductName, computeEanPrefixFromBarcode } from "@/lib/invoice-items";

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
    })) || [],
  };
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { store: true },
    });

    return NextResponse.json({ invoices: invoices.map((inv) => serializeInvoice(inv as unknown as Record<string, unknown>)) });
  } catch (error) {
    console.error("Erro ao buscar notas fiscais:", error);
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

    const formData = await request.formData();
    const imageFiles = formData.getAll("images") as File[];

    if (!imageFiles || imageFiles.length === 0) {
      return NextResponse.json(
        { error: "Pelo menos uma imagem e obrigatoria" },
        { status: 400 }
      );
    }

    const images: string[] = [];
    for (const imageFile of imageFiles) {
      if (!imageFile.type.startsWith("image/")) continue;
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");
      images.push(`data:${imageFile.type};base64,${base64}`);
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma imagem valida encontrada" },
        { status: 400 }
      );
    }

    const invoiceData = await extractInvoiceData(images);

    const storeName = invoiceData.storeName || "Loja não informada";
    const storeCnpj = invoiceData.cnpj || null;

    let store = storeCnpj
      ? await prisma.store.findFirst({ where: { cnpj: storeCnpj } })
      : null;

    if (!store) {
      store = await prisma.store.findFirst({ where: { name: storeName } });
    }

    if (!store) {
      store = await prisma.store.create({
        data: {
          name: storeName,
          cnpj: storeCnpj,
          address: "",
          city: "",
          state: "",
        },
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
        issueDate: invoiceData.date ? new Date(invoiceData.date) : new Date(),
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

    return NextResponse.json({ invoice: serializeInvoice(fullInvoice as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error("Erro ao criar nota fiscal:", error);
    return NextResponse.json(
      { error: "Erro ao processar nota fiscal" },
      { status: 500 }
    );
  }
}
