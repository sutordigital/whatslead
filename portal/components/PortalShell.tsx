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
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/conversations">Conversations</Link>
        <Link href="/leads">Leads</Link>
        <Link href="/settings">Settings</Link>
        <button className="btn" onClick={logout}>Logout</button>
      </nav>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
