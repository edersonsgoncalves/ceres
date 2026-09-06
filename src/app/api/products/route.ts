import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

interface ProductGroup {
  productName: string;
  maxPrice: number;
  minPrice: number;
  lastPurchase: Date;
  lastStore: string;
  totalQuantity: number;
  purchaseCount: number;
  category: string | null;
  barcode: string | null;
}

interface EanGroup {
  eanPrefix: string;
  groupName: string;
  products: ProductGroup[];
  stats: {
    totalPurchases: number;
    avgPrice: number;
    totalSpent: number;
  };
}

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const recent = searchParams.get("recent") === "true";
    const groupByEan = searchParams.get("groupBy") === "ean";

    const items = await prisma.invoiceItem.findMany({
      where: {
        invoice: { userId: user.id },
        ...(search ? { productName: { contains: search, mode: "insensitive" as const } } : {}),
      },
      include: {
        invoice: {
          select: { store: true, issueDate: true },
        },
      },
      orderBy: { invoice: { issueDate: "desc" } },
    });

    type ItemWithEan = (typeof items)[number] & { eanPrefix: string | null };

    if (groupByEan) {
      const eanGroups = buildEanGroups(items);
      const sliced = eanGroups.slice(0, recent ? 20 : 50);
      return NextResponse.json({ groups: sliced });
    }

    const groupedProducts = new Map<string, ProductGroup>();

    for (const item of items) {
      const key = item.productName;
      const price = Number(item.unitPrice);
      const quantity = Number(item.quantity);
      const storeName = (item.invoice.store as { name: string }).name;

      const existing = groupedProducts.get(key);
      if (existing) {
        existing.maxPrice = Math.max(existing.maxPrice, price);
        existing.minPrice = Math.min(existing.minPrice, price);
        existing.totalQuantity += quantity;
        existing.purchaseCount++;
        if (item.invoice.issueDate > existing.lastPurchase) {
          existing.lastPurchase = item.invoice.issueDate;
          existing.lastStore = storeName;
        }
        if (!existing.category && item.category) existing.category = item.category;
        if (!existing.barcode && item.barcode) existing.barcode = item.barcode;
      } else {
        groupedProducts.set(key, {
          productName: key,
          maxPrice: price,
          minPrice: price,
          lastPurchase: item.invoice.issueDate,
          lastStore: storeName,
          totalQuantity: quantity,
          purchaseCount: 1,
          category: item.category,
          barcode: item.barcode,
        });
      }
    }

    const products = Array.from(groupedProducts.values())
      .sort((a, b) => b.lastPurchase.getTime() - a.lastPurchase.getTime())
      .slice(0, recent ? 20 : 50);

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEanGroups(items: any[]): EanGroup[] {
  const eanMap = new Map<string, Map<string, ProductGroup>>();

  for (const item of items) {
    const eanPrefix = item.eanPrefix;
    const productKey = item.productName;
    const price = Number(item.unitPrice);
    const quantity = Number(item.quantity);
    const storeName = (item.invoice.store as { name: string }).name;

    const prefix = eanPrefix || `_no_ean_${productKey}`;
    if (!eanMap.has(prefix)) {
      eanMap.set(prefix, new Map());
    }
    const products = eanMap.get(prefix)!;

    const existing = products.get(productKey);
    if (existing) {
      existing.maxPrice = Math.max(existing.maxPrice, price);
      existing.minPrice = Math.min(existing.minPrice, price);
      existing.totalQuantity += quantity;
      existing.purchaseCount++;
      if (item.invoice.issueDate > existing.lastPurchase) {
        existing.lastPurchase = item.invoice.issueDate;
        existing.lastStore = storeName;
      }
      if (!existing.category && item.category) existing.category = item.category;
      if (!existing.barcode && item.barcode) existing.barcode = item.barcode;
    } else {
      products.set(productKey, {
        productName: productKey,
        maxPrice: price,
        minPrice: price,
        lastPurchase: item.invoice.issueDate,
        lastStore: storeName,
        totalQuantity: quantity,
        purchaseCount: 1,
        category: item.category,
        barcode: item.barcode,
      });
    }
  }

  const groups: EanGroup[] = [];
  for (const [prefix, products] of eanMap) {
    const productArray = Array.from(products.values());
    const isNoEan = prefix.startsWith("_no_ean_");

    const totalPurchases = productArray.reduce((sum, p) => sum + p.purchaseCount, 0);
    const allPrices = productArray.flatMap((p) => {
      const count = p.purchaseCount;
      const avg = (p.maxPrice + p.minPrice) / 2;
      return Array(count).fill(avg);
    });
    const avgPrice = allPrices.length > 0
      ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length
      : 0;
    const totalSpent = productArray.reduce((sum, p) => sum + p.totalQuantity * ((p.maxPrice + p.minPrice) / 2), 0);

    groups.push({
      eanPrefix: isNoEan ? "" : prefix,
      groupName: isNoEan
        ? productArray[0]?.productName ?? ""
        : deriveGroupName(productArray.map((p) => p.productName)),
      products: productArray.sort((a, b) => b.lastPurchase.getTime() - a.lastPurchase.getTime()),
      stats: { totalPurchases, avgPrice, totalSpent },
    });
  }

  return groups.sort((a, b) => {
    const aLatest = a.products[0]?.lastPurchase?.getTime() ?? 0;
    const bLatest = b.products[0]?.lastPurchase?.getTime() ?? 0;
    return bLatest - aLatest;
  });
}

function deriveGroupName(names: string[]): string {
  if (names.length === 1) return names[0];
  const normalized = names.map((n) =>
    n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  );
  const words = normalized[0].split(/\s+/);
  let prefix = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = prefix ? `${prefix} ${words[i]}` : words[i];
    if (normalized.every((n) => n.startsWith(candidate))) {
      prefix = candidate;
    } else {
      break;
    }
  }
  return prefix || names[0];
}
