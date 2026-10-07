import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    const target = new URL("/settings", request.url);
    target.searchParams.set("whatsapp_connect", "error");
    target.searchParams.set("reason", errorDescription || error);
    return NextResponse.redirect(target);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const target = new URL("/settings", request.url);
  target.searchParams.set("whatsapp_connect", code ? "callback_received" : "returned");

  if (state) {
    target.searchParams.set("state", state);
  }

  return NextResponse.redirect(target);
}
