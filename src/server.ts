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
import { getTenantAISettings } from "./services/tenantAISettings.service.js";
import { getConversationSendContext, pauseConversationAI } from "./services/conversation.service.js";
import {
  createAIBooking,
  findAvailableSlots,
  getActiveConversationBooking
} from "./services/booking.service.js";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
  res.json({ app: "WhatsLead", status: "running" });
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

    res.sendStatus(200);

    const account = await getWhatsAppAccount(phoneNumberId);

    let conversationId: string | null = null;
    let contactId: string | null = null;
    let conversationAIMode: string | null = null;

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
      conversationAIMode = persistence.aiMode;
    } catch (error) {
      console.error("Message persistence failed:", error);
    }

    if (conversationAIMode === "paused") {
      console.log("AI replies paused for conversation", conversationId);
      return;
    }

    let replyText =
      "Thanks for your message! 我哋已經收到你嘅查詢，團隊會盡快跟進你。";

    const aiSettings = await getTenantAISettings(account.tenant_id);

    if (aiSettings?.ai_enabled === false) {
      console.log("AI replies disabled for tenant", account.tenant_id);
      return;
    }

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
        const activeBooking = await getActiveConversationBooking(
          account.tenant_id,
          activeConversationId
        );

        replyText = await generateAIReply({
          history: priorHistory,
          customerMessage,
          settings: aiSettings,
          activeBooking,
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
          },
          executeBooking: async ({
            date,
            time,
            booking_type,
            duration_minutes,
            notes
          }) => {
            const booking = await createAIBooking({
              tenantId: account.tenant_id,
              conversationId: activeConversationId,
              contactId: activeContactId,
              bookingType: booking_type,
              date,
              time,
              durationMinutes: duration_minutes,
              notes
            });

            return {
              success: true,
              bookingId: booking.id,
              status: booking.status,
              scheduledAt: booking.scheduledAt,
              created: booking.created
            };
          },
          executeAvailability: async ({ date, duration_minutes }) => {
            const availability = await findAvailableSlots({
              tenantId: account.tenant_id,
              date,
              durationMinutes: duration_minutes,
              limit: 4
            });

            return {
              success: true,
              date: availability.date,
              timezone: availability.timezone,
              durationMinutes: availability.durationMinutes,
              available: availability.available,
              slots: availability.slots,
              reason: availability.reason
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


app.post("/internal/conversations/:id/messages", async (req, res) => {
  try {
    const expectedSecret = process.env.PORTAL_API_SECRET;
    const providedSecret = req.header("x-portal-secret");

    if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
      return res.sendStatus(401);
    }

    const conversationId = req.params.id;
    const tenantId =
      typeof req.body?.tenant_id === "string" ? req.body.tenant_id : "";
    const text =
      typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!tenantId || !text) {
      return res.status(400).json({ error: "tenant_id and text are required" });
    }

    if (text.length > 4000) {
      return res.status(400).json({ error: "Message is too long" });
    }

    const context = await getConversationSendContext(conversationId, tenantId);

    await pauseConversationAI(conversationId, tenantId);

    const sendResult = await sendWhatsAppTextMessage(
      context.phoneNumberId,
      context.accessToken,
      context.contactWhatsappId,
      text
    );

    const outboundMetaMessageId = sendResult?.messages?.[0]?.id;

    if (!outboundMetaMessageId) {
      throw new Error("Meta did not return an outbound message id");
    }

    await persistOutboundTextMessage({
      tenantId,
      conversationId,
      metaMessageId: outboundMetaMessageId,
      content: text,
      senderType: "human"
    });

    return res.status(200).json({
      success: true,
      meta_message_id: outboundMetaMessageId,
      ai_mode: "paused"
    });
  } catch (error) {
    console.error("Human outbound message failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send message"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("WhatsLead is running on port", PORT);
});
