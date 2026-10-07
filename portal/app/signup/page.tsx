"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "../../components/AuthShell";
import { createClient } from "../../lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const supabase = createClient();
    const origin = window.location.origin;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/onboarding/company`,
        data: {
          full_name: fullName.trim(),
          company_name: companyName.trim()
        }
      }
    });

    if (error) {
      setLoading(false);
      setError("暫時未能建立帳戶，請檢查資料後再試。");
      return;
    }

    if (data.session) {
      const { error: provisionError } = await supabase.rpc(
        "provision_current_user_tenant",
        { company_name: companyName.trim() }
      );

      if (provisionError) {
        setLoading(false);
        setError("帳戶已建立，但工作空間建立失敗，請重新登入再試。");
        return;
      }

      router.push("/dashboard");
      router.refresh();
      return;
    }

    setLoading(false);
    setMessage("帳戶已建立。請檢查電郵並完成驗證。");
  }

  async function signUpWithGoogle() {
    setError("");
    setLoading(true);

    const supabase = createClient();
    const origin = window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/onboarding/company`
      }
    });

    if (error) {
      setLoading(false);
      setError("暫時未能使用 Google 註冊，請稍後再試。");
    }
  }

  return (
    <AuthShell
      eyebrow="開始使用 WhatsLead"
      title="建立你的帳戶"
      description="建立工作空間後，即可連接 WhatsApp Business 及開始設定 AI 回覆。"
    >
      <button className="auth-google-button" type="button" onClick={signUpWithGoogle} disabled={loading}>
        <span className="auth-google-mark" aria-hidden="true">G</span>
        使用 Google 繼續
      </button>

      <div className="auth-divider"><span>或使用電郵註冊</span></div>

      <form className="auth-form" onSubmit={submit}>
        <label className="auth-field">
          <span>你的姓名</span>
          <input
            className="input auth-input"
            placeholder="例如：陳大文"
            value={fullName}
            onChange={e=>setFullName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>

        <label className="auth-field">
          <span>公司名稱</span>
          <input
            className="input auth-input"
            placeholder="你的公司名稱"
            value={companyName}
            onChange={e=>setCompanyName(e.target.value)}
            autoComplete="organization"
            required
          />
        </label>

        <label className="auth-field">
          <span>工作電郵</span>
          <input
            className="input auth-input"
            placeholder="you@company.com"
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="auth-field">
          <span>密碼</span>
          <input
            className="input auth-input"
            placeholder="最少 8 個字元"
            type="password"
            minLength={8}
            value={password}
            onChange={e=>setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error && <div className="error-note">{error}</div>}
        {message && <div className="success-note">{message}</div>}

        <button className="btn auth-primary-button" disabled={loading}>
          {loading ? "處理中…" : "建立帳戶"}
        </button>
      </form>

      <p className="auth-footer">
        已有帳戶？ <a className="text-link" href="/login">登入</a>
      </p>
    </AuthShell>
  );
}
