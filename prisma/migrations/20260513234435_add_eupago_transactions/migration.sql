-- CreateTable
CREATE TABLE "eupago_transactions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "trid" TEXT NOT NULL,
    "identifier" TEXT,
    "reference" TEXT,
    "entity" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "commission" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "commissionIva" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "totalCommission" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "net" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT,
    "channelId" TEXT,
    "channelName" TEXT,
    "datePayment" TIMESTAMP(3) NOT NULL,
    "dateTransfer" TIMESTAMP(3),
    "bookingDate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'API',
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eupago_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eupago_transactions_storeId_datePayment_idx" ON "eupago_transactions"("storeId", "datePayment");

-- CreateIndex
CREATE INDEX "eupago_transactions_storeId_status_idx" ON "eupago_transactions"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "eupago_transactions_storeId_trid_key" ON "eupago_transactions"("storeId", "trid");

-- AddForeignKey
ALTER TABLE "eupago_transactions" ADD CONSTRAINT "eupago_transactions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
