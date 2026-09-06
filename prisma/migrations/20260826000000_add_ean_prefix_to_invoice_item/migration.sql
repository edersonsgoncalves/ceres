-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN "eanPrefix" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceItem_eanPrefix_idx" ON "InvoiceItem"("eanPrefix");

-- Populate eanPrefix from existing barcodes
UPDATE "InvoiceItem" SET "eanPrefix" = SUBSTRING("barcode" FROM 1 FOR 8) WHERE "barcode" IS NOT NULL AND LENGTH("barcode") >= 8;
