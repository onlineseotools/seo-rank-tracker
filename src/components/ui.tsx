import Link from "next/link";
import { ReactNode } from "react";

type PanelProps = {
  title?: string;
  kicker?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function PageIntro({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="page-header">
      <div className="page-header__content">
        {badge ? <div className="card-kicker">{badge}</div> : null}
        <div className="page-title">{title}</div>
        <div className="page-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="stat-card">
      <div className="card-kicker">{label}</div>
      <div className="card-value">{value}</div>
      <div className="card-subtitle">{detail}</div>
    </div>
  );
}

export function Panel({ title, kicker, description, children, className = "" }: PanelProps) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(title || kicker || description) && (
        <div className="section-header">
          {title ? <div className="section-title">{title}</div> : null}
          {description ? <div className="section-subtitle">{description}</div> : null}
          {!title && kicker ? <div className="section-subtitle">{kicker}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function SubPanel({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="sub-panel">
      {title ? <div className="sub-panel-title">{title}</div> : null}
      {description ? <div className="sub-panel-subtitle">{description}</div> : null}
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function SidebarLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  const iconLabel = icon === "00" ? "i" : icon;
  return (
    <Link href={href} data-active={active} className="nav-card">
      <span className="nav-icon">{iconLabel}</span>
      <span className="nav-card__label">{label}</span>
    </Link>
  );
}

export function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={`tab-link ${active ? "is-active" : ""}`}>
      {label}
    </Link>
  );
}

export function Badge({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "danger" | "muted";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function DataTable({
  headers,
  rows,
  className = "",
}: {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
}) {
  return (
    <div className={`data-table-wrap ${className}`.trim()}>
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${index}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionList({ items }: { items: string[] }) {
  return (
    <div className="section-list">
      {items.map((item) => (
        <div key={item} className="section-list__item">
          {item}
        </div>
      ))}
    </div>
  );
}

export function InfoBox({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "error";
}) {
  return (
    <div className={`info-box info-box--${tone}`}>
      <div className="info-box-content">{children}</div>
    </div>
  );
}

export function AppFooter() {
  return (
    <div className="app-footer">
      <div className="app-footer-card">
        <div className="app-footer-title">SEO Rank Tracker</div>
        <div className="app-footer-subtitle">Built with Next.js on Vercel | Streamlit UI parity edition</div>
      </div>
    </div>
  );
}
