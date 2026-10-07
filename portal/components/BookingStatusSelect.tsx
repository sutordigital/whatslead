"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantEntitlement } from "./TenantEntitlementProvider";

export default function BookingStatusSelect({
  id,
  initial
}: {
  id: string;
  initial: string;
}) {
  const [status, setStatus] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const entitlement = useTenantEntitlement();
  const locked = !entitlement.loading && !entitlement.canUseAutomation;

  async function change(next: string) {
    if (locked) return;
    const previous = status;
    setStatus(next);
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/bookings/" + id + "/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: next })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || "更新預約狀態失敗");
      }

      router.refresh();
    } catch (error) {
      setStatus(previous);
      setError(error instanceof Error ? error.message : "更新預約狀態失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="booking-status-control">
      <select
        className="input compact-select"
        value={status}
        disabled={locked || saving}
        onChange={e => change(e.target.value)}
      >
        <option value="pending">待確認</option>
        <option value="confirmed">已確認</option>
        <option value="completed">已完成</option>
        <option value="cancelled">已取消</option>
        <option value="no_show">未有出席</option>
      </select>
      {locked ? <span className="muted">試用已結束</span> : null}
      {saving ? <span className="muted">更新中…</span> : null}
      {error ? <span className="error-note">{error}</span> : null}
    </div>
  );
}
