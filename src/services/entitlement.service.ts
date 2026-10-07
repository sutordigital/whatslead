import { db } from "../db.js";

export interface TenantEntitlement {
  status: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  plan: string | null;
  billingInterval: string | null;
  canUseAutomation: boolean;
}

export async function getTenantEntitlement(
  tenantId: string
): Promise<TenantEntitlement> {
  const result = await db.query(
    `
    select
      subscription_status,
      trial_started_at,
      trial_ends_at,
      plan,
      billing_interval
    from public.tenants
    where id = $1
    limit 1
    `,
    [tenantId]
  );

  if (!result.rowCount || !result.rows[0]) {
    throw new Error("Tenant not found");
  }

  const row = result.rows[0] as {
    subscription_status: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    plan: string | null;
    billing_interval: string | null;
  };

  let status = row.subscription_status;
  const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at) : null;

  if (
    status === "trialing" &&
    trialEnd &&
    trialEnd.getTime() <= Date.now()
  ) {
    await db.query(
      `
      update public.tenants
      set subscription_status = 'expired',
          updated_at = now()
      where id = $1
        and subscription_status = 'trialing'
      `,
      [tenantId]
    );
    status = "expired";
  }

  const canUseAutomation =
    status === "active" ||
    (status === "trialing" &&
      trialEnd !== null &&
      trialEnd.getTime() > Date.now());

  return {
    status,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    plan: row.plan,
    billingInterval: row.billing_interval,
    canUseAutomation
  };
}
