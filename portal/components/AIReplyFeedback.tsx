"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

type FeedbackItem = {
  id:string;
  comment:string|null;
  created_at:string;
  guidance:{
    id:string;
    is_active:boolean;
    guidance:string;
  }|null;
};

export default function AIReplyFeedback({
  tenantId,
  conversationId,
  messageId
}:{
  tenantId:string;
  conversationId:string;
  messageId:string;
}){
  const [open,setOpen]=useState(false);
  const [comment,setComment]=useState("");
  const [applyAsGuidance,setApplyAsGuidance]=useState(true);
  const [saving,setSaving]=useState(false);
  const [loadingHistory,setLoadingHistory]=useState(true);
  const [feedback,setFeedback]=useState<FeedbackItem[]>([]);
  const [error,setError]=useState("");

  async function loadFeedback(){
    setLoadingHistory(true);
    const supabase=createClient();

    const {data:rows,error:feedbackError}=await supabase
      .from("ai_feedback")
      .select("id,comment,created_at")
      .eq("tenant_id",tenantId)
      .eq("message_id",messageId)
      .not("comment","is",null)
      .order("created_at",{ascending:false});

    if(feedbackError){
      setError(feedbackError.message);
      setLoadingHistory(false);
      return;
    }

    const ids=(rows??[]).map(row=>row.id);
    const {data:guidanceRows}=ids.length
      ? await supabase
          .from("ai_guidance")
          .select("id,source_feedback_id,is_active,guidance")
          .eq("tenant_id",tenantId)
          .in("source_feedback_id",ids)
      : {data:[] as any[]};

    const guidanceMap=new Map(
      (guidanceRows??[]).map(row=>[row.source_feedback_id,row])
    );

    setFeedback((rows??[]).map(row=>({
      ...row,
      guidance:guidanceMap.get(row.id)??null
    })));
    setLoadingHistory(false);
  }

  useEffect(()=>{
    loadFeedback();
  },[tenantId,messageId]);

  async function save(event:FormEvent){
    event.preventDefault();
    const cleanComment=comment.trim();
    if(!cleanComment) return;

    setSaving(true);
    setError("");

    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();

    const {data:newFeedback,error:feedbackError}=await supabase
      .from("ai_feedback")
      .insert({
        tenant_id:tenantId,
        conversation_id:conversationId,
        message_id:messageId,
        feedback_type:"comment",
        comment:cleanComment,
        created_by_user_id:user?.id??null
      })
      .select("id")
      .single();

    if(feedbackError){
      setError(feedbackError.message);
      setSaving(false);
      return;
    }

    if(applyAsGuidance){
      const {error:guidanceError}=await supabase
        .from("ai_guidance")
        .insert({
          tenant_id:tenantId,
          source_feedback_id:newFeedback.id,
          guidance:cleanComment,
          category:"message_feedback",
          is_active:true,
          priority:100,
          created_by_user_id:user?.id??null
        });

      if(guidanceError){
        setError("評論已儲存，但 AI 指引建立失敗："+guidanceError.message);
        setSaving(false);
        await loadFeedback();
        return;
      }
    }

    setComment("");
    setSaving(false);
    await loadFeedback();
  }

  async function deleteFeedback(item:FeedbackItem){
    if(!window.confirm("刪除呢條 AI 評論？如果佢已套用為 AI 指引，該指引亦會一併刪除。")) return;

    setError("");
    const supabase=createClient();

    if(item.guidance?.id){
      const {error:guidanceError}=await supabase
        .from("ai_guidance")
        .delete()
        .eq("id",item.guidance.id)
        .eq("tenant_id",tenantId);

      if(guidanceError){
        setError(guidanceError.message);
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
      return;
    }

    setFeedback(prev=>prev.filter(row=>row.id!==item.id));
  }

  return <div className="ai-feedback-wrap">
    <div className="ai-feedback-actions">
      <button type="button" onClick={()=>setOpen(value=>!value)}>
        評論 AI 回覆{feedback.length ? ` · ${feedback.length}` : ""}
      </button>
    </div>

    {feedback.length ? <div className="ai-feedback-existing">
      {feedback.map(item=><div className="ai-feedback-existing-item" key={item.id}>
        <div>
          <strong>{item.comment}</strong>
          <small>
            {new Date(item.created_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"})}
            {item.guidance ? (item.guidance.is_active ? " · 已套用至 AI" : " · AI 指引已停用") : " · 只作評論"}
          </small>
        </div>
        <button
          type="button"
          className="ai-feedback-delete"
          onClick={()=>deleteFeedback(item)}
          aria-label="刪除評論"
        >刪除</button>
      </div>)}
    </div> : null}

    {open ? <form className="ai-feedback-box" onSubmit={save}>
      <div className="ai-feedback-head">
        <div>
          <strong>新增 AI 回覆評論</strong>
          <small className="muted">寫低 AI 下次應該點樣處理類似情況。</small>
        </div>
        <button type="button" className="ai-feedback-close" onClick={()=>setOpen(false)}>×</button>
      </div>

      <textarea
        className="input"
        rows={3}
        value={comment}
        onChange={e=>setComment(e.target.value)}
        placeholder="例如：呢類問題應該先問 budget；回覆太長；香港客應該用自然廣東話..."
      />

      <label className="ai-feedback-guidance">
        <input
          type="checkbox"
          checked={applyAsGuidance}
          onChange={e=>setApplyAsGuidance(e.target.checked)}
        />
        <span>
          <strong>套用為未來 AI 指引</strong>
          <small>開啟後，呢條評論會直接加入 workspace 嘅 AI guidance，影響之後回覆。</small>
        </span>
      </label>

      {error ? <div className="error-note">{error}</div> : null}

      <div className="ai-feedback-footer">
        <span className="muted">
          {loadingHistory ? "載入評論中…" : "只有已套用為 AI 指引的評論先會影響 prompt。"}
        </span>
        <button className="btn" type="submit" disabled={saving || !comment.trim()}>
          {saving?"儲存中...":"儲存評論"}
        </button>
      </div>
    </form> : null}
  </div>;
}
