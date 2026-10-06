import express from "express";
import { db } from "./db.js";
import { getWhatsAppAccount } from "./services/whatsappAccount.service.js";

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
) {
  const response = await fetch(
    `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          body: text
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Meta send failed:", data);
    throw new Error("Meta send failed");
  }

  return data;
}

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
  res.sendStatus(200);

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;

    const message = value?.messages?.[0];
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (!message || !phoneNumberId) {
      return;
    }

    if (message.type !== "text") {
      return;
    }

    const from = message.from;
    const incomingText = message.text?.body;

    console.log("Incoming WhatsApp:", {
      phoneNumberId,
      from,
      incomingText
    });

    const account = await getWhatsAppAccount(phoneNumberId);

    await sendWhatsAppMessage(
      account.phone_number_id,
      account.access_token,
      from,
      "WhatsLead received your message ✅"
    );

    console.log("Auto reply sent");
  } catch (error) {
    console.error("Webhook processing failed:", error);
  }
});

app.get("/db-test", async (_req, res) => {
  try {
    const result = await db.query("select now() as server_time");

    res.json({
      connected: true,
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    console.error("DB test failed:", error);

    res.status(500).json({
      connected: false
    });
  }
});

app.get("/whatsapp-account-test", async (_req, res) => {
  try {
    const account = await getWhatsAppAccount("1389500287577115");

    res.json({
      found: true,
      tenantId: account.tenant_id,
      phoneNumberId: account.phone_number_id,
      wabaId: account.waba_id,
      displayNumber: account.display_number,
      tokenLoaded: Boolean(account.access_token)
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      found: false
    });
  }
});

app.get("/send-test", async (_req, res) => {
  try {
    const account = await getWhatsAppAccount("1389500287577115");

    const to = "85295354610";

    const response = await fetch(
      `https://graph.facebook.com/v26.0/${account.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: {
            body: "WhatsLead outbound test ✅"
          }
        })
      }
    );

    const data = await response.json();

    res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      metaResponse: data
    });
  } catch (error) {
    console.error("Send test error:", error);

    res.status(500).json({
      ok: false,
      error: String(error)
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WhatsLead is running on port ${PORT}`);
});
