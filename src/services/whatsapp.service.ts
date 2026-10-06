export async function sendWhatsAppTextMessage(
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

    const metaMessage =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Unknown Meta API error";
    const metaCode =
      data?.error?.code !== undefined ? String(data.error.code) : "unknown";
    const metaType =
      typeof data?.error?.type === "string" ? data.error.type : "unknown";

    throw new Error(
      `Meta send failed (code ${metaCode}, type ${metaType}): ${metaMessage}`
    );
  }

  return data;
}
