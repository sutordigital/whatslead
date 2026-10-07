"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../lib/supabase/client";

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
  const [feedbackType,setFeedbackType]=useState<"positive"|"negative"|"comment">("comment");
  const [comment,setComment]=useState("");
  const [applyAsGuidance,setApplyAsGuidance]=useState(true);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");

  async function save(event:FormEvent){
    event.preventDefault();
    if(!comment.trim() && feedbackType==="comment") return;

    setSaving(true);
    setError("");
    setSaved(false);

    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();

    const {data:feedback,error:feedbackError}=await supabase
      .from("ai_feedback")
      .insert({
        tenant_id:tenantId,
        conversation_id:conversationId,
        message_id:messageId,
        feedback_type:feedbackType,
        comment:comment.trim()||null,
        created_by_user_id:user?.id??null
      })
      .select("id")
      .single();

    if(feedbackError){
      setError(feedbackError.message);
      setSaving(false);
      return;
    }

    if(applyAsGuidance && comment.trim()){
      const {error:guidanceError}=await supabase
        .from("ai_guidance")
        .insert({
          tenant_id:tenantId,
          source_feedback_id:feedback.id,
          guidance:comment.trim(),
          category:"message_feedback",
          is_active:true,
          priority:100,
          created_by_user_id:user?.id??null
        });

      if(guidanceError){
        setError("Feedback saved, but guidance failed: "+guidanceError.message);
        setSaving(false);
        return;
      }
    }

    setSaved(true);
    setSaving(false);
    setTimeout(()=>{
      setOpen(false);
      setSaved(false);
      setComment("");
      setFeedbackType("comment");
      setApplyAsGuidance(true);
    },900);
  }

  if(!open){
    return <div className="ai-feedback-actions">
      <button type="button" onClick={()=>{setFeedbackType("positive");setOpen(true);}}>👍 好</button>
      <button type="button" onClick={()=>{setFeedbackType("negative");setOpen(true);}}>👎 改善</button>
      <button type="button" onClick={()=>{setFeedbackType("comment");setOpen(true);}}>評論 AI 回覆</button>
    </div>;
  }

  return <form className="ai-feedback-box" onSubmit={save}>
    <div className="ai-feedback-head">
      <strong>評論 AI 回覆</strong>
      <button type="button" className="ai-feedback-close" onClick={()=>setOpen(false)}>×</button>
    </div>

    <div className="ai-feedback-rating">
      <button
        type="button"
        className={feedbackType==="positive"?"active":""}
        onClick={()=>setFeedbackType("positive")}
      >👍 好</button>
      <button
        type="button"
        className={feedbackType==="negative"?"active":""}
        onClick={()=>setFeedbackType("negative")}
      >👎 需要改善</button>
      <button
        type="button"
        className={feedbackType==="comment"?"active":""}
        onClick={()=>setFeedbackType("comment")}
      >💬 評論</button>
    </div>

    <textarea
      className="input"
      rows={3}
      value={comment}
      onChange={e=>setComment(e.target.value)}
      placeholder="例如：呢類問題應該先問 budget；回覆太長；香港客應該用廣東話口吻..."
    />

    <label className="ai-feedback-guidance">
      <input
        type="checkbox"
        checked={applyAsGuidance}
        onChange={e=>setApplyAsGuidance(e.target.checked)}
      />
      <span>
        <strong>套用為未來 AI 指引</strong>
        <small>之後同一個 workspace 嘅 AI 回覆會參考呢條規則。</small>
      </span>
    </label>

    <div className="ai-feedback-footer">
      <span className={error?"error-note":"muted"}>{error|| (saved?"已儲存 ✓":"")}</span>
      <button className="btn" type="submit" disabled={saving || (!comment.trim() && feedbackType==="comment")}>
        {saving?"儲存中...":"儲存評論"}
      </button>
    </div>
  </form>;
}
