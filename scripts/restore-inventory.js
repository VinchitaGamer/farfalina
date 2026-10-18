const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const path = require("path");

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function restore() {
  console.log("🌸 Restaurando inventario de Florería y Carissma...");

  // 1. Obtener los insumos vivos existentes para vincular recetas
  const ingredients = await prisma.rawIngredient.findMany();
  console.log(`✓ Encontrados ${ingredients.length} insumos vivos en base de datos.`);

  const findIng = (term) => {
    const found = ingredients.find(i => i.name.toLowerCase().includes(term.toLowerCase()));
    if (found) return found.id;
    return ingredients[0]?.id; // fallback seguro
  };

  // 2. Restaurar Catálogo de Arreglos Florales
  console.log("💐 Restaurando arreglos de Florería Farfalina...");
  await prisma.arrangementRecipeItem.deleteMany();
  await prisma.arrangement.deleteMany();

  const arrangementsData = [
    {
      name: "Bouquet Imperial 24 Rosas Rojas",
      category: "Rosas",
      price: 280.0,
      featured: true,
      image: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=800&q=80",
      description: "Espectacular bouquet de 24 rosas rojas seleccionadas a mano, envueltas en fino papel kraft artesanal con cinta de seda.",
      recipes: [
        { ingName: "Rosas Rojas", qty: 24 },
        { ingName: "Eucalipto", qty: 4 },
        { ingName: "Cinta", qty: 2 },
      ]
    },
    {
      name: "Caja Premium Girasoles y Lirios Sol de Verano",
      category: "Girasoles",
      price: 240.0,
      featured: true,
      image: "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=800&q=80",
      description: "Vibrante arreglo primaveral en elegante caja de regalo con girasoles frescos y lirios blancos aromáticos.",
      recipes: [
        { ingName: "Girasoles", qty: 6 },
        { ingName: "Lirios", qty: 4 },
        { ingName: "Caja", qty: 1 },
        { ingName: "Eucalipto", qty: 3 },
      ]
    },
    {
      name: "Jarrón de Cristal Elegancia Real",
      category: "Arreglos Mixtos",
      price: 320.0,
      featured: false,
      image: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=800&q=80",
      description: "Composición de rosas blancas, lirios y follaje fino en florero de cristal cilíndrico.",
      recipes: [
        { ingName: "Rosas Blancas", qty: 12 },
        { ingName: "Lirios", qty: 3 },
        { ingName: "Florero", qty: 1 },
        { ingName: "Eucalipto", qty: 5 },
      ]
    },
    {
      name: "Sombrerera Tulipanes y Lisianthus Solsticio",
      category: "Girasoles",
      price: 290.0,
      featured: true,
      image: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=800&q=80",
      description: "Elegante caja sombrerera cargada de tulipanes y lisianthus con follaje fino.",
      recipes: [
        { ingName: "Tulipanes", qty: 10 },
        { ingName: "Lisianthus", qty: 8 },
        { ingName: "Caja", qty: 1 },
        { ingName: "Helecho", qty: 4 },
      ]
    },
    {
      name: "Caja Corazón Rosas Rojas Romance Velvet",
      category: "Rosas",
      price: 350.0,
      featured: true,
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
      description: "Edición exclusiva de rosas rojas en caja corazón terciopelo con cinta de satén.",
      recipes: [
        { ingName: "Rosas Rojas", qty: 18 },
        { ingName: "Caja Corazón", qty: 1 },
        { ingName: "Cinta", qty: 2 },
      ]
    },
    {
      name: "Ramo Deluxe Hortensias & Gerberas Silvestres",
      category: "Arreglos Mixtos",
      price: 210.0,
      featured: false,
      image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80",
      description: "Fresco ramo de hortensias azules combinadas con gerberas variadas y gypsophila.",
      recipes: [
        { ingName: "Hortensias", qty: 4 },
        { ingName: "Gerberas", qty: 6 },
        { ingName: "Gypsophila", qty: 3 },
      ]
    }
  ];

  for (const arr of arrangementsData) {
    const createdArr = await prisma.arrangement.create({
      data: {
        name: arr.name,
        category: arr.category,
        price: arr.price,
        featured: arr.featured,
        image: arr.image,
        description: arr.description,
      }
    });

    for (const r of arr.recipes) {
      const ingId = findIng(r.ingName);
      if (ingId) {
        await prisma.arrangementRecipeItem.create({
          data: {
            arrangementId: createdArr.id,
            rawIngredientId: ingId,
            quantityNeeded: r.qty,
          }
        });
      }
    }
  }
  console.log(`✓ ${arrangementsData.length} arreglos restaurados con sus recetas asociadas.`);

  // 3. Restaurar Vestidos de Carissma
  console.log("👗 Restaurando catálogo de vestidos de Carissma Alquileres...");
  await prisma.dress.deleteMany();

  const dressesData = [
    {
      name: "Vestido Gala Noche Rosa Gold Sequin",
      brand: "Carolina Herrera",
      size: "M",
      category: "Gala",
      imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80",
      baseRentalPrice: 480.0,
      acquisitionCost: 2400.0,
      timesUsed: 3,
      condition: "Excelente",
      requiredGuarantee: 500.0,
      status: "Disponible",
      color: "Rosa Gold",
    },
    {
      name: "Vestido Corte Sirena Borgoña Terciopelo",
      brand: "Pronovias",
      size: "S",
      category: "Gala",
      imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80",
      baseRentalPrice: 520.0,
      acquisitionCost: 3100.0,
      timesUsed: 5,
      condition: "Excelente",
      requiredGuarantee: 600.0,
      status: "Disponible",
      color: "Borgoña",
    },
    {
      name: "Vestido Cóctel Satén Emerald Green",
      brand: "ZARA Atelier",
      size: "L",
      category: "Coctel",
      imageUrl: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=800&q=80",
      baseRentalPrice: 380.0,
      acquisitionCost: 1800.0,
      timesUsed: 7,
      condition: "Excelente",
      requiredGuarantee: 400.0,
      status: "Disponible",
      color: "Verde Esmeralda",
    },
    {
      name: "Vestido Largo Champagne Tul & Cristales",
      brand: "Marchesa",
      size: "S",
      category: "Gala",
      imageUrl: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80",
      baseRentalPrice: 650.0,
      acquisitionCost: 4200.0,
      timesUsed: 1,
      condition: "Excelente",
      requiredGuarantee: 800.0,
      status: "Disponible",
      color: "Champagne",
    },
    {
      name: "Vestido Princesa Cenicienta Azul Royal",
      brand: "Rosa Clará",
      size: "M",
      category: "Quinceañera",
      imageUrl: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80",
      baseRentalPrice: 550.0,
      acquisitionCost: 3500.0,
      timesUsed: 2,
      condition: "Excelente",
      requiredGuarantee: 600.0,
      status: "Disponible",
      color: "Azul Royal",
    },
    {
      name: "Vestido Minimalista Seda Pura Marfil",
      brand: "Vera Wang",
      size: "XS",
      category: "Novia",
      imageUrl: "https://images.unsplash.com/photo-1546804784-896d0dca3805?auto=format&fit=crop&w=800&q=80",
      baseRentalPrice: 700.0,
      acquisitionCost: 4800.0,
      timesUsed: 1,
      condition: "Excelente",
      requiredGuarantee: 900.0,
      status: "Disponible",
      color: "Blanco Marfil",
    },
    {
      name: "Vestido Bohemio Floral Fiesta Jardín",
      brand: "Reformation",
      size: "M",
      category: "Graduación",
      imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80",
      baseRentalPrice: 320.0,
      acquisitionCost: 1500.0,
      timesUsed: 4,
      condition: "Excelente",
      requiredGuarantee: 350.0,
      status: "Disponible",
      color: "Floral Multicolor",
    },
    {
      name: "Vestido Escote Halter Negro Noche Glam",
      brand: "Saint Laurent",
      size: "S",
      category: "Gala",
      imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
      baseRentalPrice: 490.0,
      acquisitionCost: 2600.0,
      timesUsed: 2,
      condition: "Excelente",
      requiredGuarantee: 500.0,
      status: "Disponible",
      color: "Negro",
    }
  ];

  for (const dress of dressesData) {
    await prisma.dress.create({ data: dress });
  }
  console.log(`✓ ${dressesData.length} vestidos de gala restaurados.`);

  // Verificación final
  const [totalRaw, totalArr, totalDress] = await Promise.all([
    prisma.rawIngredient.count(),
    prisma.arrangement.count(),
    prisma.dress.count(),
  ]);

  console.log("\n==========================================");
  console.log("🎉 INVENTARIO RESTAURADO CON ÉXITO:");
  console.log(`- Insumos vivos (Flores, follajes, jarrones): ${totalRaw}`);
  console.log(`- Arreglos florales con recetas y fotos: ${totalArr}`);
  console.log(`- Vestidos de alquiler Carissma: ${totalDress}`);
  console.log("==========================================");
}

restore()
  .catch((e) => {
    console.error("Error al restaurar inventario:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
