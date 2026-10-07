import PortalShell from "../../components/PortalShell";
import { requireTenant } from "../../lib/tenant";

function formatDate(value:string|null){
  if(!value) return "—";
  return new Intl.DateTimeFormat("zh-HK",{
    timeZone:"Asia/Hong_Kong",
    year:"numeric",
    month:"long",
    day:"numeric"
  }).format(new Date(value));
}

function statusLabel(value:string){
  if(value==="trialing") return "免費試用中";
  if(value==="active") return "已啟用";
  if(value==="past_due") return "付款待處理";
  if(value==="expired") return "試用已結束";
  if(value==="cancelled") return "已取消";
  return "尚未開始";
}

export default async function BillingPage(){
  const {supabase,tenantId}=await requireTenant();

  const {data:tenant}=await supabase
    .from("tenants")
    .select("subscription_status,trial_started_at,trial_ends_at,plan,billing_interval,subscription_ends_at")
    .eq("id",tenantId)
    .maybeSingle();

  return <PortalShell>
    <div className="page-header">
      <div>
        <h1>方案及帳單</h1>
        <p className="muted">30 日免費試用由成功連接 WhatsApp 當日開始。試用結束後資料仍會保留，但自動化功能會暫停。</p>
      </div>
      <span className="pill">{statusLabel(tenant?.subscription_status||"not_started")}</span>
    </div>

    <div className="billing-status-card card">
      <div>
        <strong>目前狀態</strong>
        <h2>{statusLabel(tenant?.subscription_status||"not_started")}</h2>
      </div>
      <div className="billing-status-meta">
        <span>試用開始：{formatDate(tenant?.trial_started_at||null)}</span>
        <span>試用完結：{formatDate(tenant?.trial_ends_at||null)}</span>
        {tenant?.plan ? <span>方案：{tenant.plan}</span> : null}
      </div>
    </div>

    <div className="billing-plan-grid">
      <section className="card billing-plan-card">
        <div>
          <div className="billing-plan-kicker">MONTHLY</div>
          <h2>月費方案</h2>
          <div className="billing-price"><strong>HK$688</strong><span>/ 月</span></div>
          <p className="muted">適合想先以較低承擔開始使用 WhatsLead 的公司。</p>
        </div>
        <a className="btn" href="mailto:info@sutor.digital?subject=WhatsLead%20Monthly%20Upgrade">選擇月費方案</a>
      </section>

      <section className="card billing-plan-card featured">
        <div>
          <div className="billing-plan-kicker">YEARLY · 2 MONTHS FREE</div>
          <h2>年費方案</h2>
          <div className="billing-price"><strong>HK$6,880</strong><span>/ 年</span></div>
          <p className="muted">相當於付 10 個月使用 12 個月，適合長期使用。</p>
        </div>
        <a className="btn" href="mailto:info@sutor.digital?subject=WhatsLead%20Yearly%20Upgrade">選擇年費方案</a>
      </section>
    </div>

    <div className="billing-note card">
      <strong>線上付款即將加入</strong>
      <p className="muted">目前先以人工確認方案。之後接入 Stripe 後，客戶可在這裏直接付款、轉方案、更新信用卡及管理續費。</p>
    </div>
  </PortalShell>;
}
