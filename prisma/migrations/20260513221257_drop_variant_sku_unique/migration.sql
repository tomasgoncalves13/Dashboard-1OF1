-- DropIndex
DROP INDEX "product_variants_storeId_sku_key";

-- CreateIndex
CREATE INDEX "product_variants_storeId_sku_idx" ON "product_variants"("storeId", "sku");
