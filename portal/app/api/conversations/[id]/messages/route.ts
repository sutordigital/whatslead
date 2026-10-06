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
        {
          error: "Portal 尚未完成後端連接設定",
          debug: {
            hasApiUrl: Boolean(apiUrl),
            hasPortalSecret: Boolean(portalSecret)
          }
        },
        { status: 500 }
      );
    }

    const endpoint =
      apiUrl.replace(/\/$/, "") +
      "/internal/conversations/" +
      id +
      "/messages";

    let response: Response;

    try {
      response = await fetch(endpoint, {
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
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: "無法連接 WhatsLead 後端",
          debug: {
            endpoint,
            detail: error instanceof Error ? error.message : String(error)
          }
        },
        { status: 502 }
      );
    }

    const rawBody = await response.text();

    let result: any = {};
    try {
      result = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      result = {};
    }

    if (!response.ok) {
      let message = result?.error;

      if (!message) {
        if (response.status === 401) {
          message = "後端認證失敗：請檢查兩邊 Portal Secret 是否完全一致";
        } else if (response.status === 404) {
          message = "後端找不到真人回覆 API：請確認 SiteGround 已部署最新 main";
        } else {
          message = "後端傳送失敗";
        }
      }

      return NextResponse.json(
        {
          error: message,
          debug: {
            backendStatus: response.status,
            endpoint,
            backendBody: rawBody.slice(0, 500)
          }
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Portal human message route failed:", error);

    return NextResponse.json(
      {
        error: "Portal 傳送流程發生錯誤",
        debug: {
          detail: error instanceof Error ? error.message : String(error)
        }
      },
      { status: 500 }
    );
  }
}
