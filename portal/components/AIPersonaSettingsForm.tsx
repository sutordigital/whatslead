"use client";
import { FormEvent, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Persona = {
  assistant_name?: string;
  identity_style?: "transparent_ai"|"online_assistant"|"professional_ai";
  personality_style?: "professional"|"friendly"|"hk_natural";
  language_mode?: "auto"|"traditional_zh"|"english"|"bilingual"|"mandarin";
  emoji_level?: "none"|"light"|"friendly";
  message_length?: "short"|"balanced"|"detailed";
  response_pacing?: "instant"|"natural"|"thoughtful";
  message_chunking?: boolean;
  acknowledge_before_action?: boolean;
  ask_one_question_at_a_time?: boolean;
  avoid_repetitive_greetings?: boolean;
  remember_known_details?: boolean;
  explain_uncertainty?: boolean;
  tone_mirroring?: "off"|"low"|"medium";
  after_hours_style?: "same_as_daytime"|"acknowledge_after_hours";
};

const cardStyle=(active:boolean)=>({
  display:"block",
  border: active ? "2px solid #111827" : "1px solid #d1d5db",
  borderRadius:12,
  padding:14,
  cursor:"pointer",
  background:active ? "#f9fafb" : "#fff"
});

function Choice({name,value,checked,onChange,title,example}:{name:string;value:string;checked:boolean;onChange:()=>void;title:string;example:string}){
  return <label style={cardStyle(checked)}>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange}/>
      <strong>{title}</strong>
    </div>
    <div className="muted" style={{marginTop:7,fontSize:13}}>{example}</div>
  </label>;
}

export default function AIPersonaSettingsForm({tenantId,initial}:{tenantId:string;initial:Persona|null}){
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const presetNames=["Mia","Joyce","Alex","Leo"];
  const initialName=initial?.assistant_name || "Mia";
  const [customName,setCustomName]=useState(!presetNames.includes(initialName));

  const [form,setForm]=useState({
    assistant_name:initialName,
    identity_style:initial?.identity_style || "transparent_ai",
    personality_style:initial?.personality_style || "hk_natural",
    language_mode:initial?.language_mode || "auto",
    emoji_level:initial?.emoji_level || "light",
    message_length:initial?.message_length || "balanced",
    response_pacing:initial?.response_pacing || "natural",
    message_chunking:initial?.message_chunking ?? true,
    acknowledge_before_action:initial?.acknowledge_before_action ?? true,
    ask_one_question_at_a_time:initial?.ask_one_question_at_a_time ?? true,
    avoid_repetitive_greetings:initial?.avoid_repetitive_greetings ?? true,
    remember_known_details:initial?.remember_known_details ?? true,
    explain_uncertainty:initial?.explain_uncertainty ?? true,
    tone_mirroring:initial?.tone_mirroring || "low",
    after_hours_style:initial?.after_hours_style || "acknowledge_after_hours"
  });

  const set=(key:string,value:any)=>setForm(prev=>({...prev,[key]:value}));

  async function submit(e:FormEvent){
    e.preventDefault();
    setSaving(true); setSaved(false);
    const {error}=await createClient().from("tenant_ai_persona_settings").upsert({
      tenant_id:tenantId,...form
    },{onConflict:"tenant_id"});
    setSaving(false);
    if(!error) setSaved(true);
  }

  return <form className="card grid" onSubmit={submit}>
    <div>
      <h3 style={{marginTop:0}}>1. AI 名字</h3>
      <p className="muted">名字可用於內部 AI 人格或需要時署名；預設開場會以「客服／CS team」身份回覆，唔會主動講「AI 助理」。</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        {presetNames.map(name=><label key={name} style={{display:"flex",gap:6,alignItems:"center"}}>
          <input type="radio" name="assistant_name" checked={!customName&&form.assistant_name===name} onChange={()=>{setCustomName(false);set("assistant_name",name)}}/> {name}
        </label>)}
        <label style={{display:"flex",gap:6,alignItems:"center"}}>
          <input type="radio" name="assistant_name" checked={customName} onChange={()=>setCustomName(true)}/> 自訂
        </label>
      </div>
      {customName&&<input className="input" style={{marginTop:10}} value={form.assistant_name} onChange={e=>set("assistant_name",e.target.value)} placeholder="例如：阿晴"/>}
    </div>

    <div>
      <h3>2. 點樣介紹自己</h3>
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
        <Choice name="identity" value="transparent_ai" checked={form.identity_style==="transparent_ai"} onChange={()=>set("identity_style","transparent_ai")} title="客服團隊（推薦）" example="例：Hi 👋 呢度係 ABC 客服團隊，有咩可以幫到你？"/>
        <Choice name="identity" value="online_assistant" checked={form.identity_style==="online_assistant"} onChange={()=>set("identity_style","online_assistant")} title="CS / 客服" example="例：Hi 👋 呢度係 ABC CS，想問下你今日想了解邊方面？"/>
        <Choice name="identity" value="professional_ai" checked={form.identity_style==="professional_ai"} onChange={()=>set("identity_style","professional_ai")} title="專業客服" example="例：您好，這裡是 ABC 客戶服務團隊，很高興協助您。"/>
      </div>
    </div>

    <div>
      <h3>3. 對話風格</h3>
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
        <Choice name="personality" value="professional" checked={form.personality_style==="professional"} onChange={()=>set("personality_style","professional")} title="專業" example="適合法律、B2B：『明白。想先了解你目前最需要處理的是哪一項？』"/>
        <Choice name="personality" value="friendly" checked={form.personality_style==="friendly"} onChange={()=>set("personality_style","friendly")} title="親切" example="適合美容、教育：『明白呀 😊 想問下你今次主要想了解邊方面？』"/>
        <Choice name="personality" value="hk_natural" checked={form.personality_style==="hk_natural"} onChange={()=>set("personality_style","hk_natural")} title="自然香港風（推薦）" example="『明白 👍 你而家有冇現有網站可以 send 畀我睇下？』"/>
      </div>
    </div>

    <div>
      <h3>4. 回覆語言</h3>
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
        <Choice name="language" value="auto" checked={form.language_mode==="auto"} onChange={()=>set("language_mode","auto")} title="跟客人語言（推薦）" example="客人用廣東話就廣東話；英文就英文。"/>
        <Choice name="language" value="traditional_zh" checked={form.language_mode==="traditional_zh"} onChange={()=>set("language_mode","traditional_zh")} title="繁體中文" example="優先香港繁中用語。"/>
        <Choice name="language" value="english" checked={form.language_mode==="english"} onChange={()=>set("language_mode","english")} title="English" example="Default to English replies."/>
        <Choice name="language" value="bilingual" checked={form.language_mode==="bilingual"} onChange={()=>set("language_mode","bilingual")} title="雙語" example="以客人主要語言為主，有需要先補充另一語言。"/>
      </div>
    </div>

    <div>
      <h3>5. 回覆速度</h3>
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
        <Choice name="pacing" value="instant" checked={form.response_pacing==="instant"} onChange={()=>set("response_pacing","instant")} title="即時" example="約 0.3–0.9 秒；效率最高，但較似系統。"/>
        <Choice name="pacing" value="natural" checked={form.response_pacing==="natural"} onChange={()=>set("response_pacing","natural")} title="自然（推薦）" example="約 1.6–4.2 秒；較似真人睇完訊息再回覆。"/>
        <Choice name="pacing" value="thoughtful" checked={form.response_pacing==="thoughtful"} onChange={()=>set("response_pacing","thoughtful")} title="較慢思考" example="約 3.5–6.5 秒；適合高價、顧問型服務。"/>
      </div>
    </div>

    <div>
      <h3>6. 回覆長度</h3>
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
        <Choice name="length" value="short" checked={form.message_length==="short"} onChange={()=>set("message_length","short")} title="短" example="通常 1–2 句；節奏快。"/>
        <Choice name="length" value="balanced" checked={form.message_length==="balanced"} onChange={()=>set("message_length","balanced")} title="平衡（推薦）" example="通常 2–4 句；有內容但唔會太長。"/>
        <Choice name="length" value="detailed" checked={form.message_length==="detailed"} onChange={()=>set("message_length","detailed")} title="詳細" example="複雜服務可講多啲，但仍避免一大段文字。"/>
      </div>
    </div>

    <div>
      <h3>7. Emoji</h3>
      <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
        {([["none","不用"],["light","少量（推薦）"],["friendly","較親切"]] as const).map(([v,label])=><label key={v}><input type="radio" name="emoji" checked={form.emoji_level===v} onChange={()=>set("emoji_level",v)}/> {label}</label>)}
      </div>
    </div>

    <div>
      <h3>8. 跟客人語氣</h3>
      <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
        {([["off","固定品牌語氣"],["low","輕微配合（推薦）"],["medium","較明顯配合"]] as const).map(([v,label])=><label key={v}><input type="radio" name="mirror" checked={form.tone_mirroring===v} onChange={()=>set("tone_mirroring",v)}/> {label}</label>)}
      </div>
      <p className="muted">例如客人用簡短廣東話，AI 可以自然啲；客人正式英文，就會相應正式，但唔會模仿粗口或不當語氣。</p>
    </div>

    <div>
      <h3>9. 自然對話細節</h3>
      <div className="grid">
        <label><input type="checkbox" checked={form.message_chunking} onChange={e=>set("message_chunking",e.target.checked)}/> 適合時拆成 2–3 個 WhatsApp 訊息，而唔係一大段</label>
        <label><input type="checkbox" checked={form.acknowledge_before_action} onChange={e=>set("acknowledge_before_action",e.target.checked)}/> 做 Booking／查時間／轉人工前，先自然回一句確認</label>
        <label><input type="checkbox" checked={form.ask_one_question_at_a_time} onChange={e=>set("ask_one_question_at_a_time",e.target.checked)}/> 優先一次問一條問題，避免似表格</label>
        <label><input type="checkbox" checked={form.avoid_repetitive_greetings} onChange={e=>set("avoid_repetitive_greetings",e.target.checked)}/> 避免每次都「多謝查詢／明白／有咩可以幫你」</label>
        <label><input type="checkbox" checked={form.remember_known_details} onChange={e=>set("remember_known_details",e.target.checked)}/> 記住對話已提供資料，唔重複問</label>
        <label><input type="checkbox" checked={form.explain_uncertainty} onChange={e=>set("explain_uncertainty",e.target.checked)}/> 唔肯定就直接講，交由真人確認，唔亂估</label>
      </div>
    </div>

    <div>
      <h3>10. 非辦公時間</h3>
      <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
        <label><input type="radio" name="afterhours" checked={form.after_hours_style==="same_as_daytime"} onChange={()=>set("after_hours_style","same_as_daytime")}/> 同平時一樣</label>
        <label><input type="radio" name="afterhours" checked={form.after_hours_style==="acknowledge_after_hours"} onChange={()=>set("after_hours_style","acknowledge_after_hours")}/> 提醒真人會於辦公時間跟進（推薦）</label>
      </div>
    </div>

    <button className="btn" disabled={saving}>{saving?"儲存中...":"儲存 AI 人格設定"}</button>
    {saved&&<div>已儲存。新對話會使用呢套設定。</div>}
  </form>;
}
