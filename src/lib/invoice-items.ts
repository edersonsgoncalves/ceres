import { computeEanPrefix } from "@/lib/ean";

export function resolveProductName(suggestedName: string): string {
  return suggestedName;
}

export function computeEanPrefixFromBarcode(
  barcode: string | null | undefined
): string | null {
  return computeEanPrefix(barcode);
}
