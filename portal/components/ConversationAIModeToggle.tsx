"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function ConversationAIModeToggle({
  conversationId,
  initialMode
}: {
  conversationId: string;
  initialMode: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function toggle() {
    const next = mode === "active" ? "paused" : "active";
    setSaving(true);
    setError("");

    const { error } = await createClient()
      .from("conversations")
      .update({
        ai_mode: next,
        updated_at: new Date().toISOString()
      })
      .eq("id", conversationId);

    if (error) {
      setError(error.message);
    } else {
      setMode(next);
    }

    setSaving(false);
  }

  const isActive = mode === "active";

  return (
    <div className="card">
      <div className="row">
        <div>
          <strong>AI 自動回覆</strong>
          <div className="muted">
            {isActive
              ? "目前啟用中。客戶新訊息會由 AI 自動回覆。"
              : "目前已暫停。新訊息仍會記錄，但 AI 不會自動回覆。"}
          </div>
        </div>

        <button className="btn" type="button" onClick={toggle} disabled={saving}>
          {saving
            ? "更新中..."
            : isActive
              ? "暫停 AI"
              : "重新啟用 AI"}
        </button>
      </div>

      {error ? <div style={{ marginTop: 10 }}>更新失敗：{error}</div> : null}
    </div>
  );
}
