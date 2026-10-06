import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function requireTenant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("tenant_members").select("tenant_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) throw new Error("No tenant membership found for this user");
  return { supabase, user, tenantId: membership.tenant_id as string, role: membership.role as string };
}
