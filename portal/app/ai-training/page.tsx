import PortalShell from "../../components/PortalShell";
import AITrainingPanel from "../../components/AITrainingPanel";
import { requireTenant } from "../../lib/tenant";

function feedbackLabel(value:string){
  if(value==="positive") return "👍 好";
  if(value==="negative") return "👎 需要改善";
  return "💬 評論";
}

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
      .select("id,conversation_id,message_id,feedback_type,comment,created_at")
      .eq("tenant_id",tenantId)
      .order("created_at",{ascending:false})
      .limit(100),
    supabase
      .from("tenant_ai_settings")
      .select("*")
      .eq("tenant_id",tenantId)
      .maybeSingle()
  ]);

  const messageIds=[...new Set((feedback??[]).map(item=>item.message_id))];
  const {data:messages}=messageIds.length
    ? await supabase
        .from("messages")
        .select("id,content,conversation_id,created_at")
        .in("id",messageIds)
    : {data:[] as any[]};

  const messageMap=new Map((messages??[]).map(item=>[item.id,item]));

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

    <section className="ai-feedback-history">
      <div className="row ai-training-section-head">
        <div>
          <h2>AI 回覆評論紀錄</h2>
          <p className="muted">每一條評論都保留對應 AI 回覆，方便客戶理解 AI 點樣被調整。</p>
        </div>
        <span className="pill">{feedback?.length??0} 條評論</span>
      </div>

      <div className="ai-feedback-history-list">
        {(feedback??[]).length ? (feedback??[]).map(item=>{
          const message=messageMap.get(item.message_id);
          return <article className="card ai-feedback-history-item" key={item.id}>
            <div className="ai-feedback-history-top">
              <span className="mini-pill blue">{feedbackLabel(item.feedback_type)}</span>
              <small className="muted">{new Date(item.created_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"})}</small>
            </div>

            <div className="ai-feedback-original">
              <span>原本 AI 回覆</span>
              <p>{message?.content||"無法載入原本訊息"}</p>
            </div>

            <div className="ai-feedback-comment">
              <span>團隊評論</span>
              <p>{item.comment||"沒有文字評論。"}</p>
            </div>

            <div>
              <a className="text-link" href={"/conversations/"+item.conversation_id}>查看原本對話 →</a>
            </div>
          </article>;
        }) : <div className="card muted">暫時未有 AI 回覆評論。</div>}
      </div>
    </section>
  </PortalShell>;
}
