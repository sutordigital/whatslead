"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">WhatsLead</div>
      <nav className="nav">
        <Link href="/dashboard">總覽</Link>
        <Link href="/conversations">對話紀錄</Link>
        <Link href="/leads">潛在客戶</Link>
        <Link href="/settings">設定</Link>
        <button className="btn" onClick={logout}>登出</button>
      </nav>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
