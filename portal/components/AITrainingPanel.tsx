"use client";

import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Guidance = {
  id:string;
  guidance:string;
  category:string;
  is_active:boolean;
  priority:number;
  created_at:string;
};

export default function AITrainingPanel({
  tenantId,
  initialGuidance,
  settings
}:{
  tenantId:string;
  initialGuidance:Guidance[];
  settings:any;
}){
  const [guidance,setGuidance]=useState(initialGuidance);
  const [savingId,setSavingId]=useState<string|null>(null);
  const [error,setError]=useState("");

  async function updateGuidance(id:string, patch:Partial<Guidance>){
    setSavingId(id);
    setError("");
    const supabase=createClient();
    const {error}=await supabase
      .from("ai_guidance")
      .update({...patch,updated_at:new Date().toISOString()})
      .eq("id",id)
      .eq("tenant_id",tenantId);

    if(error){
      setError(error.message);
    }else{
      setGuidance(prev=>prev.map(item=>item.id===id?{...item,...patch}:item));
    }
    setSavingId(null);
  }

  const active=guidance
    .filter(item=>item.is_active)
    .sort((a,b)=>a.priority-b.priority || a.created_at.localeCompare(b.created_at));

  const promptPreview=useMemo(()=>{
    const lines:string[]=[];
    lines.push("WORKSPACE BUSINESS CONFIGURATION");
    if(settings?.business_name) lines.push(`Business name: ${settings.business_name}`);
    if(settings?.business_description) lines.push(`Business description: ${settings.business_description}`);
    if(Array.isArray(settings?.services) && settings.services.length){
      lines.push("Services offered:");
      settings.services.forEach((service:string)=>lines.push("- "+service));
    }
    if(settings?.tone_of_voice) lines.push(`Preferred tone of voice: ${settings.tone_of_voice}`);
    if(settings?.preferred_language) lines.push(`Preferred language: ${settings.preferred_language}`);
    if(Array.isArray(settings?.qualification_questions) && settings.qualification_questions.length){
      lines.push("Workspace qualification questions:");
      settings.qualification_questions.forEach((q:string)=>lines.push("- "+q));
    }
    if(settings?.handoff_rules) lines.push("Workspace handoff rules:\n"+settings.handoff_rules);
    if(settings?.custom_instructions) lines.push("Additional workspace instructions:\n"+settings.custom_instructions);

    if(active.length){
      lines.push("");
      lines.push("TENANT AI GUIDANCE — FOLLOW THESE WORKSPACE-SPECIFIC RULES WHEN RELEVANT:");
      active.forEach((item,index)=>lines.push(`${index+1}. ${item.guidance}`));
    }

    return lines.join("\n");
  },[active,settings]);

  return <div className="ai-training-grid">
    <section className="card ai-training-guidance-card">
      <div className="row ai-training-section-head">
        <div>
          <h2>有效 AI 指引</h2>
          <p className="muted">啟用中的規則會加入下一次 AI 回覆的 workspace context。</p>
        </div>
        <span className="pill">{active.length} 條啟用</span>
      </div>

      {error ? <div className="error-note">{error}</div> : null}

      <div className="ai-guidance-list">
        {guidance.length ? guidance.map(item=><div className={"ai-guidance-item "+(!item.is_active?"inactive":"")} key={item.id}>
          <div className="ai-guidance-top">
            <label className="ai-guidance-toggle">
              <input
                type="checkbox"
                checked={item.is_active}
                disabled={savingId===item.id}
                onChange={e=>updateGuidance(item.id,{is_active:e.target.checked})}
              />
              <span>{item.is_active?"啟用":"停用"}</span>
            </label>
            <small>{new Date(item.created_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"})}</small>
          </div>

          <textarea
            className="input ai-guidance-editor"
            value={item.guidance}
            rows={3}
            disabled={savingId===item.id}
            onChange={e=>{
              const value=e.target.value;
              setGuidance(prev=>prev.map(g=>g.id===item.id?{...g,guidance:value}:g));
            }}
            onBlur={()=>updateGuidance(item.id,{guidance:item.guidance})}
          />
          <div className="ai-guidance-meta">
            <span>來源：{item.category==="message_feedback"?"AI 回覆評論":item.category}</span>
            <span>優先序：{item.priority}</span>
            {savingId===item.id?<span>儲存中…</span>:null}
          </div>
        </div>) : <div className="muted">暫時未有 AI 指引。你可以喺對話內評論 AI 回覆並勾選「套用為未來 AI 指引」。</div>}
      </div>
    </section>

    <section className="card ai-prompt-preview-card">
      <div className="ai-training-section-head">
        <div>
          <h2>AI Prompt 預覽</h2>
          <p className="muted">顯示客戶可控制、實際會傳入 AI 的 workspace-specific context。</p>
        </div>
      </div>

      <div className="ai-prompt-note">
        核心安全規則、系統層指令及內部執行邏輯不會顯示；以下只展示你公司設定與 AI Training 對回覆的實際影響。
      </div>

      <pre className="ai-prompt-preview">{promptPreview||"目前未有 workspace-specific prompt 設定。"}</pre>

      {active.length ? <div className="ai-prompt-impact">
        <strong>評論如何影響 AI</strong>
        <p>每一條啟用指引都會被加入 <code>TENANT AI GUIDANCE</code> 區段。AI 之後回覆客戶時會將這些規則連同公司資料、對話紀錄及最新客戶訊息一齊考慮。</p>
      </div> : null}
    </section>
  </div>;
}
