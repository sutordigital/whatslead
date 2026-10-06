"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "總覽" },
  { href: "/conversations", label: "對話紀錄" },
  { href: "/leads", label: "潛在客戶" },
  { href: "/settings", label: "設定" }
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="brand">WhatsLead</div>
            <div className="brand-sub">by Sutor Digital</div>
          </div>
        </div>

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
          <div className="workspace-badge">
            <div className="workspace-dot" />
            <div>
              <strong>WhatsLead Workspace</strong>
              <span>AI + WhatsApp CRM</span>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>登出</button>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}
