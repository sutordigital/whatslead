"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type FeedbackItem = {
  id:string;
  conversation_id:string;
  message_id:string;
  comment:string|null;
  created_at:string;
  original_message:string|null;
  guidance_id:string|null;
  guidance_active:boolean|null;
};

export default function AITrainingFeedbackHistory({
  tenantId,
  initialFeedback
}:{
  tenantId:string;
  initialFeedback:FeedbackItem[];
}){
  const router=useRouter();
  const [items,setItems]=useState(initialFeedback);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [error,setError]=useState("");

  async function remove(item:FeedbackItem){
    if(!window.confirm("刪除呢條 AI 評論？相關 AI 指引亦會一併刪除，之後唔會再影響 prompt。")) return;

    setDeletingId(item.id);
    setError("");
    const supabase=createClient();

    if(item.guidance_id){
      const {error:guidanceError}=await supabase
        .from("ai_guidance")
        .delete()
        .eq("id",item.guidance_id)
        .eq("tenant_id",tenantId);

      if(guidanceError){
        setError(guidanceError.message);
        setDeletingId(null);
        return;
      }
    }

    const {error:feedbackError}=await supabase
      .from("ai_feedback")
      .delete()
      .eq("id",item.id)
      .eq("tenant_id",tenantId);

    if(feedbackError){
      setError(feedbackError.message);
      setDeletingId(null);
      return;
    }

    setItems(prev=>prev.filter(row=>row.id!==item.id));
    setDeletingId(null);
    router.refresh();
  }

  return <section className="ai-feedback-history">
    <div className="row ai-training-section-head">
      <div>
        <h2>AI 回覆評論紀錄</h2>
        <p className="muted">只有套用為 AI 指引的評論會影響 prompt。刪除評論時，相關指引會同步移除。</p>
      </div>
      <span className="pill">{items.length} 條評論</span>
    </div>

    {error ? <div className="error-note">{error}</div> : null}

    <div className="ai-feedback-history-list">
      {items.length ? items.map(item=><article className="card ai-feedback-history-item" key={item.id}>
        <div className="ai-feedback-history-top">
          <span className={"mini-pill "+(item.guidance_id && item.guidance_active?"blue":"")}>
            {item.guidance_id
              ? (item.guidance_active ? "已影響 AI Prompt" : "AI 指引已停用")
              : "只作評論"}
          </span>
          <small className="muted">{new Date(item.created_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"})}</small>
        </div>

        <div className="ai-feedback-original">
          <span>原本 AI 回覆</span>
          <p>{item.original_message||"無法載入原本訊息"}</p>
        </div>

        <div className="ai-feedback-comment">
          <span>團隊評論</span>
          <p>{item.comment||"沒有文字評論。"}</p>
        </div>

        <div className="ai-feedback-history-actions">
          <a className="text-link" href={"/conversations/"+item.conversation_id}>查看原本對話 →</a>
          <button
            type="button"
            className="danger-link"
            disabled={deletingId===item.id}
            onClick={()=>remove(item)}
          >{deletingId===item.id?"刪除中…":"刪除評論"}</button>
        </div>
      </article>) : <div className="card muted">暫時未有 AI 回覆評論。</div>}
    </div>
  </section>;
}
