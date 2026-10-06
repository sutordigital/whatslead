"use client";
import { useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function LeadStatusSelect({id,initial}:{id:string;initial:string}){
  const [status,setStatus]=useState(initial); const [saving,setSaving]=useState(false);
  async function change(next:string){setSaving(true);const {error}=await createClient().from("handoffs").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);if(!error)setStatus(next);setSaving(false);}
  return <select className="input" style={{width:"auto"}} value={status} disabled={saving} onChange={e=>change(e.target.value)}><option value="pending">Pending</option><option value="contacted">Contacted</option><option value="resolved">Resolved</option><option value="cancelled">Cancelled</option></select>;
}
