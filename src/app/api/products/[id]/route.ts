import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { computeEanPrefix } from "@/lib/ean";

function normalizeProductName(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeProductName(a);
  const normB = normalizeProductName(b);
  if (normA === normB) return 1;
  const wordsA = new Set(normA.split(" "));
  const wordsB = new Set(normB.split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const allProductNames = await prisma.invoiceItem.findMany({
      where: { invoice: { userId: user.id } },
      select: { productName: true },
      distinct: ["productName"],
    });

    const productNames = allProductNames.map((p) => p.productName);
    const targetName = productNames.find((name) => {
      const normalized = normalizeProductName(name);
      return normalized === id || name === id;
    });

    if (!targetName) {
      const byId = await prisma.invoiceItem.findFirst({
        where: { id, invoice: { userId: user.id } },
        select: { productName: true },
      });
      if (byId) {
        const items = await prisma.invoiceItem.findMany({
          where: { productName: byId.productName, invoice: { userId: user.id } },
          include: { invoice: { select: { store: true, issueDate: true } } },
          orderBy: { invoice: { issueDate: "desc" } },
        });

        return buildProductResponse(byId.productName, items);
      }

      return NextResponse.json({ error: "Produto nao encontrado" }, { status: 404 });
    }

    const items = await prisma.invoiceItem.findMany({
      where: { productName: targetName, invoice: { userId: user.id } },
      include: { invoice: { select: { store: true, issueDate: true } } },
      orderBy: { invoice: { issueDate: "desc" } },
    });

    return buildProductResponse(targetName, items);
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

function buildProductResponse(productName: string, items: Array<{
  id: string;
  name: string | null;
  barcode: string | null;
  category: string | null;
  quantity: unknown;
  unit: string;
  unitPrice: unknown;
  totalPrice: unknown;
  invoice: { store: { name: string }; issueDate: Date };
}>) {
  const purchases = items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
    date: item.invoice.issueDate,
    store: { name: (item.invoice.store as { name: string }).name },
  }));

  const prices = purchases.map((p) => p.unitPrice);
  const stats = {
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    totalPurchases: purchases.length,
    totalSpent: purchases.reduce((sum, p) => sum + p.totalPrice, 0),
  };

  return NextResponse.json({
    product: {
      name: productName,
      category: items[0]?.category || null,
      barcode: items[0]?.barcode || null,
    },
    purchases,
    stats,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { productName, category, barcode } = body;

    await prisma.invoiceItem.updateMany({
      where: { productName: id, invoice: { userId: user.id } },
      data: {
        productName: productName || id,
        category: category !== undefined ? category : undefined,
        barcode: barcode !== undefined ? barcode : undefined,
        eanPrefix: barcode !== undefined ? computeEanPrefix(barcode) : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
