import { NextResponse } from "next/server";

// TikTok Direct API is unavailable in Latin America and has been removed from Farfalina & Carissma
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: "TikTok Direct API no opera en Latinoamérica y ha sido removida del sistema Farfalina & Carissma.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: "TikTok Direct API no opera en Latinoamérica y ha sido removida del sistema Farfalina & Carissma.",
    },
    { status: 410 }
  );
}
