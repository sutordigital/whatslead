import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function requireTenant() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Supabase auth error: ${userError.message}`);
  }

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Tenant membership query failed: ${membershipError.message}`);
  }

  if (!membership) {
    throw new Error(
      `No tenant membership found for authenticated user ${user.id}`
    );
  }

  return {
    supabase,
    user,
    tenantId: membership.tenant_id as string,
    role: membership.role as string
  };
}
