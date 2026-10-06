import PortalShell from "../../components/PortalShell";
import AISettingsForm from "../../components/AISettingsForm";
import { requireTenant } from "../../lib/tenant";

export default async function SettingsPage(){
  const { supabase, tenantId }=await requireTenant();

  const { data: settings }=await supabase
    .from("tenant_ai_settings")
    .select("*")
    .eq("tenant_id",tenantId)
    .maybeSingle();

  const { data: account }=await supabase
    .from("whatsapp_accounts")
    .select("display_number,status,waba_id,phone_number_id")
    .eq("tenant_id",tenantId)
    .limit(1)
    .maybeSingle();

  return <PortalShell>
    <h1>設定</h1>
    <p className="muted">設定這個工作空間的 AI 回覆方式。MVP 階段 WhatsApp 連接資料暫時只供查看。</p>

    <div className="card">
      <h2>WhatsApp Business</h2>
      {account
        ? <>
            <div>{account.display_number||account.phone_number_id}</div>
            <div className="muted">狀態：{account.status} · WABA：{account.waba_id}</div>
          </>
        : <div className="muted">尚未連接 WhatsApp 帳戶。</div>}
    </div>

    <h2>AI 設定</h2>
    <AISettingsForm tenantId={tenantId} initial={settings}/>
  </PortalShell>;
}
