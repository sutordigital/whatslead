import express from "express";
import { getWhatsAppAccount } from "./services/whatsappAccount.service.js";
import { sendWhatsAppTextMessage } from "./services/whatsapp.service.js";

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

    const account = await getWhatsAppAccount(phoneNumberId);

    await sendWhatsAppTextMessage(
      account.phone_number_id,
      account.access_token,
      message.from,
      "WhatsLead received your message ✅"
    );

    return res.sendStatus(200);
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
