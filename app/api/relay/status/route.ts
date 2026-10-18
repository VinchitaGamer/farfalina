import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const env = searchParams.get("environment") || "all";

    const environments = env === "all" ? ["farfalina", "carissma"] : [env];

    interface RelayEnvStatus {
      environment: string;
      isConnected: boolean;
      lastSyncAt: Date | null;
      pendingCount: number;
      deliveredCount: number;
      facebookStatus: string;
      instagramStatus: string;
    }

    const result: Record<string, RelayEnvStatus> = {};

    for (const e of environments) {
      const fbConfig = await prisma.channelConfig.findUnique({
        where: { channel_tenant_unique: { channel: "Facebook", environment: e } },
      });
      const igConfig = await prisma.channelConfig.findUnique({
        where: { channel_tenant_unique: { channel: "Instagram", environment: e } },
      });

      const pendingCount = await prisma.relayOutboundQueue.count({
        where: { environment: e, status: "PENDING" },
      });

      const deliveredCount = await prisma.relayOutboundQueue.count({
        where: { environment: e, status: "DELIVERED" },
      });

      const lastSync = [fbConfig?.lastSyncAt, igConfig?.lastSyncAt]
        .filter(Boolean)
        .sort((a, b) => (b!.getTime() - a!.getTime()))[0] || null;

      const isConnected = lastSync ? (Date.now() - new Date(lastSync).getTime() < 120000) : false;

      result[e] = {
        environment: e,
        isConnected,
        lastSyncAt: lastSync,
        pendingCount,
        deliveredCount,
        facebookStatus: fbConfig?.status || "DISCONNECTED",
        instagramStatus: igConfig?.status || "DISCONNECTED",
      };
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        error: null,
        code: null,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al obtener estado de Relay";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMsg,
        code: "RELAY_STATUS_ERROR",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
