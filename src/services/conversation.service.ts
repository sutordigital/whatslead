import { db } from "../db.js";

export interface ConversationSendContext {
  conversationId: string;
  tenantId: string;
  contactWhatsappId: string;
  phoneNumberId: string;
  accessToken: string;
}

export async function getConversationSendContext(
  conversationId: string,
  tenantId: string
): Promise<ConversationSendContext> {
  const result = await db.query(
    `
    select
      c.id as conversation_id,
      c.tenant_id,
      ct.whatsapp_id as contact_whatsapp_id,
      wa.phone_number_id,
      ds.decrypted_secret as access_token
    from public.conversations c
    join public.contacts ct
      on ct.id = c.contact_id
     and ct.tenant_id = c.tenant_id
    join public.whatsapp_accounts wa
      on wa.id = c.whatsapp_account_id
     and wa.tenant_id = c.tenant_id
    join vault.decrypted_secrets ds
      on ds.id = wa.vault_secret_id
    where c.id = $1
      and c.tenant_id = $2
      and c.status = 'open'
      and wa.status = 'active'
    limit 1
    `,
    [conversationId, tenantId]
  );

  if (result.rowCount === 0) {
    throw new Error("Conversation not found or unavailable");
  }

  const row = result.rows[0];

  return {
    conversationId: row.conversation_id,
    tenantId: row.tenant_id,
    contactWhatsappId: row.contact_whatsapp_id,
    phoneNumberId: row.phone_number_id,
    accessToken: row.access_token
  };
}

export async function pauseConversationAI(
  conversationId: string,
  tenantId: string
): Promise<void> {
  await db.query(
    `
    update public.conversations
    set ai_mode = 'paused',
        updated_at = now()
    where id = $1
      and tenant_id = $2
    `,
    [conversationId, tenantId]
  );
}
