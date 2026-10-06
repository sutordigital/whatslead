import { db } from "../db.js";

export async function getWhatsAppAccount(phoneNumberId: string) {
  const result = await db.query(
    `
    select
      wa.id,
      wa.tenant_id,
      wa.phone_number_id,
      wa.waba_id,
      wa.display_number,
      ds.decrypted_secret as access_token
    from public.whatsapp_accounts wa
    join vault.decrypted_secrets ds
      on ds.id = wa.vault_secret_id
    where wa.phone_number_id = $1
      and wa.status = 'active'
    limit 1
    `,
    [phoneNumberId]
  );

  if (result.rowCount === 0) {
    throw new Error("WhatsApp account not found");
  }

  return result.rows[0];
}
