import { db } from "../db.js";

export async function getActiveAIGuidance(
  tenantId: string,
  limit = 50
): Promise<string[]> {
  const result = await db.query(
    `
    select guidance
    from public.ai_guidance
    where tenant_id = $1
      and is_active = true
    order by priority asc, created_at asc
    limit $2
    `,
    [tenantId, limit]
  );

  return result.rows
    .map((row) => (typeof row.guidance === "string" ? row.guidance.trim() : ""))
    .filter(Boolean);
}
