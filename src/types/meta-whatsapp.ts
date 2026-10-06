/**
 * Meta WhatsApp webhook event types and payloads
 * Based on Meta Cloud API v26.0
 */

export interface MetaWebhookPayload {
  entry: MetaEntry[];
}

export interface MetaEntry {
  id: string;
  changes: MetaChange[];
}

export interface MetaChange {
  value: MetaChangeValue;
  field: string;
}

export interface MetaChangeValue {
  messaging_product: string;
  metadata: MetaMetadata;
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
  errors?: MetaError[];
}

export interface MetaMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface MetaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "document" | "audio" | "video" | "location" | "interactive" | "contacts" | "reaction" | "sticker";
  text?: {
    body: string;
  };
}

export interface MetaStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
}

export interface MetaError {
  code: number;
  title: string;
  message: string;
  error_data?: Record<string, unknown>;
}

/**
 * Safely extract incoming message from Meta webhook payload
 */
export function extractIncomingMessage(payload: unknown): {
  phoneNumberId: string | null;
  message: MetaMessage | null;
} {
  try {
    const data = payload as MetaWebhookPayload;
    const value = data?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id ?? null;
    const message = value?.messages?.[0] ?? null;

    return { phoneNumberId, message };
  } catch {
    return { phoneNumberId: null, message: null };
  }
}
