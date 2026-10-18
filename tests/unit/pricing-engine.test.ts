import { describe, it, expect } from "vitest";

function calculateRentalPrice(acquisitionCost: number, timesUsed: number, condition: string): { suggestedRental: number; minimumGuarantee: number } {
  let depreciationFactor = Math.max(0.4, 1 - timesUsed * 0.05);
  if (condition === "Bueno") depreciationFactor *= 0.9;
  if (condition === "Requiere Mantenimiento") depreciationFactor *= 0.75;

  const suggestedRental = Math.round((acquisitionCost * 0.12 * depreciationFactor) / 5) * 5;
  const minimumGuarantee = Math.round((acquisitionCost * 0.25) / 10) * 10;

  return { suggestedRental, minimumGuarantee };
}

describe("Motor de Cálculo de Precios Carissma", () => {
  it("debe calcular el alquiler sugerido para prenda nueva", () => {
    const res = calculateRentalPrice(2400, 0, "Excelente");
    expect(res.suggestedRental).toBeGreaterThan(200);
    expect(res.minimumGuarantee).toBe(600);
  });

  it("debe aplicar depreciación por uso acumulado", () => {
    const newDress = calculateRentalPrice(3000, 1, "Excelente");
    const usedDress = calculateRentalPrice(3000, 10, "Excelente");
    expect(usedDress.suggestedRental).toBeLessThan(newDress.suggestedRental);
  });
});
