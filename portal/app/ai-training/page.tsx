import PortalShell from "../../components/PortalShell";
import AITrainingPanel from "../../components/AITrainingPanel";
import AITrainingFeedbackHistory from "../../components/AITrainingFeedbackHistory";
import { requireTenant } from "../../lib/tenant";

export default async function AITrainingPage(){
  const { supabase, tenantId }=await requireTenant();

  const [
    {data:guidance},
    {data:feedback},
    {data:settings}
  ]=await Promise.all([
    supabase
      .from("ai_guidance")
      .select("id,guidance,category,is_active,priority,created_at,source_feedback_id")
      .eq("tenant_id",tenantId)
      .order("priority",{ascending:true})
      .order("created_at",{ascending:false}),
    supabase
      .from("ai_feedback")
      .select("id,conversation_id,message_id,comment,created_at")
      .eq("tenant_id",tenantId)
      .not("comment","is",null)
      .order("created_at",{ascending:false})
      .limit(100),
    supabase
      .from("tenant_ai_settings")
      .select("*")
      .eq("tenant_id",tenantId)
      .maybeSingle()
  ]);

  const messageIds=[...new Set((feedback??[]).map(item=>item.message_id))];
  const feedbackIds=[...new Set((feedback??[]).map(item=>item.id))];

  const [{data:messages},{data:feedbackGuidance}]=await Promise.all([
    messageIds.length
      ? supabase
          .from("messages")
          .select("id,content,conversation_id,created_at")
          .in("id",messageIds)
      : Promise.resolve({data:[] as any[]}),
    feedbackIds.length
      ? supabase
          .from("ai_guidance")
          .select("id,source_feedback_id,is_active")
          .eq("tenant_id",tenantId)
          .in("source_feedback_id",feedbackIds)
      : Promise.resolve({data:[] as any[]})
  ]);

  const messageMap=new Map((messages??[]).map(item=>[item.id,item]));
  const guidanceByFeedback=new Map(
    (feedbackGuidance??[]).map(item=>[item.source_feedback_id,item])
  );

  const feedbackForClient=(feedback??[]).map(item=>{
    const message=messageMap.get(item.message_id);
    const linkedGuidance=guidanceByFeedback.get(item.id);

    return {
      id:item.id,
      conversation_id:item.conversation_id,
      message_id:item.message_id,
      comment:item.comment,
      created_at:item.created_at,
      original_message:message?.content??null,
      guidance_id:linkedGuidance?.id??null,
      guidance_active:linkedGuidance?.is_active??null
    };
  });

  return <PortalShell>
    <div className="page-header">
      <div>
        <h1>AI Training</h1>
        <p className="muted">查看團隊對 AI 回覆的評論、管理已學習指引，以及預覽這些規則如何影響 AI。</p>
      </div>
      <span className="pill">{(guidance??[]).filter(item=>item.is_active).length} 條有效指引</span>
    </div>

    <AITrainingPanel
      tenantId={tenantId}
      initialGuidance={guidance??[]}
      settings={settings}
    />

    <AITrainingFeedbackHistory
      tenantId={tenantId}
      initialFeedback={feedbackForClient}
    />
  </PortalShell>;
}
