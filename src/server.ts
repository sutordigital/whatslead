import express from "express";
import { db } from "./db.js";
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
import { getActiveAIGuidance } from "./services/aiGuidance.service.js";
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

    const [aiSettings, aiGuidance] = await Promise.all([
      getTenantAISettings(account.tenant_id),
      getActiveAIGuidance(account.tenant_id)
    ]);

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
          guidance: aiGuidance,
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

            await pauseConversationAI(
              activeConversationId,
              account.tenant_id
            );

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


app.post("/internal/bookings/:id/status", async (req, res) => {
  try {
    const expectedSecret = process.env.PORTAL_API_SECRET;
    const providedSecret = req.header("x-portal-secret");

    if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
      return res.sendStatus(401);
    }

    const bookingId = req.params.id;
    const tenantId =
      typeof req.body?.tenant_id === "string" ? req.body.tenant_id : "";
    const nextStatus =
      typeof req.body?.status === "string" ? req.body.status : "";

    const allowedStatuses = [
      "pending",
      "confirmed",
      "completed",
      "cancelled",
      "no_show"
    ];

    if (!tenantId || !allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ error: "Invalid tenant_id or status" });
    }

    const result = await db.query(
      `
      select
        b.id,
        b.status as previous_status,
        b.scheduled_at,
        b.timezone,
        c.id as conversation_id,
        ct.whatsapp_id,
        wa.phone_number_id,
        ds.decrypted_secret as access_token
      from public.bookings b
      join public.conversations c
        on c.id = b.conversation_id
       and c.tenant_id = b.tenant_id
      join public.contacts ct
        on ct.id = b.contact_id
       and ct.tenant_id = b.tenant_id
      join public.whatsapp_accounts wa
        on wa.id = c.whatsapp_account_id
       and wa.tenant_id = b.tenant_id
      join vault.decrypted_secrets ds
        on ds.id = wa.vault_secret_id
      where b.id = $1
        and b.tenant_id = $2
      limit 1
      `,
      [bookingId, tenantId]
    );

    if (!result.rowCount || !result.rows[0]) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = result.rows[0];

    await db.query(
      `
      update public.bookings
      set status = $1,
          updated_at = now()
      where id = $2
        and tenant_id = $3
      `,
      [nextStatus, bookingId, tenantId]
    );

    let notificationSent = false;

    if (
      booking.previous_status !== nextStatus &&
      (nextStatus === "confirmed" || nextStatus === "cancelled")
    ) {
      const scheduledText = new Intl.DateTimeFormat("zh-HK", {
        timeZone: booking.timezone || "Asia/Hong_Kong",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).format(new Date(booking.scheduled_at));

      const text =
        nextStatus === "confirmed"
          ? `你嘅預約已確認 ✅\n時間：${scheduledText}\n如需更改時間，直接喺呢度話我哋知就可以。`
          : `你嘅預約已取消。\n原定時間：${scheduledText}\n如果想重新安排時間，可以直接喺呢度話我哋知。`;

      const sendResult = await sendWhatsAppTextMessage(
        booking.phone_number_id,
        booking.access_token,
        booking.whatsapp_id,
        text
      );

      const outboundMetaMessageId = sendResult?.messages?.[0]?.id;

      if (outboundMetaMessageId) {
        await persistOutboundTextMessage({
          tenantId,
          conversationId: booking.conversation_id,
          metaMessageId: outboundMetaMessageId,
          content: text,
          senderType: "human"
        });
        notificationSent = true;
      }
    }

    return res.status(200).json({
      success: true,
      status: nextStatus,
      notification_sent: notificationSent
    });
  } catch (error) {
    console.error("Booking status update failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update booking status"
    });
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

    await db.query(
      `
      update public.handoffs
      set status = 'contacted',
          updated_at = now()
      where tenant_id = $1
        and conversation_id = $2
      `,
      [tenantId, conversationId]
    );

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
