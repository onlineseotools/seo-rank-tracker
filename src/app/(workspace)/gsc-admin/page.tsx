import { ProjectPicker } from "@/components/project-picker";
import { Panel, PageIntro, Pill, StatTile } from "@/components/ui";
import { fetchLiveGscAction } from "@/lib/server/actions";
import {
  analyzePagePerformance,
  calculateVisibilityScore,
  compareQueryPeriods,
  detectCannibalization,
  findDetailedOpportunities,
  groupRelatedQueries,
} from "@/lib/server/analytics";
import { listGscProperties, fetchGscQueries } from "@/lib/server/google";
import { resolveProjectContext } from "@/lib/server/project-context";
import { requireSessionUser } from "@/lib/server/session";
import { getBaseUrl } from "@/lib/server/url";

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

export default async function GscAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const { projects, project } = await resolveProjectContext(user, params, false);
  const days = Math.max(7, Number(Array.isArray(params.days) ? params.days[0] : params.days) || 28);

  let properties: string[] = [];
  let currentRows: Awaited<ReturnType<typeof fetchGscQueries>> = [];
  let previousRows: Awaited<ReturnType<typeof fetchGscQueries>> = [];
  let fetchError: string | null = null;

  try {
    const baseUrl = await getBaseUrl();
    properties = await listGscProperties(user.id, baseUrl);
    const selectedProperty =
      (Array.isArray(params.property) ? params.property[0] : params.property) ??
      project?.gsc_property ??
      properties[0] ??
      "";

    if (selectedProperty) {
      const currentRange = getDateRange(days);
      const previousRange = getDateRange(days * 2);
      previousRange.end = currentRange.start;
      const previousEnd = new Date(currentRange.start);
      previousEnd.setDate(previousEnd.getDate() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - days);

      currentRows = await fetchGscQueries(user.id, baseUrl, selectedProperty, currentRange.start, currentRange.end, true);
      previousRows = await fetchGscQueries(
        user.id,
        baseUrl,
        selectedProperty,
        previousStart.toISOString().slice(0, 10),
        previousEnd.toISOString().slice(0, 10),
        false,
      );
    }
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Failed to fetch Search Console data.";
  }

  const comparison = compareQueryPeriods(currentRows, previousRows);
  const visibilityScore = calculateVisibilityScore(currentRows);
  const cannibalization = detectCannibalization(currentRows);
  const queryGroups = groupRelatedQueries(currentRows, 0.5).slice(0, 8);
  const pageAnalysis = analyzePagePerformance(currentRows).slice(0, 8);
  const opportunities = findDetailedOpportunities(currentRows);
  const selectedProperty =
    (Array.isArray(params.property) ? params.property[0] : params.property) ?? project?.gsc_property ?? properties[0] ?? "";
  const currentClicks = currentRows.reduce((sum, row) => sum + row.clicks, 0);
  const currentImpressions = currentRows.reduce((sum, row) => sum + row.impressions, 0);
  const currentCtr = currentImpressions ? ((currentClicks / currentImpressions) * 100).toFixed(2) : "0.00";

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Comprehensive Google Search Console analytics and insights."
        subtitle="This route mirrors the original GSC Admin flow with live period comparison, grouping, cannibalization, and opportunity analysis."
        badge="GSC Admin"
      />

      <Panel kicker="Configuration" title="Project and property selection" description="Choose the project, verified Search Console property, and analysis window before loading the live comparison.">
        <div className="grid gap-4 lg:grid-cols-[0.8fr,1.2fr]">
          <ProjectPicker projects={projects} selectedProjectId={project?.id ?? null} />
          <form className="grid gap-3 md:grid-cols-4 md:items-end">
            <input type="hidden" name="project" value={project?.id ?? ""} />
            <label className="grid gap-2">
              <span className="eyebrow">Property</span>
              <select name="property" defaultValue={selectedProperty} className="rounded-[16px] border border-white/10 bg-black/10 px-4 py-3 text-sm">
                {properties.map((property) => (
                  <option key={property} value={property}>
                    {property}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="eyebrow">Window</span>
              <select name="days" defaultValue={String(days)} className="rounded-[16px] border border-white/10 bg-black/10 px-4 py-3 text-sm">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="28">28 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">365 days</option>
              </select>
            </label>
            <button className="rounded-[18px] bg-[var(--green)] px-4 py-3 font-medium text-slate-950">Fetch live analysis</button>
          </form>
        </div>
        {project && selectedProperty ? (
          <form action={fetchLiveGscAction} className="mt-4 flex flex-wrap gap-3">
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="property" value={selectedProperty} />
            <input type="hidden" name="start_date" value={getDateRange(days).start} />
            <input type="hidden" name="end_date" value={getDateRange(days).end} />
            <input type="hidden" name="include_page" value="on" />
            <button className="rounded-[18px] border border-white/10 px-4 py-3 text-sm">Persist current period into project data</button>
          </form>
        ) : null}
      </Panel>

      {fetchError ? (
        <div className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{fetchError}</div>
      ) : null}

      <div className="metric-strip">
        <StatTile label="Current Clicks" value={String(currentClicks)} detail="selected period" tone="var(--green)" />
        <StatTile label="Impressions" value={String(currentImpressions)} detail="selected period" tone="var(--cyan)" />
        <StatTile label="Avg CTR" value={`${currentCtr}%`} detail="current live pull" tone="var(--violet)" />
        <StatTile label="Visibility" value={String(visibilityScore)} detail="weighted live score" tone="var(--amber)" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel kicker="Period comparison" title="New, lost, improved, and declined queries" description="The same comparison categories exposed in the original GSC Admin page.">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "New queries", items: comparison.new_queries.slice(0, 8), tone: "success" as const },
              { label: "Lost queries", items: comparison.lost_queries.slice(0, 8), tone: "warning" as const },
              { label: "Improved", items: comparison.improved_queries.slice(0, 8), tone: "success" as const },
              { label: "Declined", items: comparison.declined_queries.slice(0, 8), tone: "danger" as const },
            ].map((bucket) => (
              <div key={bucket.label} className="panel-soft rounded-[22px] p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{bucket.label}</div>
                  <Pill tone={bucket.tone}>{bucket.items.length}</Pill>
                </div>
                <div className="mt-3 grid gap-2">
                  {bucket.items.length ? (
                    bucket.items.map((item) => (
                      <div key={item.query} className="text-sm text-[var(--muted)]">
                        {item.query}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[var(--muted)]">No data in this bucket.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel kicker="Cannibalization" title="Live Search Console overlap" description="Queries with multiple ranking pages based on the selected live pull.">
          <div className="grid gap-3">
            {cannibalization.slice(0, 8).map((item) => (
              <div key={item.query} className="panel-soft rounded-[22px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.query}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{item.primary_page}</div>
                  </div>
                  <Pill tone={item.num_pages > 2 ? "danger" : "warning"}>{item.num_pages} pages</Pill>
                </div>
              </div>
            ))}
            {!cannibalization.length ? <div className="text-sm text-[var(--muted)]">No live cannibalization detected.</div> : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel kicker="Query groups" title="Related query clustering" description="Queries grouped by token similarity to support content cluster decisions.">
          <div className="grid gap-3">
            {queryGroups.map((group) => (
              <div key={group.primary_query} className="panel-soft rounded-[22px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{group.primary_query}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{group.query_count} related queries</div>
                  </div>
                  <Pill tone="neutral">{group.total_impressions} impressions</Pill>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel kicker="Page analysis" title="Page-wise performance" description="Top pages by clicks and query breadth based on the selected live property.">
          <div className="grid gap-3">
            {pageAnalysis.map((page) => (
              <div key={page.page} className="panel-soft rounded-[22px] p-4">
                <div className="font-medium">{page.page}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                  <span>{page.query_count} queries</span>
                  <span>{page.total_clicks} clicks</span>
                  <span>avg position {page.avg_position.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel kicker="Opportunities" title="Optimization buckets" description="The same quick-win framing from the original analytics page.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Quick wins", items: opportunities.quick_wins },
            { label: "Low hanging fruit", items: opportunities.low_hanging_fruit },
            { label: "Low CTR", items: opportunities.high_impressions_low_ctr },
            { label: "Poor position", items: opportunities.high_impressions_poor_position },
          ].map((bucket) => (
            <div key={bucket.label} className="panel-soft rounded-[22px] p-4">
              <div className="font-medium">{bucket.label}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{bucket.items.length} matching queries</div>
              <div className="mt-3 grid gap-2">
                {bucket.items.slice(0, 4).map((item) => (
                  <div key={`${bucket.label}-${item.query}`} className="text-sm text-[var(--muted)]">
                    {item.query}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
