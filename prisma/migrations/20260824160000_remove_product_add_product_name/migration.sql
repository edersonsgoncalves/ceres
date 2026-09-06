-- AlterTable: Add productName column (nullable first)
ALTER TABLE "InvoiceItem" ADD COLUMN "productName" TEXT;

-- Update existing rows: use name or product name
UPDATE "InvoiceItem" SET "productName" = COALESCE("name", 'Sem nome');

-- AlterTable: Make productName required
ALTER TABLE "InvoiceItem" ALTER COLUMN "productName" SET NOT NULL;

-- CreateIndex
CREATE INDEX "InvoiceItem_productName_idx" ON "InvoiceItem"("productName");

-- DropForeignKey
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropTable
DROP TABLE "Product";

-- AlterTable: Remove productId column
ALTER TABLE "InvoiceItem" DROP COLUMN "productId";
