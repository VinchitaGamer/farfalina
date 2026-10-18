import { NextRequest, NextResponse } from "next/server";
import { resolveSafeMediaFilePath, serveMediaFileResponse } from "@/lib/media-server";

interface RouteParams {
  params: {
    path?: string[];
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const rawSegments = params.path || [];
    if (!rawSegments.length) {
      return NextResponse.json(
        { success: false, error: "Ruta de archivo no especificada", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const filePath = resolveSafeMediaFilePath(rawSegments, "uploads");
    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "Archivo multimedia no encontrado", code: "FILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    return serveMediaFileResponse(req, filePath);
  } catch (err) {
    console.error("[API Media Route Handler Error]:", err);
    return NextResponse.json(
      { success: false, error: "Error al servir archivo multimedia", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
