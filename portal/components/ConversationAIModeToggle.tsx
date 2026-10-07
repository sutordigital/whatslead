"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function ConversationAIModeToggle({
  conversationId,
  tenantId,
  initialMode
}: {
  conversationId: string;
  tenantId: string;
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

    const supabase = createClient();

    const { error } = await supabase
      .from("conversations")
      .update({
        ai_mode: next,
        updated_at: new Date().toISOString()
      })
      .eq("id", conversationId)
      .eq("tenant_id", tenantId);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    if (next === "active") {
      const { error: handoffError } = await supabase
        .from("handoffs")
        .update({
          status: "returned_to_ai",
          updated_at: new Date().toISOString()
        })
        .eq("conversation_id", conversationId)
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "contacted"]);

      if (handoffError) {
        await supabase
          .from("conversations")
          .update({
            ai_mode: mode,
            updated_at: new Date().toISOString()
          })
          .eq("id", conversationId)
          .eq("tenant_id", tenantId);

        setError(handoffError.message);
        setSaving(false);
        return;
      }
    }

    setMode(next);
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
              : "目前由真人處理。交回 AI 後，新訊息會再次由 AI 自動回覆。"}
          </div>
        </div>

        <button className="btn" type="button" onClick={toggle} disabled={saving}>
          {saving
            ? "更新中..."
            : isActive
              ? "暫停 AI"
              : "交回 AI 處理"}
        </button>
      </div>

      {error ? <div style={{ marginTop: 10 }}>更新失敗：{error}</div> : null}
    </div>
  );
}
