import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "https://whatslead-theta.vercel.app"));
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "No tenant membership found" }, { status: 403 });
  }

  const appId = process.env.META_APP_ID || "1069677285935223";
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || "4450850585157994";
  const redirectUri =
    process.env.META_REDIRECT_URI ||
    "https://whatslead-theta.vercel.app/api/meta/embedded-signup/callback";

  const nonce = randomUUID();

  const signupUrl = new URL(
    "https://business.facebook.com/messaging/whatsapp/onboard/"
  );

  signupUrl.searchParams.set("app_id", appId);
  signupUrl.searchParams.set("config_id", configId);
  signupUrl.searchParams.set(
    "extras",
    JSON.stringify({
      version: "v4",
      sessionInfoVersion: "3",
      featureType: "whatsapp_business_app_onboarding"
    })
  );
  signupUrl.searchParams.set("redirect_uri", redirectUri);

  const response = NextResponse.redirect(signupUrl);
  response.cookies.set("meta_es_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/"
  });

  return response;
}
