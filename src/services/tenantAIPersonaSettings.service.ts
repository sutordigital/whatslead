import { db } from "../db.js";

export interface TenantAIPersonaSettings {
  assistant_name: string;
  identity_style: "transparent_ai" | "online_assistant" | "professional_ai";
  personality_style: "professional" | "friendly" | "hk_natural";
  language_mode: "auto" | "traditional_zh" | "english" | "bilingual" | "mandarin";
  emoji_level: "none" | "light" | "friendly";
  message_length: "short" | "balanced" | "detailed";
  response_pacing: "instant" | "natural" | "thoughtful";
  message_chunking: boolean;
  acknowledge_before_action: boolean;
  ask_one_question_at_a_time: boolean;
  avoid_repetitive_greetings: boolean;
  remember_known_details: boolean;
  explain_uncertainty: boolean;
  tone_mirroring: "off" | "low" | "medium";
  after_hours_style: "same_as_daytime" | "acknowledge_after_hours";
  business_relevance_mode: "strict" | "balanced" | "open";
}

export async function getTenantAIPersonaSettings(
  tenantId: string
): Promise<TenantAIPersonaSettings | null> {
  const result = await db.query(
    `
    select
      assistant_name,
      identity_style,
      personality_style,
      language_mode,
      emoji_level,
      message_length,
      response_pacing,
      message_chunking,
      acknowledge_before_action,
      ask_one_question_at_a_time,
      avoid_repetitive_greetings,
      remember_known_details,
      explain_uncertainty,
      tone_mirroring,
      after_hours_style,
      business_relevance_mode
    from public.tenant_ai_persona_settings
    where tenant_id = $1
    limit 1
    `,
    [tenantId]
  );

  if (!result.rowCount || !result.rows[0]) return null;
  return result.rows[0] as TenantAIPersonaSettings;
}
