import { prisma } from "@/lib/prisma";
import { computeEanPrefix } from "@/lib/ean";

export async function resolveProductName(
  eanPrefix: string | null,
  suggestedName: string
): Promise<string> {
  if (!eanPrefix) return suggestedName;

  const existing = await prisma.invoiceItem.findFirst({
    where: { eanPrefix },
    select: { productName: true },
    orderBy: { id: "asc" },
  });

  return existing?.productName ?? suggestedName;
}

export function computeEanPrefixFromBarcode(
  barcode: string | null | undefined
): string | null {
  return computeEanPrefix(barcode);
}
