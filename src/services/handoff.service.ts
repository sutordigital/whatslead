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
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existingPending = await client.query(
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

    if (existingPending.rowCount && existingPending.rows[0]) {
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
          existingPending.rows[0].id
        ]
      );

      await client.query("COMMIT");

      return {
        ...(updated.rows[0] as { id: string; status: string }),
        created: false
      };
    }

    const existingSource = await client.query(
      `
      select id, status
      from public.handoffs
      where source_meta_message_id = $1
      limit 1
      for update
      `,
      [params.sourceMetaMessageId]
    );

    if (existingSource.rowCount && existingSource.rows[0]) {
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
          existingSource.rows[0].id
        ]
      );

      await client.query("COMMIT");

      return {
        ...(updated.rows[0] as { id: string; status: string }),
        created: false
      };
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

    return {
      ...(created.rows[0] as { id: string; status: string }),
      created: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
