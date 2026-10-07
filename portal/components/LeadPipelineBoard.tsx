"use client";

import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { createClient } from "../lib/supabase/client";

type Lead = {
  id:string;
  contact_id:string;
  conversation_id:string;
  reason:string|null;
  lead_status:string;
  summary:string|null;
  status:string;
  created_at:string;
  updated_at:string;
};

type Contact = {
  id:string;
  display_name:string|null;
  phone_number:string|null;
};

const columns = [
  {id:"pending",label:"待跟進",hint:"AI 已識別，需要人工處理"},
  {id:"contacted",label:"已聯絡",hint:"團隊已開始跟進"},
  {id:"resolved",label:"已完成",hint:"已完成跟進"},
  {id:"cancelled",label:"已取消",hint:"毋須再跟進"}
];

function leadLabel(value:string){
  if(value==="high_potential") return "高潛力";
  if(value==="potential") return "有潛力";
  return "初步查詢";
}

function leadClass(value:string){
  if(value==="high_potential") return "high";
  if(value==="potential") return "medium";
  return "early";
}

export default function LeadPipelineBoard({
  tenantId,
  initialLeads,
  contacts
}:{
  tenantId:string;
  initialLeads:Lead[];
  contacts:Contact[];
}){
  const [leads,setLeads]=useState(initialLeads);
  const [draggingId,setDraggingId]=useState<string|null>(null);
  const [savingId,setSavingId]=useState<string|null>(null);
  const contactMap=useMemo(()=>new Map(contacts.map(c=>[c.id,c])),[contacts]);

  async function moveLead(id:string,nextStatus:string){
    const current=leads.find(l=>l.id===id);
    if(!current || current.status===nextStatus) return;

    setSavingId(id);
    setLeads(prev=>prev.map(l=>l.id===id?{...l,status:nextStatus}:l));

    const {error}=await createClient()
      .from("handoffs")
      .update({status:nextStatus,updated_at:new Date().toISOString()})
      .eq("id",id)
      .eq("tenant_id",tenantId);

    if(error){
      setLeads(prev=>prev.map(l=>l.id===id?{...l,status:current.status}:l));
    }
    setSavingId(null);
  }

  function drop(event:DragEvent<HTMLElement>,status:string){
    event.preventDefault();
    if(draggingId) moveLead(draggingId,status);
    setDraggingId(null);
  }

  return <div className="lead-pipeline-shell">
    <div className="lead-pipeline-board">
      {columns.map(column=>{
        const columnLeads=leads.filter(l=>l.status===column.id);
        return <section
          className="lead-pipeline-column"
          key={column.id}
          onDragOver={event=>event.preventDefault()}
          onDrop={event=>drop(event,column.id)}
        >
          <div className="lead-pipeline-column-head">
            <div>
              <div className="lead-pipeline-title-row">
                <h2>{column.label}</h2>
                <span className="lead-pipeline-count">{columnLeads.length}</span>
              </div>
              <p>{column.hint}</p>
            </div>
          </div>

          <div className="lead-pipeline-cards">
            {columnLeads.length ? columnLeads.map(lead=>{
              const contact=contactMap.get(lead.contact_id);
              return <article
                className={"lead-pipeline-card "+(savingId===lead.id?"saving":"")}
                key={lead.id}
                draggable
                onDragStart={()=>setDraggingId(lead.id)}
                onDragEnd={()=>setDraggingId(null)}
              >
                <div className="lead-pipeline-card-top">
                  <div>
                    <strong>{contact?.display_name||contact?.phone_number||"潛在客戶"}</strong>
                    <span>{contact?.phone_number}</span>
                  </div>
                  <span className={"lead-potential-pill "+leadClass(lead.lead_status)}>
                    {leadLabel(lead.lead_status)}
                  </span>
                </div>

                <p className="lead-pipeline-summary">{lead.summary||"暫未有摘要。"}</p>

                {lead.reason ? <div className="lead-pipeline-reason">
                  <span>跟進原因</span>
                  <p>{lead.reason}</p>
                </div> : null}

                <div className="lead-pipeline-card-footer">
                  <select
                    className="input lead-stage-select"
                    value={lead.status}
                    disabled={savingId===lead.id}
                    onChange={e=>moveLead(lead.id,e.target.value)}
                  >
                    <option value="pending">待跟進</option>
                    <option value="contacted">已聯絡</option>
                    <option value="resolved">已完成</option>
                    <option value="cancelled">已取消</option>
                  </select>
                  <a className="text-link" href={"/conversations/"+lead.conversation_id}>查看對話 →</a>
                </div>
              </article>;
            }) : <div className="lead-pipeline-empty">拖放潛在客戶到呢度</div>}
          </div>
        </section>;
      })}
    </div>
  </div>;
}
