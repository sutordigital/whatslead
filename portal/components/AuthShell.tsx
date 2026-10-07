import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow?: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
};

const features = [
  {
    icon: "💬",
    title: "統一管理 WhatsApp 對話",
    description: "集中查看客戶查詢、對話紀錄及跟進狀態。"
  },
  {
    icon: "✦",
    title: "AI 自動回覆及篩選",
    description: "即時回覆常見問題，協助辨識高潛力客戶。"
  },
  {
    icon: "↗",
    title: "由查詢變成可跟進商機",
    description: "將對話、潛在客戶及預約放在同一個工作空間。"
  }
];

export default function AuthShell({
  eyebrow = "WhatsApp Lead Management",
  title,
  description,
  children
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-hero">
        <a className="auth-brand" href="/">
          <span className="auth-brand-mark" aria-hidden="true">W</span>
          <span>Whats<span>Lead</span></span>
        </a>

        <div className="auth-hero-content">
          <div className="auth-eyebrow">{eyebrow}</div>
          <h1 className="auth-hero-title">
            將 WhatsApp 查詢，
            <br />
            變成<span>可跟進生意</span>
          </h1>
          <p className="auth-hero-copy">
            集中管理客戶對話、AI 回覆、潛在客戶及預約，讓團隊更快回應及跟進每個機會。
          </p>

          <div className="auth-feature-list">
            {features.map(feature => (
              <div className="auth-feature" key={feature.title}>
                <div className="auth-feature-icon" aria-hidden="true">{feature.icon}</div>
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-hero-footer">
          <span>由 Sutor Digital 打造</span>
          <span>為香港中小企而設</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
