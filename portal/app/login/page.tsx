"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const router=useRouter();

  async function submit(e:FormEvent){
    e.preventDefault();
    setError("");
    const {error}=await createClient().auth.signInWithPassword({email,password});
    if(error){setError(error.message);return;}
    router.push("/dashboard");
    router.refresh();
  }

  return <div className="card login">
    <h1>WhatsLead 登入</h1>
    <p className="muted">登入你的 WhatsLead 工作空間。</p>
    <form className="grid" onSubmit={submit}>
      <input className="input" placeholder="電郵地址" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <input className="input" placeholder="密碼" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
      {error&&<div>{error}</div>}
      <button className="btn">登入</button>
    </form>
  </div>;
}
