import express from "express";
import { db } from "./db.js";

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WhatsLead is running on port ${PORT}`);
});
