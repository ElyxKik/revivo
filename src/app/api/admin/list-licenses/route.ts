import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, requireAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 200);

  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    items: (data || []).map((item) => ({
      ...item,
      seatIndex: item.seat_index,
      keyHash: item.key_hash,
      isActive: item.is_active,
      createdAt: item.created_at,
    })),
  });
}
