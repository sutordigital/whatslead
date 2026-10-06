"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function HumanReplyComposer({
  conversationId
}: {
  conversationId: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();

    const message = text.trim();
    if (!message) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: message })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result?.error || "傳送失敗");
        return;
      }

      setText("");
      router.refresh();
    } catch {
      setError("傳送失敗，請再試一次。");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card grid" onSubmit={submit}>
      <div>
        <strong>真人回覆</strong>
        <div className="muted">
          由 CRM 傳送訊息後，系統會自動暫停此對話的 AI 回覆。
        </div>
      </div>

      <textarea
        className="input"
        rows={4}
        placeholder="輸入要傳送到客戶 WhatsApp 的訊息..."
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={4000}
      />

      <div className="row">
        <small className="muted">{text.length}/4000</small>
        <button className="btn" type="submit" disabled={sending || !text.trim()}>
          {sending ? "傳送中..." : "傳送 WhatsApp"}
        </button>
      </div>

      {error ? <div>錯誤：{error}</div> : null}
    </form>
  );
}
