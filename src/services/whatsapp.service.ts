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
    throw new Error("Meta send failed");
  }

  return data;
}
