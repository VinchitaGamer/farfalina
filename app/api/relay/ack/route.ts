import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

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

const RelayAckSchema = z.object({
  queueId: z.string().min(1, "queueId es requerido"),
  status: z.enum(["DELIVERED", "FAILED", "SENT"]),
  error: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = RelayAckSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: parsed.error.issues[0]?.message || "Payload de confirmación inválido",
          code: "VALIDATION_ERROR",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const { queueId, status, error } = parsed.data;

    const updated = await prisma.relayOutboundQueue.update({
      where: { id: queueId },
      data: {
        status,
        sentAt: new Date(),
        error: error || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: updated,
        error: null,
        code: null,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al procesar acuse de recibo";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMsg,
        code: "RELAY_ACK_ERROR",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
