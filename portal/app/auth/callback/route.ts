import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?auth_error=missing_code", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const target = new URL("/login", request.url);
    target.searchParams.set("auth_error", "oauth_callback");
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
