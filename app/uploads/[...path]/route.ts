import { NextRequest, NextResponse } from "next/server";
import { resolveSafeMediaFilePath, serveMediaFileResponse } from "@/lib/media-server";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const segments = params.path;
    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { success: false, error: "Ruta de archivo no especificada", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const filePath = resolveSafeMediaFilePath(segments, "uploads");
    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "Archivo multimedia no encontrado", code: "FILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    return serveMediaFileResponse(req, filePath);
  } catch (error) {
    console.error("[Uploads Route Handler] Error al servir archivo:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al procesar archivo multimedia", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
