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

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "找不到工作空間" }, { status: 403 });
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", membership.tenant_id)
      .maybeSingle();

    if (conversationError || !conversation) {
      return NextResponse.json({ error: "找不到對話" }, { status: 404 });
    }

    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "請輸入訊息" }, { status: 400 });
    }

    if (text.length > 4000) {
      return NextResponse.json({ error: "訊息太長" }, { status: 400 });
    }

    const apiUrl = process.env.WHATSLEAD_API_URL;
    const portalSecret = process.env.WHATSLEAD_PORTAL_SECRET;

    if (!apiUrl || !portalSecret) {
      return NextResponse.json(
        { error: "Portal 尚未完成後端連接設定" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/internal/conversations/${id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-portal-secret": portalSecret
        },
        body: JSON.stringify({
          tenant_id: membership.tenant_id,
          text
        }),
        cache: "no-store"
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error || "傳送失敗" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Portal human message route failed:", error);
    return NextResponse.json({ error: "傳送失敗" }, { status: 500 });
  }
}
