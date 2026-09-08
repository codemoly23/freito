import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";

export function calculateAmounts(input: {
  quantity: number | string | Prisma.Decimal;
  buyRate: number | string | Prisma.Decimal;
  sellRate: number | string | Prisma.Decimal;
  exchangeRateToBDT: number | string | Prisma.Decimal;
}) {
  const quantity = new Prisma.Decimal(input.quantity);
  const buyRate = new Prisma.Decimal(input.buyRate);
  const sellRate = new Prisma.Decimal(input.sellRate);
  const exchangeRate = new Prisma.Decimal(input.exchangeRateToBDT);
  const buyAmount = quantity.mul(buyRate).mul(exchangeRate).toDecimalPlaces(2);
  const sellAmount = quantity.mul(sellRate).mul(exchangeRate).toDecimalPlaces(2);
  const profitAmount = sellAmount.sub(buyAmount).toDecimalPlaces(2);

  return { buyAmount, sellAmount, profitAmount };
}

export function marginPercent(totalSell: Prisma.Decimal, grossProfit: Prisma.Decimal) {
  if (totalSell.isZero()) return new Prisma.Decimal(0);
  return grossProfit.div(totalSell).mul(100).toDecimalPlaces(2);
}

export async function recalculateQuotationTotals(
  tx: Prisma.TransactionClient,
  quotationId: string,
) {
  const charges = await tx.quotationcharge.findMany({
    where: { quotationId, deletedAt: null },
    select: { buyAmount: true, sellAmount: true, profitAmount: true },
  });
  const totalBuyAmount = charges.reduce(
    (total, charge) => total.add(charge.buyAmount),
    new Prisma.Decimal(0),
  );
  const totalSellAmount = charges.reduce(
    (total, charge) => total.add(charge.sellAmount),
    new Prisma.Decimal(0),
  );
  const grossProfit = charges.reduce(
    (total, charge) => total.add(charge.profitAmount),
    new Prisma.Decimal(0),
  );
  const profitMarginPercent = marginPercent(totalSellAmount, grossProfit);

  return tx.quotation.update({
    where: { id: quotationId },
    data: {
      totalBuyAmount,
      totalSellAmount,
      grossProfit,
      profitMarginPercent,
      updatedAt: new Date(),
    },
  });
}

export async function recalculateShipmentCostTotals(
  tx: Prisma.TransactionClient,
  shipmentJobId: string,
) {
  const items = await tx.shipmentcostitem.findMany({
    where: { shipmentJobId, deletedAt: null },
    select: { buyAmount: true, sellAmount: true, profitAmount: true },
  });
  const totalBuyAmount = items.reduce(
    (total, item) => total.add(item.buyAmount),
    new Prisma.Decimal(0),
  );
  const totalSellAmount = items.reduce(
    (total, item) => total.add(item.sellAmount),
    new Prisma.Decimal(0),
  );
  const grossProfit = items.reduce(
    (total, item) => total.add(item.profitAmount),
    new Prisma.Decimal(0),
  );
  const profitMarginPercent = marginPercent(totalSellAmount, grossProfit);

  return tx.shipmentjob.update({
    where: { id: shipmentJobId },
    data: {
      totalBuyAmount,
      totalSellAmount,
      grossProfit,
      profitMarginPercent,
      updatedAt: new Date(),
    },
  });
}

export async function copyQuotationChargesToShipmentJob(
  tx: Prisma.TransactionClient,
  quotationId: string,
  shipmentJobId: string,
  createdById: string,
) {
  const quotationCharges = await tx.quotationcharge.findMany({
    where: { quotationId, deletedAt: null },
  });

  if (!quotationCharges.length) return 0;

  const shipment = await tx.shipmentjob.findUnique({
    where: { id: shipmentJobId },
    select: { companyId: true, customerId: true },
  });
  if (!shipment) return 0;

  let addedCount = 0;
  for (const charge of quotationCharges) {
    const existing = await tx.shipmentcostitem.findFirst({
      where: {
        shipmentJobId,
        sourceQuotationId: quotationId,
        chargeName: charge.chargeName,
        deletedAt: null,
      },
    });

    if (!existing) {
      await tx.shipmentcostitem.create({
        data: {
          id: randomUUID(),
          companyId: shipment.companyId,
          shipmentJobId,
          chargeName: charge.chargeName,
          chargeType: charge.chargeType,
          chargeBasis: charge.chargeBasis,
          currency: charge.currency,
          quantity: charge.quantity,
          buyRate: charge.buyRate,
          sellRate: charge.sellRate,
          exchangeRateToBDT: charge.exchangeRateToBDT,
          buyAmount: charge.buyAmount,
          sellAmount: charge.sellAmount,
          profitAmount: charge.profitAmount,
          vendorId: charge.vendorId,
          customerId: shipment.customerId,
          sourceQuotationId: quotationId,
          remarks: charge.remarks,
          createdById,
          updatedAt: new Date(),
        },
      });
      addedCount++;
    }
  }

  if (addedCount > 0) {
    await recalculateShipmentCostTotals(tx, shipmentJobId);
  }

  return addedCount;
}
