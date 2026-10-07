"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import {
  TenantEntitlementProvider,
  useTenantEntitlement
} from "./TenantEntitlementProvider";

const navItems = [
  { href: "/dashboard", label: "總覽" },
  { href: "/conversations", label: "對話紀錄" },
  { href: "/leads", label: "接手管理" },
  { href: "/bookings", label: "預約" },
  { href: "/ai-training", label: "AI Training" },
  { href: "/billing", label: "方案及帳單" },
  { href: "/settings", label: "設定" }
];

function PortalShellContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const entitlement = useTenantEntitlement();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const showTrialWarning =
    entitlement.status === "trialing" &&
    entitlement.daysRemaining !== null &&
    entitlement.daysRemaining <= 7;

  const expired =
    ["expired", "past_due", "cancelled"].includes(entitlement.status) &&
    !entitlement.canUseAutomation;

  let sidebarTitle = "WhatsLead 工作空間";
  let sidebarCopy = "AI + WhatsApp 客戶管理";

  if (!entitlement.loading) {
    if (entitlement.status === "trialing") {
      sidebarTitle = "30 日免費試用";
      sidebarCopy = "尚餘 " + (entitlement.daysRemaining ?? 0) + " 日";
    } else if (entitlement.status === "not_started") {
      sidebarTitle = "30 日免費試用";
      sidebarCopy = "連接 WhatsApp 後開始";
    } else if (entitlement.status === "active") {
      sidebarTitle = "WhatsLead 已啟用";
      sidebarCopy = entitlement.plan || "付費方案";
    } else if (expired) {
      sidebarTitle = "試用已結束";
      sidebarCopy = "升級後立即恢復自動化";
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-wrap">
          <div className="portal-brand-mark" aria-hidden="true">W</div>
          <div>
            <div className="brand">
              Whats<span>Lead</span>
            </div>
            <div className="brand-sub">by Sutor Digital</div>
          </div>
        </Link>

        <nav className="nav">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "active" : ""}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link
            href="/billing"
            className={"workspace-badge trial-workspace-badge " + (expired ? "expired" : showTrialWarning ? "warning" : "")}
          >
            <div className="workspace-dot" />
            <div>
              <strong>{sidebarTitle}</strong>
              <span>{sidebarCopy}</span>
            </div>
          </Link>
          <button className="logout-btn" onClick={logout}>登出</button>
        </div>
      </aside>

      <main className="main">
        {expired ? (
          <div className="trial-banner expired">
            <div>
              <strong>免費試用已結束</strong>
              <span>你的資料及對話紀錄仍然保留，但 AI 自動回覆、CRM 傳送及其他自動化功能已暫停。</span>
            </div>
            <Link href="/billing" className="btn">升級 WhatsLead</Link>
          </div>
        ) : showTrialWarning ? (
          <div className="trial-banner warning">
            <div>
              <strong>免費試用尚餘 {entitlement.daysRemaining} 日</strong>
              <span>升級後可以繼續使用 AI 自動回覆、接手管理及預約功能。</span>
            </div>
            <Link href="/billing" className="btn">查看方案</Link>
          </div>
        ) : null}

        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <TenantEntitlementProvider>
      <PortalShellContent>{children}</PortalShellContent>
    </TenantEntitlementProvider>
  );
}
