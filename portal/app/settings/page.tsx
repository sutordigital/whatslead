import PortalShell from "../../components/PortalShell";
import AISettingsForm from "../../components/AISettingsForm";
import BookingSettingsForm from "../../components/BookingSettingsForm";
import { requireTenant } from "../../lib/tenant";

export default async function SettingsPage(){
  const { supabase, tenantId }=await requireTenant();

  const { data: settings }=await supabase
    .from("tenant_ai_settings")
    .select("*")
    .eq("tenant_id",tenantId)
    .maybeSingle();

  const [{ data: account }, { data: bookingSettings }] = await Promise.all([
    supabase
      .from("whatsapp_accounts")
      .select("display_number,status,waba_id,phone_number_id")
      .eq("tenant_id",tenantId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tenant_booking_settings")
      .select("*")
      .eq("tenant_id",tenantId)
      .maybeSingle()
  ]);

  return <PortalShell>
    <div className="page-header">
      <div>
        <h1>設定</h1>
        <p className="muted">管理 WhatsApp 連接、AI 回覆方式及預約設定。</p>
      </div>
    </div>

    <div className="card">
      <div className="row">
        <div>
          <h2 style={{marginTop:0}}>WhatsApp Business</h2>
          {account
            ? <>
                <div><strong>{account.display_number||account.phone_number_id}</strong></div>
                <div className="muted">狀態：{account.status}</div>
              </>
            : <div className="muted">尚未連接 WhatsApp Business 帳戶。</div>}
        </div>

        <a className="btn" href="/api/meta/embedded-signup/start">
          {account ? "重新連接 WhatsApp" : "連接 WhatsApp"}
        </a>
      </div>
    </div>

    <h2>AI 設定</h2>
    <AISettingsForm tenantId={tenantId} initial={settings}/>

    <h2>預約設定</h2>
    <BookingSettingsForm tenantId={tenantId} initial={bookingSettings}/>
  </PortalShell>;
}
