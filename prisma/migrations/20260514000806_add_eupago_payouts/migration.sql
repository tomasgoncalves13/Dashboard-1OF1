-- CreateTable
CREATE TABLE "eupago_payouts" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "commission" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "iban" TEXT,
    "fileRef" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'CSV',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eupago_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eupago_payouts_storeId_paymentDate_idx" ON "eupago_payouts"("storeId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "eupago_payouts_storeId_fileRef_key" ON "eupago_payouts"("storeId", "fileRef");

-- AddForeignKey
ALTER TABLE "eupago_payouts" ADD CONSTRAINT "eupago_payouts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
