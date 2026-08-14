import { PrismaClient } from "@prisma/client";
import { toMinorUnits } from "../src/lib/money";

const prisma = new PrismaClient();

// Dev seed ONLY. The 14 here is a knob, not an assumption baked into app logic.
const MEMBER_COUNT = Number(process.env.SEED_MEMBERS ?? 14);

const SAMPLE_NAMES = [
  "Alok", "Rahul", "Priya", "Sam", "John", "Alex", "Maya", "Leah",
  "Omar", "Grace", "Noah", "Ella", "Ravi", "Zara", "Ben", "Nina",
];

const CATEGORIES = ["Groceries", "Household", "Bills", "Utilities", "Transport", "Entertainment"];

async function main() {
  console.log(`Seeding London Household with ${MEMBER_COUNT} members...`);

  const household = await prisma.household.create({
    data: { name: "London Household", createdBy: "seed", currency: "GBP" },
  });

  // Categories
  const categories = await Promise.all(
    CATEGORIES.map((name) =>
      prisma.expenseCategory.create({ data: { householdId: household.id, name } }),
    ),
  );

  // Members (first is ADMIN). No cap — change SEED_MEMBERS to 50, 100, etc.
  const members = [];
  for (let i = 0; i < MEMBER_COUNT; i++) {
    const name = SAMPLE_NAMES[i % SAMPLE_NAMES.length] + (i >= SAMPLE_NAMES.length ? `_${i}` : "");
    const user = await prisma.user.create({
      data: { name, email: `${name.toLowerCase()}@example.com` },
    });
    await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: user.id,
        role: i === 0 ? "ADMIN" : "MEMBER",
        status: "ACTIVE",
      },
    });
    members.push(user);
  }

  // Budget: £5,000 for August 2026
  await prisma.budget.create({
    data: {
      householdId: household.id,
      amountMinor: toMinorUnits("5000"),
      periodType: "MONTHLY",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-31"),
    },
  });

  // A few realistic confirmed expenses
  const seedExpenses: Array<[string, number, string]> = [
    ["Tesco", 8000, "Groceries"],
    ["Amazon", 3500, "Household"],
    ["B&Q", 12000, "Household"],
    ["Sainsbury's", 4250, "Groceries"],
    ["TfL", 1560, "Transport"],
  ];
  for (let i = 0; i < seedExpenses.length; i++) {
    const [merchant, amountMinor, catName] = seedExpenses[i];
    const cat = categories.find((c) => c.name === catName)!;
    await prisma.expense.create({
      data: {
        householdId: household.id,
        userId: members[i % members.length].id,
        categoryId: cat.id,
        amountMinor,
        merchant,
        purchaseDate: new Date(`2026-08-${10 + i}`),
        source: "MANUAL",
        status: "CONFIRMED",
      },
    });
  }

  console.log(`Done. Household ${household.id}, admin: ${members[0].email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
