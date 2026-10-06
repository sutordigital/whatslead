"use client";
import { FormEvent, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Settings={
  business_name?:string|null;
  business_description?:string|null;
  services?:string[]|null;
  tone_of_voice?:string|null;
  preferred_language?:string|null;
  qualification_questions?:string[]|null;
  custom_instructions?:string|null;
  handoff_rules?:string|null;
  ai_enabled?:boolean|null;
};

export default function AISettingsForm({tenantId,initial}:{tenantId:string;initial:Settings|null}){
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);

  const [form,setForm]=useState({
    business_name:initial?.business_name??"",
    business_description:initial?.business_description??"",
    services:(initial?.services??[]).join("\n"),
    tone_of_voice:initial?.tone_of_voice??"",
    preferred_language:initial?.preferred_language??"",
    qualification_questions:(initial?.qualification_questions??[]).join("\n"),
    custom_instructions:initial?.custom_instructions??"",
    handoff_rules:initial?.handoff_rules??"",
    ai_enabled:initial?.ai_enabled??true
  });

  async function submit(e:FormEvent){
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const payload={
      tenant_id:tenantId,
      business_name:form.business_name,
      business_description:form.business_description,
      services:form.services.split("\n").map(x=>x.trim()).filter(Boolean),
      tone_of_voice:form.tone_of_voice,
      preferred_language:form.preferred_language,
      qualification_questions:form.qualification_questions.split("\n").map(x=>x.trim()).filter(Boolean),
      custom_instructions:form.custom_instructions,
      handoff_rules:form.handoff_rules,
      ai_enabled:form.ai_enabled,
      updated_at:new Date().toISOString()
    };

    const {error}=await createClient()
      .from("tenant_ai_settings")
      .upsert(payload,{onConflict:"tenant_id"});

    setSaving(false);
    if(!error) setSaved(true);
  }

  const set=(key:string,value:any)=>setForm(prev=>({...prev,[key]:value}));

  return <form className="grid" onSubmit={submit}>
    <div className="card grid">
      <label>公司 / 品牌名稱<input className="input" value={form.business_name} onChange={e=>set("business_name",e.target.value)}/></label>
      <label>公司簡介<textarea className="input" rows={4} value={form.business_description} onChange={e=>set("business_description",e.target.value)}/></label>
      <label>服務項目（每行一項）<textarea className="input" rows={5} value={form.services} onChange={e=>set("services",e.target.value)}/></label>
      <label>回覆語氣<input className="input" value={form.tone_of_voice} onChange={e=>set("tone_of_voice",e.target.value)}/></label>
      <label>主要回覆語言<input className="input" value={form.preferred_language} onChange={e=>set("preferred_language",e.target.value)}/></label>
      <label>客戶篩選問題（每行一題）<textarea className="input" rows={5} value={form.qualification_questions} onChange={e=>set("qualification_questions",e.target.value)}/></label>
      <label>自訂 AI 指示<textarea className="input" rows={6} value={form.custom_instructions} onChange={e=>set("custom_instructions",e.target.value)}/></label>
      <label>轉交人工規則<textarea className="input" rows={4} value={form.handoff_rules} onChange={e=>set("handoff_rules",e.target.value)}/></label>
      <label><input type="checkbox" checked={form.ai_enabled} onChange={e=>set("ai_enabled",e.target.checked)}/> 啟用 AI 自動回覆</label>
      <button className="btn" disabled={saving}>{saving?"儲存中...":"儲存設定"}</button>
      {saved&&<div>已儲存。</div>}
    </div>
  </form>;
}
