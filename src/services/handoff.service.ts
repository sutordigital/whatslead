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
  created: boolean;
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
    on conflict (tenant_id, contact_id)
    do update
    set conversation_id = excluded.conversation_id,
        source_meta_message_id = excluded.source_meta_message_id,
        reason = excluded.reason,
        lead_status = case
          when public.handoffs.lead_status = 'high_potential' then 'high_potential'
          when public.handoffs.lead_status = 'potential'
               and excluded.lead_status = 'early' then 'potential'
          else excluded.lead_status
        end,
        summary = excluded.summary,
        status = case
          when public.handoffs.status in ('resolved', 'cancelled', 'returned_to_ai') then 'pending'
          else public.handoffs.status
        end,
        updated_at = now()
    returning
      id,
      status,
      (xmax = 0) as created
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

  const row = result.rows[0] as {
    id: string;
    status: string;
    created: boolean;
  };

  return row;
}
