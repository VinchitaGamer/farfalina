const Database = require('better-sqlite3');
const path = require('path');

const localDb = new Database(path.join(__dirname, '../prisma/dev.db'));

// Read ingredients from VPS dump or seed them
const ingredients = [
  { name: "Girasoles", type: "Flor", available: 9, unit: "tallos", warningThreshold: 10, costPerUnit: 12, shelfLifeDays: 7 },
  { name: "Lirios", type: "Flor", available: 6, unit: "tallos", warningThreshold: 8, costPerUnit: 18, shelfLifeDays: 8 },
  { name: "Lisianthus rosas", type: "Flor", available: 15, unit: "tallos", warningThreshold: 10, costPerUnit: 14, shelfLifeDays: 9 },
  { name: "Rosas Rojas Importadas", type: "Flor", available: 48, unit: "tallos", warningThreshold: 20, costPerUnit: 10, shelfLifeDays: 10 },
  { name: "Rosas Blancas", type: "Flor", available: 24, unit: "tallos", warningThreshold: 15, costPerUnit: 10, shelfLifeDays: 10 },
  { name: "Rosas Rosadas", type: "Flor", available: 24, unit: "tallos", warningThreshold: 15, costPerUnit: 10, shelfLifeDays: 10 },
  { name: "Hortensias Azules", type: "Flor", available: 8, unit: "tallos", warningThreshold: 6, costPerUnit: 25, shelfLifeDays: 6 },
  { name: "Tulipanes Holandeses", type: "Flor", available: 12, unit: "tallos", warningThreshold: 10, costPerUnit: 20, shelfLifeDays: 7 },
  { name: "Claveles Rojos", type: "Flor", available: 30, unit: "tallos", warningThreshold: 15, costPerUnit: 6, shelfLifeDays: 14 },
  { name: "Claveles Blancos", type: "Flor", available: 25, unit: "tallos", warningThreshold: 15, costPerUnit: 6, shelfLifeDays: 14 },
  { name: "Gerberas Variadas", type: "Flor", available: 18, unit: "tallos", warningThreshold: 12, costPerUnit: 8, shelfLifeDays: 9 },
  { name: "Orquídeas Phalaenopsis", type: "Flor", available: 5, unit: "maceta", warningThreshold: 3, costPerUnit: 85, shelfLifeDays: 30 },
  { name: "Eucalipto Baby Blue", type: "Follaje", available: 35, unit: "tallos", warningThreshold: 15, costPerUnit: 4, shelfLifeDays: 15 },
  { name: "Ruscus Italiano", type: "Follaje", available: 40, unit: "tallos", warningThreshold: 20, costPerUnit: 3.5, shelfLifeDays: 20 },
  { name: "Gypsophila (Ilusión)", type: "Follaje", available: 28, unit: "tallos", warningThreshold: 15, costPerUnit: 5, shelfLifeDays: 12 },
  { name: "Helecho Cuero", type: "Follaje", available: 22, unit: "tallos", warningThreshold: 10, costPerUnit: 4.5, shelfLifeDays: 14 },
  { name: "Caja Corazón Premium", type: "Caja", available: 14, unit: "uds", warningThreshold: 5, costPerUnit: 35, shelfLifeDays: null },
  { name: "Caja Cilíndrica Negra", type: "Caja", available: 18, unit: "uds", warningThreshold: 6, costPerUnit: 30, shelfLifeDays: null },
  { name: "Caja Cilíndrica Rosa Pastel", type: "Caja", available: 12, unit: "uds", warningThreshold: 5, costPerUnit: 30, shelfLifeDays: null },
  { name: "Caja Cuadrada Blanca Lujo", type: "Caja", available: 10, unit: "uds", warningThreshold: 4, costPerUnit: 32, shelfLifeDays: null },
  { name: "Florero de Vidrio Cilíndrico", type: "Florero", available: 16, unit: "uds", warningThreshold: 6, costPerUnit: 28, shelfLifeDays: null },
  { name: "Florero de Cerámica Nórdico", type: "Florero", available: 9, unit: "uds", warningThreshold: 4, costPerUnit: 45, shelfLifeDays: null },
  { name: "Papel Coreano Impermeable Rosado", type: "Envoltorio", available: 45, unit: "pliegos", warningThreshold: 20, costPerUnit: 5, shelfLifeDays: null },
  { name: "Papel Coreano Negro Mate", type: "Envoltorio", available: 38, unit: "pliegos", warningThreshold: 15, costPerUnit: 5, shelfLifeDays: null },
  { name: "Papel Kraft Ecológico", type: "Envoltorio", available: 50, unit: "pliegos", warningThreshold: 25, costPerUnit: 3, shelfLifeDays: null },
  { name: "Cinta de Satén Dorada 2.5cm", type: "Cinta", available: 60, unit: "metros", warningThreshold: 20, costPerUnit: 2, shelfLifeDays: null },
  { name: "Cinta de Satén Rojo Vino 2.5cm", type: "Cinta", available: 55, unit: "metros", warningThreshold: 20, costPerUnit: 2, shelfLifeDays: null },
  { name: "Cinta de Satén Rosa Pastel 2.5cm", type: "Cinta", available: 48, unit: "metros", warningThreshold: 20, costPerUnit: 2, shelfLifeDays: null },
  { name: "Espuma Floral Oasis Premium", type: "Insumo", available: 26, unit: "bloques", warningThreshold: 10, costPerUnit: 15, shelfLifeDays: null },
  { name: "Nutriente Floral Conservante (Sobre)", type: "Insumo", available: 80, unit: "sobres", warningThreshold: 30, costPerUnit: 2.5, shelfLifeDays: null },
  { name: "Tarjeta Dedicatoria FloralFarfalina", type: "Tarjeta", available: 120, unit: "uds", warningThreshold: 40, costPerUnit: 1.5, shelfLifeDays: null },
  { name: "Alfiler Diamante para Ramos", type: "Accesorio", available: 90, unit: "uds", warningThreshold: 30, costPerUnit: 1, shelfLifeDays: null },
  { name: "Corona Metálica Decorativa", type: "Accesorio", available: 7, unit: "uds", warningThreshold: 3, costPerUnit: 22, shelfLifeDays: null },
  { name: "Luces LED Cálidas para Ramo (2m)", type: "Accesorio", available: 19, unit: "uds", warningThreshold: 8, costPerUnit: 12, shelfLifeDays: null }
];

localDb.prepare("DELETE FROM RawIngredient").run();
const insert = localDb.prepare(`
  INSERT INTO RawIngredient (id, name, type, available, unit, warningThreshold, costPerUnit, entryDate, shelfLifeDays, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
`);

let count = 0;
for (const ing of ingredients) {
  const id = `raw_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  insert.run(id, ing.name, ing.type, ing.available, ing.unit, ing.warningThreshold, ing.costPerUnit, ing.shelfLifeDays);
  count++;
}

console.log('Restored', count, 'ingredients locally.');