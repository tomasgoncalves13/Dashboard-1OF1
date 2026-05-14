-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "chargesGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "chargesFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundsGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundsFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustmentsGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustmentsFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payouts_storeId_issuedAt_idx" ON "payouts"("storeId", "issuedAt");

-- CreateIndex
CREATE INDEX "payouts_storeId_status_idx" ON "payouts"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_storeId_shopifyId_key" ON "payouts"("storeId", "shopifyId");

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
