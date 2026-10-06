import express from "express";
import { getWhatsAppAccount } from "./services/whatsappAccount.service.js";
import {
  getRecentConversationMessages,
  persistIncomingTextMessage,
  persistOutboundTextMessage
} from "./services/messagePersistence.service.js";
import { sendWhatsAppTextMessage } from "./services/whatsapp.service.js";
import { generateAIReply } from "./services/ai.service.js";
import { persistHumanHandoff } from "./services/handoff.service.js";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
  res.json({
    app: "WhatsLead",
    status: "running"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "WhatsLead",
    timestamp: new Date().toISOString()
  });
});

app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhooks/meta", async (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const phoneNumberId = value?.metadata?.phone_number_id ?? null;

    if (!message || !phoneNumberId) {
      return res.sendStatus(200);
    }

    if (message.type !== "text") {
      return res.sendStatus(200);
    }

    // Acknowledge Meta immediately so webhook delivery is not blocked by
    // database, OpenAI, handoff, or outbound WhatsApp processing.
    res.sendStatus(200);

    const account = await getWhatsAppAccount(phoneNumberId);

    let conversationId: string | null = null;
    let contactId: string | null = null;

    try {
      const persistence = await persistIncomingTextMessage({
        tenantId: account.tenant_id,
        whatsappAccountId: account.id,
        whatsappId: message.from,
        displayName: value?.contacts?.[0]?.profile?.name ?? null,
        metaMessageId: message.id,
        content: message.text?.body ?? ""
      });

      conversationId = persistence.conversationId;
      contactId = persistence.contactId;
    } catch (error) {
      console.error("Message persistence failed:", error);
    }

    let replyText =
      "Thanks for your message! 我哋已經收到你嘅查詢，團隊會盡快跟進你。";

    if (conversationId && contactId) {
      try {
        const history = await getRecentConversationMessages(conversationId, 12);
        const customerMessage = message.text?.body ?? "";
        const priorHistory =
          history.length > 0 &&
          history[history.length - 1]?.direction === "inbound" &&
          history[history.length - 1]?.content === customerMessage
            ? history.slice(0, -1)
            : history;

        const activeConversationId = conversationId;
        const activeContactId = contactId;

        replyText = await generateAIReply({
          history: priorHistory,
          customerMessage,
          executeHandoff: async ({ reason, lead_status, summary }) => {
            const handoff = await persistHumanHandoff({
              tenantId: account.tenant_id,
              conversationId: activeConversationId,
              contactId: activeContactId,
              sourceMetaMessageId: message.id,
              reason,
              leadStatus: lead_status,
              summary
            });

            return {
              success: true,
              handoffId: handoff.id,
              status: handoff.status
            };
          }
        });
      } catch (error) {
        console.error("AI reply generation failed:", error);
      }
    }

    const sendResult = await sendWhatsAppTextMessage(
      account.phone_number_id,
      account.access_token,
      message.from,
      replyText
    );

    const outboundMetaMessageId = sendResult?.messages?.[0]?.id;

    if (conversationId && outboundMetaMessageId) {
      try {
        await persistOutboundTextMessage({
          tenantId: account.tenant_id,
          conversationId,
          metaMessageId: outboundMetaMessageId,
          content: replyText
        });
      } catch (error) {
        console.error("Outbound message persistence failed:", error);
      }
    }

    return;
  } catch (error) {
    console.error("Webhook processing failed:", error);

    if (!res.headersSent) {
      return res.sendStatus(500);
    }

    return;
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WhatsLead is running on port ${PORT}`);
});
