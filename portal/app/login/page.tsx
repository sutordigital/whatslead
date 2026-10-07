"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "../../components/AuthShell";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const router=useRouter();

  async function submit(e:FormEvent){
    e.preventDefault();
    setError("");
    setLoading(true);

    const {error}=await createClient().auth.signInWithPassword({email,password});

    if(error){
      setLoading(false);
      setError("登入失敗，請檢查電郵及密碼後再試。");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function loginWithGoogle(){
    setError("");
    setLoading(true);

    const supabase=createClient();
    const origin=window.location.origin;

    const {error}=await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:`${origin}/auth/callback?next=/dashboard`}
    });

    if(error){
      setLoading(false);
      setError("暫時未能使用 Google 登入，請稍後再試。");
    }
  }

  return (
    <AuthShell
      eyebrow="歡迎回來"
      title="登入 WhatsLead"
      description="登入你的工作空間，繼續管理對話、潛在客戶及 AI 回覆。"
    >
      <button className="auth-google-button" type="button" onClick={loginWithGoogle} disabled={loading}>
        <span className="auth-google-mark" aria-hidden="true">G</span>
        使用 Google 登入
      </button>

      <div className="auth-divider"><span>或使用電郵登入</span></div>

      <form className="auth-form" onSubmit={submit}>
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
            placeholder="輸入密碼"
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error&&<div className="error-note">{error}</div>}

        <button className="btn auth-primary-button" disabled={loading}>
          {loading?"登入中…":"登入"}
        </button>
      </form>

      <p className="auth-footer">
        未有帳戶？ <a className="text-link" href="/signup">建立帳戶</a>
      </p>
    </AuthShell>
  );
}
