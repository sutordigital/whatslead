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
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
      select id, status
      from public.handoffs
      where tenant_id = $1
        and conversation_id = $2
        and status = 'pending'
      order by created_at desc
      limit 1
      for update
      `,
      [params.tenantId, params.conversationId]
    );

    if (existing.rowCount && existing.rows[0]) {
      const updated = await client.query(
        `
        update public.handoffs
        set reason = $1,
            lead_status = $2,
            summary = $3,
            updated_at = now()
        where id = $4
        returning id, status
        `,
        [
          params.reason,
          params.leadStatus,
          params.summary,
          existing.rows[0].id
        ]
      );

      await client.query("COMMIT");
      return updated.rows[0] as PersistHumanHandoffResult;
    }

    const created = await client.query(
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

    await client.query("COMMIT");
    return created.rows[0] as PersistHumanHandoffResult;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
