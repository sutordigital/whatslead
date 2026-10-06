import { db } from "../db.js";

export interface PersistIncomingTextMessageParams {
  tenantId: string;
  whatsappAccountId: string;
  whatsappId: string;
  displayName: string | null;
  metaMessageId: string;
  content: string;
}

export interface PersistIncomingTextMessageResult {
  contactId: string;
  conversationId: string;
  aiMode: string;
}

export interface PersistOutboundTextMessageParams {
  tenantId: string;
  conversationId: string;
  metaMessageId: string;
  content: string;
  senderType?: "ai" | "human";
}

export async function persistIncomingTextMessage(
  params: PersistIncomingTextMessageParams
): Promise<PersistIncomingTextMessageResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

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

    const conversationResult = await client.query(
      `
      select id, ai_mode
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
    let aiMode: string;

    if (conversationResult.rowCount && conversationResult.rows[0]) {
      conversationId = conversationResult.rows[0].id as string;
      aiMode = conversationResult.rows[0].ai_mode as string;
    } else {
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
        returning id, ai_mode
        `,
        [params.tenantId, contactId, params.whatsappAccountId]
      );

      conversationId = newConversationResult.rows[0].id as string;
      aiMode = newConversationResult.rows[0].ai_mode as string;
    }

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

    return {
      contactId,
      conversationId,
      aiMode
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function persistOutboundTextMessage(
  params: PersistOutboundTextMessageParams
): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

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
      values ($1, $2, $3, 'outbound', $5, 'text', $4, 'sent')
      on conflict (meta_message_id) do nothing
      `,
      [
        params.tenantId,
        params.conversationId,
        params.metaMessageId,
        params.content,
        params.senderType ?? "ai"
      ]
    );

    await client.query(
      `
      update conversations
      set last_message_at = now(),
          updated_at = now()
      where id = $1
      `,
      [params.conversationId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface ConversationHistoryItem {
  sender_type: string;
  direction: string;
  content: string;
}

export async function getRecentConversationMessages(
  conversationId: string,
  limit = 12
): Promise<ConversationHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));

  const result = await db.query(
    `
    select sender_type, direction, content
    from (
      select sender_type, direction, content, created_at
      from messages
      where conversation_id = $1
      order by created_at desc
      limit $2
    ) recent_messages
    order by created_at asc
    `,
    [conversationId, safeLimit]
  );

  return result.rows as ConversationHistoryItem[];
}
