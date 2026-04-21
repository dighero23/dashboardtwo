import { NextResponse } from "next/server";

export async function GET() {
  const currentYear = new Date().getFullYear();
  return NextResponse.json({
    seasons: [currentYear, currentYear - 1, currentYear - 2],
  });
}
