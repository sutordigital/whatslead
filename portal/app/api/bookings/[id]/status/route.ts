import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "找不到工作空間" }, { status: 403 });
    }

    const body = await request.json();
    const status = typeof body?.status === "string" ? body.status : "";

    const apiUrl = process.env.WHATSLEAD_API_URL;
    const portalSecret = process.env.WHATSLEAD_PORTAL_SECRET;

    if (!apiUrl || !portalSecret) {
      return NextResponse.json({ error: "Portal 尚未完成後端連接設定" }, { status: 500 });
    }

    const endpoint =
      apiUrl.replace(/\/$/, "") +
      "/internal/bookings/" +
      id +
      "/status";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-portal-secret": portalSecret
      },
      body: JSON.stringify({
        tenant_id: membership.tenant_id,
        status
      }),
      cache: "no-store"
    });

    const rawBody = await response.text();
    let result: any = {};

    try {
      result = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      result = {};
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error || "更新預約狀態失敗" },
        { status: response.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新預約狀態失敗" },
      { status: 500 }
    );
  }
}
