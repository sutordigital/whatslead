"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
    if(error){setLoading(false);setError(error.message);return;}
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
    if(error){setLoading(false);setError(error.message);}
  }

  return <div className="card login">
    <h1>WhatsLead 登入</h1>
    <p className="muted">登入你的 WhatsLead 工作空間。</p>

    <button className="btn google-btn" type="button" onClick={loginWithGoogle} disabled={loading}>
      使用 Google 登入
    </button>

    <div className="auth-divider"><span>或使用電郵登入</span></div>

    <form className="grid" onSubmit={submit}>
      <input className="input" placeholder="電郵地址" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <input className="input" placeholder="密碼" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
      {error&&<div className="error-note">{error}</div>}
      <button className="btn" disabled={loading}>{loading?"登入中…":"登入"}</button>
    </form>

    <p className="muted auth-footer">
      未有帳戶？ <a className="text-link" href="/signup">開始免費試用</a>
    </p>
  </div>;
}
