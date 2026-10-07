"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
      setError(error.message);
      return;
    }

    if (data.session) {
      const { error: provisionError } = await supabase.rpc(
        "provision_current_user_tenant",
        { company_name: companyName.trim() }
      );

      if (provisionError) {
        setLoading(false);
        setError(provisionError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
      return;
    }

    setLoading(false);
    setMessage("註冊成功。請檢查電郵並完成驗證。");
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
      setError(error.message);
    }
  }

  return (
    <div className="card login">
      <h1>建立 WhatsLead 帳戶</h1>
      <p className="muted">建立你的工作空間，之後即可連接 WhatsApp Business。</p>

      <button className="btn google-btn" type="button" onClick={signUpWithGoogle} disabled={loading}>
        使用 Google 繼續
      </button>

      <div className="auth-divider"><span>或使用電郵註冊</span></div>

      <form className="grid" onSubmit={submit}>
        <input className="input" placeholder="你的姓名" value={fullName} onChange={e=>setFullName(e.target.value)} required />
        <input className="input" placeholder="公司名稱" value={companyName} onChange={e=>setCompanyName(e.target.value)} required />
        <input className="input" placeholder="工作電郵" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="input" placeholder="密碼（最少 8 個字元）" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required />

        {error && <div className="error-note">{error}</div>}
        {message && <div className="success-note">{message}</div>}

        <button className="btn" disabled={loading}>
          {loading ? "處理中…" : "開始免費試用"}
        </button>
      </form>

      <p className="muted auth-footer">
        已有帳戶？ <a className="text-link" href="/login">登入</a>
      </p>
    </div>
  );
}
