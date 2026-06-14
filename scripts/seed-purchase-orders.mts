import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

// Excel date serial → JS Date
function excelDate(serial: number): Date {
  return new Date((serial - 25569) * 86400 * 1000);
}

async function main() {
  const store = await p.store.findFirst();
  if (!store) throw new Error("No store found");

  // Clear existing purchase orders for this store
  await p.purchaseOrder.deleteMany({ where: { storeId: store.id } });
  console.log("Cleared existing purchase orders");

  const orders = [
    {
      orderNumber: 1,
      date: excelDate(45645),
      supplier: "Zhejiang Fele / betopmax / threebo / seawavelabels",
      totalCost: 2518.38,
      notes: "Primeira encomenda — vários fornecedores",
      items: [
        { productName: "Mini Shin Pad", quantity: 200, productionCost: 200, transportCost: 65, totalCost: 265, unitCost: 1.325, note: "threebo" },
        { productName: "Sleeve Shin Pad", quantity: 250, productionCost: 625, transportCost: 80, totalCost: 705, unitCost: 2.82, note: "Zhejiang Fele" },
        { productName: "Saco Shin Pad", quantity: 500, productionCost: 120, transportCost: 40, totalCost: 160, unitCost: 0.32, note: "Zhejiang Fele" },
        { productName: "Breathable Shin Pad", quantity: 100, productionCost: 100, transportCost: 35, totalCost: 135, unitCost: 1.35, note: "Zhejiang Fele" },
        { productName: "Grip Socks", quantity: 500, productionCost: 690, transportCost: 220, totalCost: 910, unitCost: 1.82, note: "betopmax" },
        { productName: "Bubble Mailers", quantity: 500, productionCost: 138, transportCost: 205, totalCost: 343, unitCost: 0.686, note: "seawavelabels" },
        { productName: "Shipping DDP by Train", quantity: null, productionCost: null, transportCost: 538.20, totalCost: 538.20, unitCost: null, note: "szfly56" },
      ],
    },
    {
      orderNumber: 2,
      date: excelDate(45922),
      supplier: "threebo",
      totalCost: 305,
      notes: "Shin Pads Midi / Airflow",
      items: [
        { productName: "Shin Pads Midi (Airflow)", quantity: 200, productionCost: 190, transportCost: 115, totalCost: 305, unitCost: 1.525, note: "threebo" },
      ],
    },
    {
      orderNumber: 3,
      date: excelDate(45995),
      supplier: "Zhejiang Fele Sports Co., Ltd.",
      totalCost: 2980.35,
      notes: "1050 Sleeve Shin Pad W/Bag — S:400 M:350 L:250 XL:50",
      items: [
        { productName: "Sleeve Shin Pad W/Bag", quantity: 1050, productionCost: 2350.54, transportCost: 629.81, totalCost: 2980.35, unitCost: 2.838, note: "S:400 M:350 L:250 XL:50" },
      ],
    },
    {
      orderNumber: 4,
      date: excelDate(45995),
      supplier: "betopmax",
      totalCost: 1809.43,
      notes: "1900 Grip Socks + 150 Sock Sleeves",
      items: [
        { productName: "Grip Socks + Sock Sleeves", quantity: 2050, productionCost: 1210.62, transportCost: 598.81, totalCost: 1809.43, unitCost: 0.8826, note: "Grip Socks Adulto+Criança + Sock Sleeve Adulto+Criança" },
      ],
    },
  ];

  for (const order of orders) {
    const created = await p.purchaseOrder.create({
      data: {
        storeId: store.id,
        orderNumber: order.orderNumber,
        date: order.date,
        supplier: order.supplier,
        totalCost: order.totalCost,
        notes: order.notes,
        items: {
          create: order.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            productionCost: item.productionCost,
            transportCost: item.transportCost,
            totalCost: item.totalCost,
            unitCost: item.unitCost,
            note: item.note,
          })),
        },
      },
    });
    console.log(`✓ Encomenda ${order.orderNumber} criada (${created.id})`);
  }

  await p.$disconnect();
  console.log("\nTotal gasto em encomendas: €" + orders.reduce((s, o) => s + o.totalCost, 0).toFixed(2));
}

main().catch((e) => { console.error(e); process.exit(1); });
