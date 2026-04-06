import Link from "next/link";
import { Panel, PageIntro, StatTile } from "@/components/ui";
import { getGoogleConnectionState } from "@/lib/server/google";
import { getAllProjects, getProjectStats, getUserSetting } from "@/lib/server/repo";
import { requireSessionUser } from "@/lib/server/session";

const featureCards = [
  {
    kicker: "Dashboard",
    title: "Dashboard",
    text: "Overview of your ranking performance with key metrics and trends",
    tone: "info",
  },
  {
    kicker: "Rank Checker",
    title: "Rank Checker",
    text: "Check rankings using multiple SERP APIs with automated syncing",
    tone: "success",
  },
  {
    kicker: "GSC Analytics",
    title: "GSC Analytics",
    text: "Advanced Search Console analytics with cannibalization detection",
    tone: "warning",
  },
  {
    kicker: "Projects",
    title: "Projects",
    text: "Manage your SEO projects and connect to Google Sheets",
    tone: "info",
  },
  {
    kicker: "Keywords",
    title: "Keywords",
    text: "Add, view, and manage keywords for each project",
    tone: "success",
  },
  {
    kicker: "Cannibalization",
    title: "Cannibalization",
    text: "Track and resolve keyword cannibalization issues",
    tone: "danger",
  },
] as const;

const quickActions: Array<{ href: string; label: string; secondary?: boolean }> = [
  { href: "/dashboard", label: "View Dashboard" },
  { href: "/project-dashboard", label: "Check Rankings" },
  { href: "/project-dashboard", label: "Cannibalization" },
  { href: "/settings", label: "Settings", secondary: true },
];

export default async function ToolDetailsPage() {
  const user = await requireSessionUser();
  const projects = getAllProjects(false);
  const totals = projects.reduce(
    (acc, project) => {
      const stats = getProjectStats(project.id);
      acc.keywords += stats.total_keywords;
      return acc;
    },
    { keywords: 0 },
  );

  let apisConfigured = 0;
  if (getUserSetting(user.id, "serper_api_key", false)) apisConfigured += 1;
  if (getUserSetting(user.id, "dataforseo_username", false) && getUserSetting(user.id, "dataforseo_password", false)) apisConfigured += 1;
  if (getUserSetting(user.id, "scrapingrobot_api_key", false)) apisConfigured += 1;

  const googleState = getGoogleConnectionState(user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="SEO Rank Tracker"
        subtitle="Track and analyze your website's search engine rankings across multiple projects"
      />

      <Panel title="Features" description="Everything you need to track and improve your SEO performance">
        <div className="surface-grid-3">
          {featureCards.map((card) => (
            <div key={card.title} className="modern-card">
              <div style={{ fontSize: "0.9rem", marginBottom: "12px", color: "var(--text-muted)" }}>
                {card.kicker.toUpperCase()}
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                {card.title}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "12px" }}>{card.text}</p>
              <span className={`badge badge-${card.tone}`}>
                {card.tone === "info"
                  ? "Analytics"
                  : card.tone === "success"
                    ? "Automated"
                    : card.tone === "warning"
                      ? "Advanced"
                      : "SEO Health"}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Quick Start Guide" description="Get started in 3 easy steps">
        <div className="glass-card" style={{ margin: "1rem 0" }}>
          <div className="timeline-item">
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", marginBottom: "8px" }}>
              Step 1: Set up API credentials
            </div>
            <div style={{ color: "var(--text-muted)", marginBottom: "12px" }}>
              - Configure at least one SERP API (Serper.dev, DataForSEO, or ScrapingRobot)
              <br />- Upload Google Sheets service account credentials (optional)
              <br />- Connect Google Search Console for advanced analytics
            </div>
          </div>

          <div className="timeline-item">
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", marginBottom: "8px" }}>
              Step 2: Review and Configure Projects
            </div>
            <div style={{ color: "var(--text-muted)", marginBottom: "12px" }}>
              - Create your first project or edit existing ones
              <br />- Link Google Sheets for automatic data syncing
            </div>
          </div>

          <div className="timeline-item" style={{ borderLeft: "none", paddingBottom: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", marginBottom: "8px" }}>
              Step 3: Add Keywords and Check Rankings
            </div>
            <div style={{ color: "var(--text-muted)" }}>
              - Add keywords manually or import from CSV
              <br />- Discover keywords from Google Search Console
              <br />- Start checking rankings with automated syncing
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Current Status" description="Overview of your SEO tracking setup">
        <div className="metric-strip">
          <StatTile label="Total Projects" value={String(projects.length)} detail="Active and inactive" />
          <StatTile label="Total Keywords" value={String(totals.keywords)} detail="Across all projects" />
          <StatTile label="APIs Configured" value={`${apisConfigured}/3`} detail="SERP API providers" />
          <StatTile
            label="GSC Status"
            value={googleState.gscOauthConnected ? "Connected" : "Not Connected"}
            detail="Search Console"
          />
        </div>
      </Panel>

      <Panel title="Quick Actions" description="Navigate to commonly used features">
        <div className="toolbar-actions">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={action.secondary ? "button-link button-secondary" : "button-link"}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </Panel>

      <Panel title="Resources" description="Helpful links and documentation">
        <div className="surface-grid-2">
          <div className="modern-card">
            <h4 style={{ fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>API Providers</h4>
            <div style={{ color: "var(--text-muted)", fontSize: "0.875rem", lineHeight: 1.8 }}>
              - <a href="https://serper.dev" target="_blank" rel="noreferrer">Serper.dev</a> - Simple and affordable SERP API
              <br />- <a href="https://dataforseo.com" target="_blank" rel="noreferrer">DataForSEO</a> - Enterprise SERP API
              <br />- <a href="https://scrapingrobot.com" target="_blank" rel="noreferrer">ScrapingRobot</a> - Web scraping API
            </div>
          </div>

          <div className="modern-card">
            <h4 style={{ fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>Google Services</h4>
            <div style={{ color: "var(--text-muted)", fontSize: "0.875rem", lineHeight: 1.8 }}>
              - <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">Google Cloud Console</a> - For service account setup
              <br />- <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Search Console</a> - Track search performance
              <br />- <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noreferrer">Google Sheets</a> - Data visualization
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
