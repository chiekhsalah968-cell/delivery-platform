-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending_dispatch', 'offered', 'accepted', 'en_route_pickup', 'picked_up', 'en_route_dropoff', 'delivered', 'completed', 'unassigned', 'cancelled', 'failed_delivery');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cod');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "merchantProfileId" UUID NOT NULL,
    "customerUserId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending_dispatch',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'cod',
    "pickupBusinessName" TEXT NOT NULL,
    "pickupWilayaCode" INTEGER NOT NULL,
    "pickupMunicipalityId" UUID,
    "pickupAddressLine" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "dropoffWilayaCode" INTEGER NOT NULL,
    "dropoffMunicipalityId" UUID,
    "dropoffAddressLine" TEXT NOT NULL,
    "dropoffLatitude" DOUBLE PRECISION,
    "dropoffLongitude" DOUBLE PRECISION,
    "notes" TEXT,
    "subtotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_merchantProfileId_createdAt_idx" ON "orders"("merchantProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_customerUserId_createdAt_idx" ON "orders"("customerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_status_events_orderId_createdAt_idx" ON "order_status_events"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchantProfileId_fkey" FOREIGN KEY ("merchantProfileId") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickupWilayaCode_fkey" FOREIGN KEY ("pickupWilayaCode") REFERENCES "wilayas"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickupMunicipalityId_fkey" FOREIGN KEY ("pickupMunicipalityId") REFERENCES "municipalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_dropoffWilayaCode_fkey" FOREIGN KEY ("dropoffWilayaCode") REFERENCES "wilayas"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_dropoffMunicipalityId_fkey" FOREIGN KEY ("dropoffMunicipalityId") REFERENCES "municipalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
