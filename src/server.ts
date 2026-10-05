import express from "express";

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;
let lastWebhook: unknown = null;

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

app.post("/webhooks/meta", (req, res) => {
  lastWebhook = req.body;

  console.log(
    "Incoming Meta webhook:",
    JSON.stringify(req.body, null, 2)
  );

  res.sendStatus(200);
});

app.get("/debug/last-webhook", (_req, res) => {
  res.json({
    received: lastWebhook !== null,
    payload: lastWebhook
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WhatsLead is running on port ${PORT}`);
});
