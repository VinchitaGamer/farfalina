import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-relay-client, X-Relay-Client",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET() {
  try {
    const [arrangements, dresses, ingredients] = await Promise.all([
      prisma.arrangement.findMany({
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          image: true,
          recipeItems: {
            select: {
              rawIngredientId: true,
              quantityNeeded: true,
              rawIngredient: {
                select: {
                  id: true,
                  name: true,
                  costPerUnit: true,
                  available: true,
                  unit: true,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.dress.findMany({
        select: {
          id: true,
          name: true,
          brand: true,
          size: true,
          color: true,
          category: true,
          baseRentalPrice: true,
          requiredGuarantee: true,
          status: true,
          condition: true,
          imageUrl: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.rawIngredient.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          available: true,
          unit: true,
          costPerUnit: true,
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          arrangements,
          dresses,
          ingredients,
        },
        error: null,
        code: null,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al obtener catálogo para Relay";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMsg,
        code: "RELAY_CATALOG_ERROR",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
