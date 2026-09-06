import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_CATEGORIES } from "../src/lib/categories";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed de categorias...");

  for (const categoryName of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findUnique({
      where: { name: categoryName },
    });

    if (!existing) {
      await prisma.category.create({
        data: { name: categoryName },
      });
      console.log(`Categoria criada: ${categoryName}`);
    } else {
      console.log(`Categoria já existe: ${categoryName}`);
    }
  }

  console.log("Seed concluído!");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
