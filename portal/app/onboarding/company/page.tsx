"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "../../../components/AuthShell";
import { createClient } from "../../../lib/supabase/client";

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: membership } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!active) return;

      if (membership) {
        router.replace("/dashboard");
        return;
      }

      const suggested =
        typeof user.user_metadata?.company_name === "string"
          ? user.user_metadata.company_name
          : "";

      setCompanyName(suggested);
      setLoading(false);
    }

    init();
    return () => { active = false; };
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanName = companyName.trim();

    if (!cleanName) {
      setLoading(false);
      setError("請輸入公司名稱。");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("provision_current_user_tenant", {
      company_name: cleanName
    });

    if (error) {
      setLoading(false);
      setError("暫時未能建立工作空間，請稍後再試。");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="最後一步"
      title="設定你的工作空間"
      description="輸入公司名稱，我們會建立一個只屬於你公司的 WhatsLead 工作空間。"
    >
      {loading ? (
        <div className="auth-loading">正在準備你的工作空間…</div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            <span>公司名稱</span>
            <input
              className="input auth-input"
              placeholder="你的公司名稱"
              value={companyName}
              onChange={e=>setCompanyName(e.target.value)}
              required
              autoFocus
            />
          </label>

          {error && <div className="error-note">{error}</div>}

          <button className="btn auth-primary-button" disabled={loading}>
            建立工作空間
          </button>
        </form>
      )}
    </AuthShell>
  );
}
