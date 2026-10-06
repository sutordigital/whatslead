import PortalShell from "../../components/PortalShell";
import AISettingsForm from "../../components/AISettingsForm";
import { requireTenant } from "../../lib/tenant";

export default async function SettingsPage(){
  const { supabase, tenantId }=await requireTenant();
  const { data: settings }=await supabase.from("tenant_ai_settings").select("*").eq("tenant_id",tenantId).maybeSingle();
  const { data: account }=await supabase.from("whatsapp_accounts").select("display_number,status,waba_id,phone_number_id").eq("tenant_id",tenantId).limit(1).maybeSingle();
  return <PortalShell><h1>Settings</h1><p className="muted">Configure this tenant's AI behaviour. The WhatsApp connection is read-only for the MVP.</p><div className="card"><h2>WhatsApp Business</h2>{account?<><div>{account.display_number||account.phone_number_id}</div><div className="muted">Status: {account.status} · WABA: {account.waba_id}</div></>:<div className="muted">No WhatsApp account connected.</div>}</div><h2>AI settings</h2><AISettingsForm tenantId={tenantId} initial={settings}/></PortalShell>;
}
