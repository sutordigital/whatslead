import { db } from "../db.js";

export type LeadStatus = "early" | "potential" | "high_potential";

export interface PersistHumanHandoffParams {
  tenantId: string;
  conversationId: string;
  contactId: string;
  sourceMetaMessageId: string;
  reason: string;
  leadStatus: LeadStatus;
  summary: string;
}

export interface PersistHumanHandoffResult {
  id: string;
  status: string;
}

export async function persistHumanHandoff(
  params: PersistHumanHandoffParams
): Promise<PersistHumanHandoffResult> {
  const result = await db.query(
    `
    insert into public.handoffs (
      tenant_id,
      conversation_id,
      contact_id,
      source_meta_message_id,
      reason,
      lead_status,
      summary,
      status
    )
    values ($1, $2, $3, $4, $5, $6, $7, 'pending')
    on conflict (source_meta_message_id)
    do update set
      reason = excluded.reason,
      lead_status = excluded.lead_status,
      summary = excluded.summary,
      updated_at = now()
    returning id, status
    `,
    [
      params.tenantId,
      params.conversationId,
      params.contactId,
      params.sourceMetaMessageId,
      params.reason,
      params.leadStatus,
      params.summary
    ]
  );

  return result.rows[0] as PersistHumanHandoffResult;
}
