import { sendWhatsAppTextMessage } from "./whatsapp.service.js";

export interface OwnerHandoffNotificationParams {
  phoneNumberId: string;
  accessToken: string;
  leadStatus: "early" | "potential" | "high_potential";
  reason: string;
  summary: string;
}

export async function notifyOwnerOfNewHandoff({
  phoneNumberId,
  accessToken,
  leadStatus,
  reason,
  summary
}: OwnerHandoffNotificationParams): Promise<boolean> {
  const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;

  if (!ownerNumber) {
    console.warn("OWNER_WHATSAPP_NUMBER is not configured; skipping owner notification");
    return false;
  }

  const text = [
    "🔥 New WhatsLead handoff",
    "",
    `Lead status: ${leadStatus}`,
    `Reason: ${reason}`,
    "",
    summary
  ].join("\n");

  await sendWhatsAppTextMessage(
    phoneNumberId,
    accessToken,
    ownerNumber,
    text
  );

  return true;
}
