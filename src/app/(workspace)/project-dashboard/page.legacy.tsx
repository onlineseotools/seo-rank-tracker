import { ProjectPicker } from "@/components/project-picker";
import { Panel, PageIntro, Pill, StatTile } from "@/components/ui";
import {
  addKeywordsAction,
  createProjectSheetAction,
  deleteProjectSheetAction,
  fetchLiveGscAction,
  markCannibalizationAction,
  runRankCheckAction,
  syncCannibalizationSheetAction,
  syncGscSheetAction,
  syncRankingsSheetAction,
  updateProjectAction,
} from "@/lib/server/actions";
import { detectCannibalization, findOpportunities } from "@/lib/server/analytics";
import { resolveProjectContext } from "@/lib/server/project-context";
import {
  getGscQueries,
  getLatestRankCheckFailures,
  getProjectStats,
  getRankingsByProject,
  getResolvedCannibalization,
  getSyncLogs,
} from "@/lib/server/repo";
import { requireSessionUser } from "@/lib/server/session";

function getDateRange(days: number) {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default async function ProjectDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const { projects, project } = await resolveProjectContext(user, searchParams, false);

  if (!project) {
    return (
      <div className="project-workspace">
        <PageIntro title="Project Dashboard" subtitle="Select a project to load the unified workspace." badge="Project Dashboard" />
        <Panel kicker="Projects" title="No project selected" description="Create or select a project first.">
          <ProjectPicker projects={projects} selectedProjectId={null} />
        </Panel>
      </div>
    );
  }

  const stats = getProjectStats(project.id);
  const rankings = getRankingsByProject(project.id, true);
  const failures = getLatestRankCheckFailures(project.id);
  const gscRows = getGscQueries(project.id);
  const opportunities = findOpportunities(gscRows).slice(0, 8);
  const resolved = new Set(getResolvedCannibalization(project.id).map((item) => item.keyword));
  const cannibalization = detectCannibalization(gscRows).map((item) => ({
    ...item,
    severity: resolved.has(item.query) ? "Resolved" : item.num_pages > 2 ? "High" : "Medium",
  }));
  const logs = getSyncLogs(project.id, 8);
  const dateRange = getDateRange(28);

  return (
    <div className="project-workspace">
      <PageIntro
        title={`${project.name} workspace`}
        subtitle="Monitor rankings, Search Console imports, sheet sync, and project settings from one workspace."
        badge="Project Dashboard"
      />

      <Panel kicker="Scope" title="Project selection" description="Switch project variants without leaving the unified dashboard.">
        <ProjectPicker projects={projects} selectedProjectId={project.id} />
      </Panel>

      <div className="metric-strip dashboard-metric-strip">
        <StatTile label="Keywords" value={String(stats.total_keywords)} detail="Tracked in this project" />
        <StatTile
          label="Average position"
          value={stats.average_position === null ? "-" : String(stats.average_position)}
          detail="Latest ranking average"
        />
        <StatTile label="Top 10" value={String(stats.top_10_count)} detail="Keywords inside page one clusters" />
        <StatTile label="GSC rows" value={String(gscRows.length)} detail="Stored Search Console query rows" />
      </div>

      <div className="surface-grid-2 dashboard-workspace-grid">
        <Panel kicker="Keywords" title="Add tracked keywords" description="Bulk-add keywords directly inside the project dashboard.">
          <form action={addKeywordsAction} className="workspace-form">
            <input type="hidden" name="project_id" value={project.id} />
            <label className="workspace-form__field">
              <span className="eyebrow">Keywords</span>
              <textarea
                name="keywords"
                className="workspace-textarea dashboard-keywords-textarea"
                placeholder={"keyword one\nkeyword two\nkeyword three"}
              />
            </label>
            <div className="toolbar-actions">
              <button type="submit">Add Keywords</button>
            </div>
          </form>
        </Panel>

        <Panel kicker="Rank checker" title="Run a project check" description="Launch a live rank check for the selected project and review the latest failure queue.">
          <form action={runRankCheckAction} className="workspace-form">
            <input type="hidden" name="project_id" value={project.id} />
            <label className="workspace-form__field">
              <span className="eyebrow">SERP provider</span>
              <select name="api_type" defaultValue="serper">
                <option value="serper">Serper.dev</option>
                <option value="dataforseo">DataForSEO</option>
                <option value="scrapingrobot">ScrapingRobot</option>
              </select>
            </label>
            <div className="toolbar-actions">
              <button type="submit">Run Rank Check</button>
            </div>
          </form>
          <div className="workspace-feed">
            {failures.slice(0, 5).map((failure) => (
              <div key={failure.keyword} className="workspace-feed-item">
                <div className="workspace-feed-item__title">{failure.keyword}</div>
                <div className="workspace-feed-item__meta">{failure.error_message}</div>
              </div>
            ))}
            {!failures.length ? <div className="workspace-feed-empty">No recent failures.</div> : null}
          </div>
        </Panel>
      </div>

      <div className="surface-grid-2 dashboard-workspace-grid">
        <Panel kicker="Search Console" title="Fetch current period and opportunities" description="Pull a fresh 28-day Search Console window into the project store and review high-impression opportunities.">
          <form action={fetchLiveGscAction} className="workspace-form">
            <input type="hidden" name="project_id" value={project.id} />
            <label className="workspace-form__field">
              <span className="eyebrow">Property</span>
              <input name="property" defaultValue={project.gsc_property ?? ""} placeholder="https://example.com/" />
            </label>
            <div className="surface-grid-2 dashboard-date-grid">
              <label className="workspace-form__field">
                <span className="eyebrow">Start date</span>
                <input type="date" name="start_date" defaultValue={dateRange.start} />
              </label>
              <label className="workspace-form__field">
                <span className="eyebrow">End date</span>
                <input type="date" name="end_date" defaultValue={dateRange.end} />
              </label>
            </div>
            <label className="workspace-toggle">
              <span className="workspace-toggle__control">
                <input type="checkbox" name="include_page" defaultChecked />
              </span>
              <span className="workspace-toggle__label">Include page dimension for cannibalization and page analysis</span>
            </label>
            <div className="toolbar-actions">
              <button type="submit">Fetch Search Console Data</button>
            </div>
          </form>
          <div className="workspace-feed">
            {opportunities.map((item) => (
              <div key={`${item.query}-${item.page_url ?? "page"}`} className="workspace-feed-item">
                <div className="workspace-feed-item__title">{item.query}</div>
                <div className="workspace-feed-item__meta">
                  {item.impressions} impressions • position {item.position.toFixed(1)} • CTR {(item.ctr * 100).toFixed(1)}%
                </div>
                {item.page_url ? <div className="workspace-feed-item__meta">{item.page_url}</div> : null}
              </div>
            ))}
            {!opportunities.length ? <div className="workspace-feed-empty">No stored opportunities yet.</div> : null}
          </div>
        </Panel>

        <Panel kicker="Google Sheets" title="Create and sync the project sheet" description="Mirror the original export workflow for rankings, GSC data, and cannibalization summaries.">
          <div className="dashboard-sheet-actions">
            {project.google_sheet_url ? (
              <a
                href={project.google_sheet_url}
                target="_blank"
                rel="noreferrer"
                className="dashboard-action dashboard-action--secondary dashboard-action--link"
              >
                Open linked Google Sheet
              </a>
            ) : null}
            <form action={createProjectSheetAction}>
              <input type="hidden" name="project_id" value={project.id} />
              <button type="submit" className="dashboard-action dashboard-action--primary">
                Create or Relink Project Sheet
              </button>
            </form>
            <form action={syncRankingsSheetAction}>
              <input type="hidden" name="project_id" value={project.id} />
              <button type="submit" className="dashboard-action dashboard-action--secondary">
                Sync Rankings
              </button>
            </form>
            <form action={syncGscSheetAction}>
              <input type="hidden" name="project_id" value={project.id} />
              <button type="submit" className="dashboard-action dashboard-action--secondary">
                Sync GSC Queries
              </button>
            </form>
            <form action={syncCannibalizationSheetAction}>
              <input type="hidden" name="project_id" value={project.id} />
              <button type="submit" className="dashboard-action dashboard-action--secondary">
                Sync Cannibalization
              </button>
            </form>
            <form action={deleteProjectSheetAction}>
              <input type="hidden" name="project_id" value={project.id} />
              <button type="submit" className="dashboard-action dashboard-action--danger">
                Delete Linked Sheet
              </button>
            </form>
          </div>
        </Panel>
      </div>

      <div className="surface-grid-2 dashboard-workspace-grid">
        <Panel kicker="Stored rankings" title="Current keyword table" description="Latest ranking rows from the migrated SQLite tracker.">
          <div className="workspace-feed">
            {rankings.slice(0, 12).map((row) => (
              <div key={row.keyword} className="workspace-feed-item">
                <div className="workspace-feed-item__top">
                  <div className="workspace-feed-item__body">
                    <div className="workspace-feed-item__title">{row.keyword}</div>
                    <div className="workspace-feed-item__meta">{row.url_found ?? "No ranking URL yet"}</div>
                  </div>
                  <Pill tone={typeof row.position === "number" ? "success" : "warning"}>{row.position ?? "NR"}</Pill>
                </div>
              </div>
            ))}
            {!rankings.length ? <div className="workspace-feed-empty">No stored rankings yet.</div> : null}
          </div>
        </Panel>

        <Panel kicker="Cannibalization" title="Resolve tracked conflicts" description="Mark stored cannibalization cases resolved or active again.">
          <div className="workspace-feed">
            {cannibalization.slice(0, 8).map((item) => (
              <div key={item.query} className="workspace-feed-item">
                <div className="workspace-feed-item__top">
                  <div className="workspace-feed-item__body">
                    <div className="workspace-feed-item__title">{item.query}</div>
                    <div className="workspace-feed-item__meta">{item.primary_page}</div>
                    <div className="workspace-feed-item__meta">{item.num_pages} competing pages detected</div>
                  </div>
                  <Pill tone={item.severity === "Resolved" ? "success" : item.severity === "High" ? "danger" : "warning"}>{item.severity}</Pill>
                </div>
                <form action={markCannibalizationAction} className="workspace-feed-item__action">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="keyword" value={item.query} />
                  <input type="hidden" name="mode" value={item.severity === "Resolved" ? "unresolve" : "resolve"} />
                  <button type="submit" className="button-secondary">
                    {item.severity === "Resolved" ? "Mark Active Again" : "Mark Resolved"}
                  </button>
                </form>
              </div>
            ))}
            {!cannibalization.length ? <div className="workspace-feed-empty">No stored cannibalization cases yet.</div> : null}
          </div>
        </Panel>
      </div>

      <Panel kicker="Project settings" title="Update this project" description="Edit name, location, cadence, GSC property, and active status from the unified workspace.">
        <form action={updateProjectAction} className="workspace-form">
          <input type="hidden" name="id" value={project.id} />
          <div className="surface-grid-3 workspace-settings-grid">
            <label className="workspace-form__field">
              <span className="eyebrow">Project name</span>
              <input name="name" defaultValue={project.name} />
            </label>
            <label className="workspace-form__field">
              <span className="eyebrow">Website URL</span>
              <input name="url" defaultValue={project.url} />
            </label>
            <label className="workspace-form__field">
              <span className="eyebrow">Target location</span>
              <input name="target_location" defaultValue={project.target_location} />
            </label>
            <label className="workspace-form__field">
              <span className="eyebrow">GSC property</span>
              <input name="gsc_property" defaultValue={project.gsc_property ?? ""} />
            </label>
            <label className="workspace-form__field">
              <span className="eyebrow">Update frequency</span>
              <select name="update_frequency" defaultValue={project.update_frequency}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="workspace-form__field">
              <span className="eyebrow">Status</span>
              <span className="workspace-toggle workspace-toggle--surface">
                <span className="workspace-toggle__control">
                  <input type="checkbox" name="is_active" defaultChecked={Boolean(project.is_active)} />
                </span>
                <span className="workspace-toggle__label">Active project</span>
              </span>
            </label>
          </div>
          <div className="toolbar-actions">
            <button type="submit">Save Project Settings</button>
          </div>
        </form>
      </Panel>

      <Panel kicker="Activity" title="Recent project log" description="Latest sync and export events for this project.">
        <div className="workspace-feed">
          {logs.map((log) => (
            <div key={`${log.created_at}-${log.message}`} className="workspace-feed-item">
              <div className="workspace-feed-item__top">
                <div className="workspace-feed-item__body">
                  <div className="workspace-feed-item__title">{log.sync_type}</div>
                  <div className="workspace-feed-item__meta">{log.created_at}</div>
                </div>
                <Pill tone="neutral">Log</Pill>
              </div>
              <div className="workspace-feed-item__meta">{log.message}</div>
            </div>
          ))}
          {!logs.length ? <div className="workspace-feed-empty">No recent project activity yet.</div> : null}
        </div>
      </Panel>
    </div>
  );
}
