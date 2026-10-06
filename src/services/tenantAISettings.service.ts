import { db } from "../db.js";

export interface TenantAISettings {
  business_name: string | null;
  business_description: string | null;
  services: string[];
  tone_of_voice: string | null;
  preferred_language: string | null;
  qualification_questions: string[];
  faqs: unknown;
  custom_instructions: string | null;
  handoff_rules: string | null;
  ai_enabled: boolean;
}

export async function getTenantAISettings(
  tenantId: string
): Promise<TenantAISettings | null> {
  const result = await db.query(
    `
    select
      business_name,
      business_description,
      services,
      tone_of_voice,
      preferred_language,
      qualification_questions,
      faqs,
      custom_instructions,
      handoff_rules,
      ai_enabled
    from public.tenant_ai_settings
    where tenant_id = $1
    limit 1
    `,
    [tenantId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    business_name: row.business_name ?? null,
    business_description: row.business_description ?? null,
    services: Array.isArray(row.services) ? row.services : [],
    tone_of_voice: row.tone_of_voice ?? null,
    preferred_language: row.preferred_language ?? null,
    qualification_questions: Array.isArray(row.qualification_questions)
      ? row.qualification_questions
      : [],
    faqs: row.faqs ?? [],
    custom_instructions: row.custom_instructions ?? null,
    handoff_rules: row.handoff_rules ?? null,
    ai_enabled: row.ai_enabled !== false
  };
}
