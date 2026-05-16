const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.findFirst();
  if (!business) { console.log('No business found'); return; }
  console.log('Business:', business.id, business.name);

  let branch = await prisma.branch.findFirst({ where: { businessId: business.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { businessId: business.id, name: 'Main Branch', isActive: true },
    });
    console.log('Branch created:', branch.id);
  } else {
    console.log('Branch exists:', branch.id);
  }

  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const fyS = m >= 4 ? y : y - 1;
  const fyE = fyS + 1;
  const fyCode = `${fyS}-${String(fyE).slice(2)}`;

  let fy = await prisma.financialYear.findFirst({ where: { businessId: business.id, isActive: true } });
  if (!fy) {
    fy = await prisma.financialYear.create({
      data: {
        businessId: business.id,
        fyCode,
        startDate: new Date(fyS, 3, 1),
        endDate: new Date(fyE, 2, 31),
        isActive: true,
      },
    });
    console.log('Financial year created:', fy.fyCode);
  } else {
    console.log('FY exists:', fy.fyCode);
  }

  let bs = await prisma.billSeries.findFirst({ where: { businessId: business.id, isActive: true } });
  if (!bs) {
    bs = await prisma.billSeries.create({
      data: {
        businessId: business.id,
        financialYearId: fy.id,
        seriesPrefix: 'GST/',
        currentNumber: 0,
        numberFormat: '0000',
        isActive: true,
      },
    });
    console.log('Bill series created:', bs.id);
  } else {
    console.log('Bill series exists:', bs.id);
  }

  console.log('Setup complete.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
