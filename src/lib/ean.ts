const EAN_PREFIX_LENGTH = 8;

export function computeEanPrefix(barcode: string | null | undefined): string | null {
  if (!barcode) return null;
  const digits = barcode.replace(/\D/g, "");
  if (digits.length < EAN_PREFIX_LENGTH) return null;
  return digits.slice(0, EAN_PREFIX_LENGTH);
}

export function isValidEan(barcode: string | null | undefined): boolean {
  if (!barcode) return false;
  const digits = barcode.replace(/\D/g, "");
  return digits.length >= 12 && digits.length <= 14;
}
