import { db } from "../db/index.js";

export interface PersistIncomingTextMessageParams {
  tenantId: string;
  whatsappAccountId: string;
  whatsappId: string;
  displayName: string | null;
  metaMessageId: string;
  content: string;
}

export async function persistIncomingTextMessage(
  params: PersistIncomingTextMessageParams
): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Find or create contact
    const contactResult = await client.query(
      `
      insert into contacts (
        tenant_id,
        whatsapp_id,
        phone_number,
        display_name
      )
      values ($1, $2, $3, $4)
      on conflict (tenant_id, whatsapp_id)
      do update set
        phone_number = excluded.phone_number,
        display_name = coalesce(excluded.display_name, contacts.display_name),
        updated_at = now()
      returning id
      `,
      [params.tenantId, params.whatsappId, params.whatsappId, params.displayName]
    );

    const contactId = contactResult.rows[0].id as string;

    // 3. Find existing open conversation
    const conversationResult = await client.query(
      `
      select id
      from conversations
      where tenant_id = $1
        and contact_id = $2
        and whatsapp_account_id = $3
        and status = 'open'
      order by created_at desc
      limit 1
      `,
      [params.tenantId, contactId, params.whatsappAccountId]
    );

    let conversationId: string;

    if (conversationResult.rowCount && conversationResult.rows[0]) {
      conversationId = conversationResult.rows[0].id as string;
    } else {
      // 4. Create new open conversation
      const newConversationResult = await client.query(
        `
        insert into conversations (
          tenant_id,
          contact_id,
          whatsapp_account_id,
          status,
          ai_mode,
          last_message_at
        )
        values ($1, $2, $3, 'open', 'active', now())
        returning id
        `,
        [params.tenantId, contactId, params.whatsappAccountId]
      );

      conversationId = newConversationResult.rows[0].id as string;
    }

    // 5. Insert inbound message
    await client.query(
      `
      insert into messages (
        tenant_id,
        conversation_id,
        meta_message_id,
        direction,
        sender_type,
        message_type,
        content,
        status
      )
      values ($1, $2, $3, 'inbound', 'customer', 'text', $4, 'received')
      on conflict (meta_message_id) do nothing
      `,
      [
        params.tenantId,
        conversationId,
        params.metaMessageId,
        params.content
      ]
    );

    // 7. Update conversation.last_message_at
    await client.query(
      `
      update conversations
      set last_message_at = now(),
          updated_at = now()
      where id = $1
      `,
      [conversationId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
