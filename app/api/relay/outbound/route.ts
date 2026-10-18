import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-relay-client",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get("environment"); // "farfalina" | "carissma" | null
    const channel = searchParams.get("channel"); // "Facebook" | "Instagram" | null
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    const where: import("@prisma/client").Prisma.RelayOutboundQueueWhereInput = {
      status: "PENDING",
    };

    if (environment && environment !== "all") {
      where.environment = environment;
    }

    if (channel && channel !== "all") {
      where.channel = channel;
    }

    const pendingMessages = await prisma.relayOutboundQueue.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    // Registrar latido de sincronización de la extensión
    try {
      const activeEnvs = environment && environment !== "all" ? [environment] : ["farfalina", "carissma"];
      for (const env of activeEnvs) {
        for (const ch of ["Facebook", "Instagram", "WhatsApp"]) {
          await prisma.channelConfig.upsert({
            where: {
              channel_tenant_unique: {
                channel: ch,
                environment: env,
              },
            },
            update: {
              status: "CONNECTED",
              lastSyncAt: new Date(),
            },
            create: {
              channel: ch,
              environment: env,
              status: "CONNECTED",
              lastSyncAt: new Date(),
            },
          });
        }
      }
    } catch {
      // Ignorar fallo de heartbeat
    }

    return NextResponse.json(
      {
        success: true,
        data: pendingMessages,
        error: null,
        code: null,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error al consultar mensajes salientes";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMsg,
        code: "RELAY_OUTBOUND_FETCH_ERROR",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
