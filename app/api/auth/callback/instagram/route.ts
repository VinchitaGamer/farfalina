import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  console.log("[Instagram OAuth Callback] Código de autorización recibido:", code);

  // Redirigir de vuelta al panel de Atención Omnicanal
  return NextResponse.redirect(new URL("/?channel=instagram&status=connected", req.url));
}
