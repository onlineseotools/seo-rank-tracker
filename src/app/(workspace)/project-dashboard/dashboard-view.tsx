import { Badge, DataTable, InfoBox, Panel, PageIntro, Pill, StatTile, SubPanel, TabLink } from "@/components/ui";
import {
  addKeywordsAction,
  clearProjectGscAction,
  createProjectSheetAction,
  deleteKeywordsAction,
  deleteProjectSheetAction,
  fetchLiveGscAction,
  importKeywordsCsvAction,
  markCannibalizationAction,
  runRankCheckAction,
  syncCannibalizationSheetAction,
  syncGscSheetAction,
  syncRankingsSheetAction,
  unlinkProjectSheetAction,
  updateProjectAction,
} from "@/lib/server/actions";
import {
  analyzePagePerformance,
  findDetailedOpportunities,
  findOpportunities,
  groupRelatedQueries,
} from "@/lib/server/analytics";
import { listGscProperties } from "@/lib/server/google";
import { resolveProjectContext } from "@/lib/server/project-context";
import {
  getBestRank,
  getGscQueries,
  getKeywordsByProject,
  getLatestRankCheckFailures,
  getNewGscDiscoveries,
  getProjectStats,
  getRankingsByProject,
  getResolvedCannibalization,
  getSyncLogs,
  getTopMovers,
} from "@/lib/server/repo";
import { getSerpSetting } from "@/lib/server/serp-settings";
import { requireSessionUser } from "@/lib/server/session";
import { getBaseUrl } from "@/lib/server/url";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MultiSelectDropdown } from "@/components/multi-select-dropdown";
import { UploadField } from "@/components/upload-field";

type SearchParamsMap = Record<string, string | string[] | undefined>;

const DASHBOARD_TABS = ["overview", "keywords", "rank", "search", "cannibalization", "settings"] as const;
const SEARCH_TABS = ["all", "new", "opportunities", "top"] as const;
const CANNIBALIZATION_TABS = ["gsc", "tracked"] as const;
const TRACKED_TABS = ["active", "resolved", "all"] as const;
const KEYWORD_MODES = ["single", "bulk"] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeParams(params: SearchParamsMap) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const resolved = firstParam(value);
    if (resolved) normalized[key] = resolved;
  }
  return normalized;
}

function resolveTab<T extends readonly string[]>(value: string | undefined, options: T, fallback: T[number]) {
  return options.includes((value ?? "") as T[number]) ? (value as T[number]) : fallback;
}

function buildHref(params: Record<string, string>, patch: Record<string, string | undefined>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const search = next.toString();
  return search ? `/project-dashboard?${search}` : "/project-dashboard";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function formatRank(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not Ranked";
  return String(value);
}

function formatChange(current: number | null | undefined, previous: number | null | undefined) {
  if (typeof current !== "number" || typeof previous !== "number") return "-";
  const change = previous - current;
  if (change === 0) return "0";
  return change > 0 ? `+${change}` : String(change);
}

function shortUrl(value: string | null | undefined, length = 64) {
  if (!value) return "-";
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

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

function estimateCheckCost(keywordCount: number, apiType: string) {
  const costs: Record<string, number> = {
    serper: 0.001,
    dataforseo: 0.0025,
    scrapingrobot: 0.0018,
  };
  const costPerKeyword = costs[apiType] ?? costs.serper;
  const totalCost = keywordCount * costPerKeyword;
  const estimatedSeconds = Math.max(1, Math.ceil(keywordCount * 1.2));
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  return {
    totalCost: totalCost.toFixed(3),
    estimatedTimeFormatted: minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`,
  };
}

function buildKeywordCsv(
  rows: Array<{
    keyword: string;
    position: number | null;
    previous_position: number | null;
    url_found: string | null;
    checked_at: string | null;
  }>,
) {
  const header = ["keyword", "current_rank", "previous_rank", "url_found", "last_checked"];
  const lines = rows.map((row) =>
    [row.keyword, row.position ?? "", row.previous_position ?? "", row.url_found ?? "", row.checked_at ?? ""]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

type DistributionBucket = {
  label: string;
  count: number;
  color: string;
};

type TrendPoint = {
  date: string;
  average: number;
};

function buildDistribution(rows: Array<{ position: number | null }>): DistributionBucket[] {
  const buckets = [
    { label: "1-3", count: 0, color: "#3fdb74" },
    { label: "4-10", count: 0, color: "#22c1f5" },
    { label: "11-20", count: 0, color: "#facc15" },
    { label: "21-50", count: 0, color: "#fb923c" },
    { label: "51-100", count: 0, color: "#60a5fa" },
    { label: "Not Ranked", count: 0, color: "#94a3b8" },
  ];

  for (const row of rows) {
    const position = row.position;
    if (typeof position !== "number") buckets[5].count += 1;
    else if (position <= 3) buckets[0].count += 1;
    else if (position <= 10) buckets[1].count += 1;
    else if (position <= 20) buckets[2].count += 1;
    else if (position <= 50) buckets[3].count += 1;
    else if (position <= 100) buckets[4].count += 1;
    else buckets[5].count += 1;
  }

  return buckets;
}

function buildTrend(rows: Array<{ checked_at: string | null; position: number | null }>): TrendPoint[] {
  const grouped = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    if (!row.checked_at || typeof row.position !== "number") continue;
    const key = formatDate(row.checked_at);
    const current = grouped.get(key) ?? { total: 0, count: 0 };
    current.total += row.position;
    current.count += 1;
    grouped.set(key, current);
  }
  return [...grouped.entries()]
    .map(([date, value]) => ({ date, average: Number((value.total / value.count).toFixed(1)) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);
}

function formatShortChartDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getDistributionAxisMax(buckets: DistributionBucket[]) {
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  if (maxCount <= 5) return 5;
  return Math.ceil(maxCount / 10) * 10;
}

function getDistributionTicks(axisMax: number) {
  const step = axisMax <= 5 ? 1 : Math.max(1, axisMax / 6);
  const ticks: number[] = [];
  for (let value = 0; value <= axisMax; value += step) {
    ticks.push(Number(value.toFixed(1)));
  }
  return ticks;
}

function getTrendRange(points: TrendPoint[]) {
  const values = points.map((point) => point.average);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max(0.5, (maxValue - minValue) * 0.35 || 0.5);
  const min = Math.floor((minValue - padding) * 2) / 2;
  const max = Math.ceil((maxValue + padding) * 2) / 2;
  return min === max ? { min, max: min + 1 } : { min, max };
}

function getTrendTicks(points: TrendPoint[]) {
  if (!points.length) return [];
  const { min, max } = getTrendRange(points);
  const tickCount = 4;
  return Array.from({ length: tickCount + 1 }, (_, index) => Number((min + ((max - min) / tickCount) * index).toFixed(1)));
}

function filterStoredRowsByDate<T extends { date_range_start?: string | null; date_range_end?: string | null }>(
  rows: T[],
  startDate: string,
  endDate: string,
) {
  return rows.filter((row) => {
    const rowStart = row.date_range_start ?? startDate;
    const rowEnd = row.date_range_end ?? endDate;
    return rowStart <= endDate && rowEnd >= startDate;
  });
}

function buildGscCases(
  rows: Array<{
    query: string;
    page_url: string | null;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>,
) {
  const grouped = new Map<string, Array<{ page: string; position: number; clicks: number; impressions: number; ctr: number }>>();
  for (const row of rows) {
    if (!row.page_url) continue;
    const list = grouped.get(row.query) ?? [];
    list.push({ page: row.page_url, position: row.position, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr });
    grouped.set(row.query, list);
  }

  return [...grouped.entries()]
    .map(([query, pages]) => ({ query, pages: pages.sort((a, b) => a.position - b.position) }))
    .filter((item) => item.pages.length > 1)
    .map((item) => ({
      query: item.query,
      pages: item.pages,
      numPages: item.pages.length,
      totalClicks: item.pages.reduce((sum, page) => sum + page.clicks, 0),
      totalImpressions: item.pages.reduce((sum, page) => sum + page.impressions, 0),
      bestPosition: item.pages[0]?.position ?? 0,
      worstPosition: item.pages[item.pages.length - 1]?.position ?? 0,
    }))
    .sort((a, b) => b.totalImpressions - a.totalImpressions);
}

export default async function ProjectDashboardView({
  searchParams,
}: {
  searchParams: Promise<SearchParamsMap>;
}) {
  const paramsInput = (await searchParams) ?? {};
  const params = normalizeParams(paramsInput);
  const user = await requireSessionUser();
  const { projects, project } = await resolveProjectContext(user, paramsInput, false);

  if (project && params.project !== String(project.id)) {
    const canonical = new URLSearchParams(params);
    canonical.set("project", String(project.id));
    redirect(`/project-dashboard?${canonical.toString()}`);
  }

  const activeTab = resolveTab(params.tab, DASHBOARD_TABS, "overview");
  const activeSearchTab = resolveTab(params.search_view, SEARCH_TABS, "all");
  const activeCannibalizationTab = resolveTab(params.cannibal_view, CANNIBALIZATION_TABS, "gsc");
  const activeTrackedTab = resolveTab(params.tracked_view, TRACKED_TABS, "active");
  const activeKeywordMode = resolveTab(params.keyword_mode, KEYWORD_MODES, "single");
  const actionStatus = params.status;
  const actionMessage = params.message;
  const rankStatus = params.rank_status;
  const rankMessage = params.rank_message;

  if (!project) {
    return (
      <div className="project-workspace">
        <PageIntro title="Project Dashboard" subtitle="All project data and actions in one place" badge="Project Dashboard" />
        <Panel title="No project selected" description="Open a project from the Projects page to load its dedicated dashboard.">
          <div className="toolbar-actions">
            <Link href="/projects?tab=all" className="dashboard-action dashboard-action--secondary dashboard-action--link">
              Open Projects
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  const isOverviewTab = activeTab === "overview";
  const isKeywordsTab = activeTab === "keywords";
  const isRankTab = activeTab === "rank";
  const isSearchTab = activeTab === "search";
  const isCannibalizationTab = activeTab === "cannibalization";

  const needsKeywords = isOverviewTab || isKeywordsTab || isRankTab || isCannibalizationTab;
  const needsRankings = isOverviewTab || isKeywordsTab || isRankTab;
  const needsGscRows = isSearchTab || isCannibalizationTab;

  const stats = isOverviewTab || isRankTab ? getProjectStats(project.id) : { total_keywords: 0, average_position: null, top_10_count: 0, improved_count: 0, declined_count: 0 };
  const keywords = needsKeywords ? getKeywordsByProject(project.id) : [];
  const rankingsLatest = needsRankings ? getRankingsByProject(project.id, true) : [];
  const rankingsHistory = isOverviewTab ? getRankingsByProject(project.id, false) : [];
  const topMovers = isOverviewTab ? getTopMovers(project.id, 10) : [];
  const failures = isRankTab ? getLatestRankCheckFailures(project.id) : [];
  const gscRows = needsGscRows ? getGscQueries(project.id) : [];
  const newDiscoveries = isSearchTab && activeSearchTab === "new" ? getNewGscDiscoveries(project.id) : [];
  const resolvedRows = isCannibalizationTab ? getResolvedCannibalization(project.id) : [];
  const resolvedMap = new Map(resolvedRows.map((item) => [item.keyword.toLowerCase(), item]));
  const activityLogs = isRankTab ? getSyncLogs(project.id, 15) : [];
  const defaultSerpApi = isRankTab ? (await getSerpSetting(user.id, "default_serp_api")) ?? "serper" : "serper";

  const rankingDistribution = isOverviewTab ? buildDistribution(rankingsLatest) : [];
  const rankingTrend = isOverviewTab ? buildTrend(rankingsHistory) : [];
  const rankingDistributionAxisMax = rankingDistribution.length ? getDistributionAxisMax(rankingDistribution) : 0;
  const rankingDistributionTicks = rankingDistribution.length ? getDistributionTicks(rankingDistributionAxisMax) : [];
  const rankingTrendTicks = rankingTrend.length ? getTrendTicks(rankingTrend) : [];
  const rankingsCsvHref = isKeywordsTab ? `data:text/csv;charset=utf-8,${encodeURIComponent(buildKeywordCsv(rankingsLatest))}` : "";
  const distributionChart = isOverviewTab && rankingDistribution.length
    ? (() => {
        const width = 560;
        const height = 290;
        const padding = { top: 16, right: 12, bottom: 62, left: 56 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const slotWidth = plotWidth / rankingDistribution.length;
        const barWidth = Math.min(72, slotWidth * 0.62);
        return { width, height, padding, plotWidth, plotHeight, slotWidth, barWidth };
      })()
    : null;
  const trendChart = isOverviewTab && rankingTrend.length
    ? (() => {
        const width = 560;
        const height = 290;
        const padding = { top: 18, right: 18, bottom: 56, left: 56 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const range = getTrendRange(rankingTrend);
        const points = rankingTrend.map((point, index) => {
          const x = rankingTrend.length === 1 ? padding.left + plotWidth / 2 : padding.left + (plotWidth / (rankingTrend.length - 1)) * index;
          const ratio = (point.average - range.min) / (range.max - range.min);
          const y = padding.top + ratio * plotHeight;
          return { ...point, x, y };
        });
        const linePath = points
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join(" ");
        const labelIndexes = new Set(
          points.length <= 4
            ? points.map((_, index) => index)
            : [0, Math.floor((points.length - 1) / 2), points.length - 1],
        );
        return { width, height, padding, plotWidth, plotHeight, points, linePath, labelIndexes };
      })()
    : null;

  const keywordCount = keywords.length;
  const positionValues = rankingsLatest.map((row) => row.position).filter((value): value is number => typeof value === "number");
  const bestRank = positionValues.length ? Math.min(...positionValues) : null;
  const lastCheckValues = rankingsLatest.map((row) => row.checked_at).filter(Boolean) as string[];
  const lastCheck = lastCheckValues.length ? [...lastCheckValues].sort().at(-1) ?? null : null;
  const estimate = isRankTab ? estimateCheckCost(keywordCount, defaultSerpApi) : { totalCost: "0.000", estimatedTimeFormatted: "0s" };

  const providerStatuses = isRankTab
    ? {
        serper: Boolean(await getSerpSetting(user.id, "serper_api_key")),
        dataforseo: Boolean((await getSerpSetting(user.id, "dataforseo_username")) && (await getSerpSetting(user.id, "dataforseo_password"))),
        scrapingrobot: Boolean(await getSerpSetting(user.id, "scrapingrobot_api_key")),
      }
    : { serper: false, dataforseo: false, scrapingrobot: false };

  let gscProperties: string[] = [];
  let gscConnectionMessage = "";
  let gscConnected = false;
  if (isSearchTab) {
    try {
      gscProperties = await listGscProperties(user.id, await getBaseUrl());
      gscConnected = true;
      gscConnectionMessage = gscProperties.length
        ? `Connected to Google Search Console with ${gscProperties.length} verified properties.`
        : "Google Search Console is connected, but no verified properties were returned.";
    } catch (error) {
      gscConnected = false;
      gscConnectionMessage = error instanceof Error ? error.message : "Google Search Console is not connected.";
    }
  }

  const matchedProperty =
    project.gsc_property ||
    gscProperties.find((property) => property.includes(project.url) || project.url.includes(property)) ||
    gscProperties[0] ||
    "";
  const selectedProperty = params.property_override || params.selected_property || matchedProperty;
  const presetDays = [7, 14, 28, 90, 180, 365, 480].includes(Number(params.preset_days)) ? Number(params.preset_days) : 28;
  const presetRange = getDateRange(presetDays);
  const pageStart = params.page_start || presetRange.start;
  const pageEnd = params.page_end || presetRange.end;
  const pageSearch = params.page_search || "";
  const pageFilter = params.page_filter || "all";
  const filteredDateRows = isSearchTab ? filterStoredRowsByDate(gscRows, pageStart, pageEnd) : [];
  const allPageOptions = isSearchTab ? [...new Set(filteredDateRows.map((row) => row.page_url).filter((value): value is string => Boolean(value)))].sort() : [];
  const visiblePageOptions = pageSearch ? allPageOptions.filter((value) => value.toLowerCase().includes(pageSearch.toLowerCase())) : allPageOptions;
  const pageScopedRows = isSearchTab ? (pageFilter !== "all" ? filteredDateRows.filter((row) => row.page_url === pageFilter) : filteredDateRows) : [];
  const pagePerformance = isSearchTab ? analyzePagePerformance(pageScopedRows).slice(0, 12) : [];
  const pagePerformanceMetrics = {
    clicks: pageScopedRows.reduce((sum, row) => sum + row.clicks, 0),
    impressions: pageScopedRows.reduce((sum, row) => sum + row.impressions, 0),
    ctr: pageScopedRows.length ? (pageScopedRows.reduce((sum, row) => sum + row.ctr, 0) / pageScopedRows.length) * 100 : 0,
    position: pageScopedRows.length ? pageScopedRows.reduce((sum, row) => sum + row.position, 0) / pageScopedRows.length : 0,
  };
  const newDiscoveryOptions = [...new Set(newDiscoveries.map((row) => row.query))]
    .map((query) => ({ value: query, label: query }));

  const detailedOpportunities = isSearchTab && activeSearchTab === "opportunities" ? findDetailedOpportunities(gscRows) : { quick_wins: [], low_hanging_fruit: [], high_impressions_low_ctr: [], high_impressions_poor_position: [] };
  const allOpportunities = isSearchTab && (activeSearchTab === "opportunities" || activeSearchTab === "top") ? findOpportunities(gscRows) : [];
  const groupedQueries = isSearchTab && activeSearchTab === "top" ? groupRelatedQueries(gscRows).slice(0, 12) : [];
  const gscCases = isCannibalizationTab && activeCannibalizationTab === "gsc" ? buildGscCases(gscRows) : [];
  const trackedKeywordSet = isCannibalizationTab ? new Map(keywords.map((keyword) => [keyword.keyword.toLowerCase(), keyword.keyword])) : new Map<string, string>();
  const trackedRows = isCannibalizationTab && activeCannibalizationTab === "tracked" ? gscRows.filter((row) => trackedKeywordSet.has(row.query.toLowerCase())) : [];
  const trackedCases = isCannibalizationTab && activeCannibalizationTab === "tracked" ? buildGscCases(trackedRows) : [];
  const activeTrackedCases = trackedCases.filter((item) => !resolvedMap.has(item.query.toLowerCase()));
  const resolvedTrackedCases = trackedCases.filter((item) => resolvedMap.has(item.query.toLowerCase()));
  const allTrackedKeywordRows =
    isCannibalizationTab && activeCannibalizationTab === "tracked" && activeTrackedTab === "all"
      ? keywords.map((keyword) => {
          const queryRows = trackedRows.filter((row) => row.query.toLowerCase() === keyword.keyword.toLowerCase());
          const pages = [...new Set(queryRows.map((row) => row.page_url).filter((value): value is string => Boolean(value)))];
          return {
            keyword: keyword.keyword,
            found: queryRows.length > 0,
            pages: pages.length,
            clicks: queryRows.reduce((sum, row) => sum + row.clicks, 0),
            impressions: queryRows.reduce((sum, row) => sum + row.impressions, 0),
            resolved: resolvedMap.has(keyword.keyword.toLowerCase()),
          };
        })
      : [];

  return (
    <div className="project-workspace">
      <PageIntro title="Project Dashboard" subtitle="All project data and actions in one place" badge="Project Dashboard" />

      {actionMessage ? (
        <InfoBox tone={actionStatus === "error" ? "error" : actionStatus === "warning" ? "warning" : "success"}>
          {actionMessage}
        </InfoBox>
      ) : null}

      <div className="dashboard-project-badge-row">
        <Badge tone="success">{`${project.name} - ${project.target_location}`}</Badge>
      </div>

      <div className="tab-links dashboard-top-tabs">
        <TabLink href={buildHref(params, { tab: "overview" })} label="Overview" active={activeTab === "overview"} />
        <TabLink href={buildHref(params, { tab: "keywords" })} label="Keywords" active={activeTab === "keywords"} />
        <TabLink href={buildHref(params, { tab: "rank" })} label="Rank Checker" active={activeTab === "rank"} />
        <TabLink href={buildHref(params, { tab: "search" })} label="Search Console" active={activeTab === "search"} />
        <TabLink href={buildHref(params, { tab: "cannibalization" })} label="Cannibalization" active={activeTab === "cannibalization"} />
        <TabLink href={buildHref(params, { tab: "settings" })} label="Project Settings" active={activeTab === "settings"} />
      </div>

      {activeTab === "overview" ? (
        <>
          <Panel title="Project Overview" description="Core performance snapshot">
            <div className="metric-strip dashboard-metric-strip">
              <StatTile label="Total Keywords" value={String(stats.total_keywords)} detail="Active keywords" />
              <StatTile label="Avg Position" value={stats.average_position === null ? "N/A" : String(stats.average_position)} detail="Across all keywords" />
              <StatTile
                label="Top 10 Rankings"
                value={String(stats.top_10_count)}
                detail={stats.total_keywords ? `${Math.round((stats.top_10_count / stats.total_keywords) * 100)}% of keywords` : "0%"}
              />
              <StatTile label="Movers" value={`+${stats.improved_count} / -${stats.declined_count}`} detail="Since last check" />
            </div>
          </Panel>

          <Panel title="Project Info" description="Settings and links for this project">
            <div className="surface-grid-3 dashboard-info-grid">
              <div className="dashboard-info-stack">
                <div><strong>Name:</strong> {project.name}</div>
                <div><strong>URL:</strong> <a href={project.url} target="_blank" rel="noreferrer">{project.url}</a></div>
                <div><strong>Location:</strong> {project.target_location}</div>
              </div>
              <div className="dashboard-info-stack">
                <div><strong>Frequency:</strong> {project.update_frequency}</div>
                <div><strong>Status:</strong> {project.is_active ? "Active" : "Inactive"}</div>
                <div><strong>GSC Property:</strong> {project.gsc_property || "Not linked"}</div>
              </div>
              <div className="dashboard-cta-stack">
                {project.google_sheet_url ? (
                  <>
                    <div className="dashboard-cta-row">
                      <a href={project.google_sheet_url} target="_blank" rel="noreferrer" className="dashboard-action dashboard-action--secondary dashboard-action--link">
                        Open Google Sheet
                      </a>
                      <form action={unlinkProjectSheetAction}>
                        <input type="hidden" name="project_id" value={project.id} />
                        <input type="hidden" name="return_to" value={buildHref(params, { tab: "settings" })} />
                        <button type="submit" className="button-secondary">Unlink Sheet</button>
                      </form>
                    </div>
                    <form action={deleteProjectSheetAction} className="dashboard-sheet-delete-form">
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="return_to" value={buildHref(params, { tab: "settings" })} />
                      <div className="dashboard-delete-row">
                        <label className="workspace-toggle dashboard-sheet-confirm">
                          <span className="workspace-toggle__control">
                            <input type="checkbox" name="confirm_delete_sheet" required />
                          </span>
                          <span className="workspace-toggle__label">Confirm delete sheet</span>
                        </label>
                        <button type="submit" className="button-danger">Delete Sheet</button>
                      </div>
                    </form>
                  </>
                ) : (
                  <form action={createProjectSheetAction}>
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="return_to" value={buildHref(params, { tab: "settings" })} />
                    <button type="submit">Create Google Sheet</button>
                  </form>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Performance Charts" description="Ranking distribution and trends">
            <div className="surface-grid-2 dashboard-chart-grid">
              <SubPanel title="Ranking Distribution" description="Current keyword positions grouped into buckets">
                {distributionChart ? (
                  <div className="dashboard-chart-shell">
                    <svg
                      viewBox={`0 0 ${distributionChart.width} ${distributionChart.height}`}
                      className="dashboard-chart-svg"
                      role="img"
                      aria-label="Ranking distribution chart"
                    >
                      <rect
                        x={distributionChart.padding.left}
                        y={distributionChart.padding.top}
                        width={distributionChart.plotWidth}
                        height={distributionChart.plotHeight}
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.18)"
                        strokeWidth="1"
                      />
                      {rankingDistributionTicks.map((tick) => {
                        const y =
                          distributionChart.padding.top +
                          distributionChart.plotHeight -
                          (tick / rankingDistributionAxisMax) * distributionChart.plotHeight;
                        return (
                          <g key={`distribution-tick-${tick}`}>
                            <line
                              x1={distributionChart.padding.left}
                              y1={y}
                              x2={distributionChart.width - distributionChart.padding.right}
                              y2={y}
                              className="dashboard-chart-grid-line"
                              style={{ stroke: tick === 0 ? "rgba(148, 163, 184, 0.32)" : "rgba(148, 163, 184, 0.18)", strokeWidth: tick === 0 ? 1.35 : 1 }}
                            />
                            <text
                              x={distributionChart.padding.left - 12}
                              y={y + 4}
                              textAnchor="end"
                              className="dashboard-chart-axis-text"
                              style={{ fill: "#c7d0dd" }}
                            >
                              {tick}
                            </text>
                          </g>
                        );
                      })}

                      <line
                        x1={distributionChart.padding.left}
                        y1={distributionChart.padding.top}
                        x2={distributionChart.padding.left}
                        y2={distributionChart.padding.top + distributionChart.plotHeight}
                        stroke="rgba(148, 163, 184, 0.34)"
                        strokeWidth="1.35"
                      />
                      <line
                        x1={distributionChart.padding.left}
                        y1={distributionChart.padding.top + distributionChart.plotHeight}
                        x2={distributionChart.width - distributionChart.padding.right}
                        y2={distributionChart.padding.top + distributionChart.plotHeight}
                        stroke="rgba(148, 163, 184, 0.34)"
                        strokeWidth="1.35"
                      />

                      {rankingDistribution.map((bucket, index) => {
                        const barHeight =
                          bucket.count === 0 ? 0 : (bucket.count / rankingDistributionAxisMax) * distributionChart.plotHeight;
                        const x =
                          distributionChart.padding.left +
                          distributionChart.slotWidth * index +
                          (distributionChart.slotWidth - distributionChart.barWidth) / 2;
                        const y = distributionChart.padding.top + distributionChart.plotHeight - barHeight;
                        const labelY = distributionChart.height - 22;

                        return (
                          <g key={bucket.label}>
                            {bucket.count > 0 ? (
                              <text
                                x={x + distributionChart.barWidth / 2}
                                y={y - 10}
                                textAnchor="middle"
                                className="dashboard-chart-value-text"
                                style={{ fill: "#e9eef6" }}
                              >
                                {bucket.count}
                              </text>
                            ) : null}
                            <rect
                              x={x}
                              y={y}
                              width={distributionChart.barWidth}
                              height={barHeight}
                              fill={bucket.color}
                              fillOpacity={bucket.label === "Not Ranked" ? 0.82 : 0.96}
                            />
                            <text
                              x={x + distributionChart.barWidth / 2}
                              y={labelY}
                              textAnchor="middle"
                              className="dashboard-chart-axis-text"
                              style={{ fill: "#c7d0dd" }}
                            >
                              {bucket.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : (
                  <InfoBox tone="info">No ranking data available yet.</InfoBox>
                )}
              </SubPanel>
              <SubPanel title="Average Position Trend" description="Average position across recent ranking checks">
                {trendChart ? (
                  <div className="dashboard-chart-shell">
                    <svg
                      viewBox={`0 0 ${trendChart.width} ${trendChart.height}`}
                      className="dashboard-chart-svg"
                      role="img"
                      aria-label="Average position trend chart"
                    >
                      <rect
                        x={trendChart.padding.left}
                        y={trendChart.padding.top}
                        width={trendChart.plotWidth}
                        height={trendChart.plotHeight}
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.18)"
                        strokeWidth="1"
                      />
                      {rankingTrendTicks.map((tick) => {
                        const y =
                          trendChart.padding.top +
                          ((tick - rankingTrendTicks[0]) / (rankingTrendTicks[rankingTrendTicks.length - 1] - rankingTrendTicks[0] || 1)) *
                            trendChart.plotHeight;
                        return (
                          <g key={`trend-tick-${tick}`}>
                            <line
                              x1={trendChart.padding.left}
                              y1={y}
                              x2={trendChart.width - trendChart.padding.right}
                              y2={y}
                              className="dashboard-chart-grid-line"
                              style={{ stroke: "rgba(148, 163, 184, 0.18)", strokeWidth: 1 }}
                            />
                            <text x={trendChart.padding.left - 12} y={y + 4} textAnchor="end" className="dashboard-chart-axis-text">
                              <tspan fill="#c7d0dd">{tick}</tspan>
                            </text>
                          </g>
                        );
                      })}

                      <line
                        x1={trendChart.padding.left}
                        y1={trendChart.padding.top}
                        x2={trendChart.padding.left}
                        y2={trendChart.padding.top + trendChart.plotHeight}
                        stroke="rgba(148, 163, 184, 0.34)"
                        strokeWidth="1.35"
                      />
                      <line
                        x1={trendChart.padding.left}
                        y1={trendChart.padding.top + trendChart.plotHeight}
                        x2={trendChart.width - trendChart.padding.right}
                        y2={trendChart.padding.top + trendChart.plotHeight}
                        stroke="rgba(148, 163, 184, 0.34)"
                        strokeWidth="1.35"
                      />

                      {trendChart.points.length > 1 ? (
                        <path d={trendChart.linePath} fill="none" className="dashboard-chart-line" style={{ stroke: "#25c1f5" }} />
                      ) : trendChart.points.length === 1 ? (
                        <line
                          x1={trendChart.points[0].x}
                          y1={trendChart.padding.top}
                          x2={trendChart.points[0].x}
                          y2={trendChart.padding.top + trendChart.plotHeight}
                          stroke="rgba(37, 193, 245, 0.28)"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      ) : null}

                      {trendChart.points.map((point, index) => (
                        <g key={point.date}>
                          <circle cx={point.x} cy={point.y} r="5" className="dashboard-chart-point" style={{ fill: "#25c1f5", stroke: "rgba(37, 193, 245, 0.28)", strokeWidth: 10 }} />
                          <text x={point.x} y={point.y - 12} textAnchor="middle" className="dashboard-chart-value-text" style={{ fill: "#e9eef6" }}>
                            {point.average}
                          </text>
                          {trendChart.labelIndexes.has(index) ? (
                            <text
                              x={point.x}
                              y={trendChart.height - 18}
                              textAnchor="middle"
                              className="dashboard-chart-axis-text"
                              style={{ fill: "#c7d0dd" }}
                            >
                              {formatShortChartDate(point.date)}
                            </text>
                          ) : null}
                        </g>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <InfoBox tone="info">No ranking history available yet.</InfoBox>
                )}
              </SubPanel>
            </div>
          </Panel>

          <Panel title="Top Movers" description="Largest ranking changes in the latest run">
            {topMovers.length ? (
              <DataTable
                className="dashboard-table dashboard-table-inline"
                headers={["Keyword", "Current Rank", "Previous Rank", "Change"]}
                rows={topMovers.map((row) => [
                  row.keyword,
                  formatRank(row.position),
                  formatRank(row.previous_position),
                  row.change > 0 ? <Pill tone="success">{`+${row.change}`}</Pill> : <Pill tone="warning">{row.change}</Pill>,
                ])}
              />
            ) : (
              <InfoBox tone="info">No movers found yet for this project.</InfoBox>
            )}
          </Panel>

          <Panel title="Recent Rankings" description="Latest positions for tracked keywords">
            {rankingsLatest.length ? (
              <DataTable
                className="dashboard-table dashboard-table-scroll"
                headers={["Keyword", "Current Rank", "Previous Rank", "URL", "Last Checked"]}
                rows={rankingsLatest.map((row) => [
                  row.keyword,
                  formatRank(row.position),
                  formatRank(row.previous_position),
                  shortUrl(row.url_found),
                  formatDate(row.checked_at),
                ])}
              />
            ) : (
              <InfoBox tone="info">No keywords found yet.</InfoBox>
            )}
          </Panel>
        </>
      ) : null}

      {activeTab === "keywords" ? (
        <>
          <Panel title="Keyword Intake" description="Add or import keywords for this project">
            <div className="surface-grid-2 dashboard-intake-grid">
              <SubPanel title="Add Keywords" description="Add keywords individually or in bulk">
                <div className="dashboard-mode-switch" role="tablist" aria-label="Keyword intake mode">
                  <Link
                    href={buildHref(params, { tab: "keywords", keyword_mode: "single" })}
                    className={`dashboard-mode-switch__option ${activeKeywordMode === "single" ? "is-active" : ""}`}
                  >
                    <span className="dashboard-mode-switch__dot" aria-hidden="true" />
                    <span>Single Keyword</span>
                  </Link>
                  <Link
                    href={buildHref(params, { tab: "keywords", keyword_mode: "bulk" })}
                    className={`dashboard-mode-switch__option ${activeKeywordMode === "bulk" ? "is-active" : ""}`}
                  >
                    <span className="dashboard-mode-switch__dot" aria-hidden="true" />
                    <span>Bulk Paste</span>
                  </Link>
                </div>
                <div className="dashboard-intake-shell">
                  {activeKeywordMode === "single" ? (
                    <form action={addKeywordsAction} className="workspace-form dashboard-intake-form">
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="return_to" value={buildHref(params, { tab: "keywords" })} />
                      <label className="workspace-form__field">
                        <span className="eyebrow">Keyword</span>
                        <input name="keywords" placeholder="seo tools" />
                      </label>
                      <div className="toolbar-actions dashboard-intake-actions">
                        <button type="submit" className="button-secondary">Add Keyword</button>
                      </div>
                    </form>
                  ) : (
                    <form action={addKeywordsAction} className="workspace-form dashboard-intake-form">
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="return_to" value={buildHref(params, { tab: "keywords" })} />
                      <label className="workspace-form__field">
                        <span className="eyebrow">Keywords</span>
                        <textarea name="keywords" className="workspace-textarea dashboard-keywords-textarea" placeholder={"keyword one\nkeyword two\nkeyword three"} />
                      </label>
                      <div className="toolbar-actions dashboard-intake-actions">
                        <button type="submit" className="button-secondary">Add Keywords</button>
                      </div>
                    </form>
                  )}
                </div>
              </SubPanel>

              <SubPanel title="Import Keywords" description="Import keywords from CSV">
                {params.error === "missing-keyword-column" ? <InfoBox tone="warning">CSV must contain a `keyword` column.</InfoBox> : null}
                <div className="dashboard-import-shell">
                  <form action={importKeywordsCsvAction} className="workspace-form dashboard-import-form">
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="return_to" value={buildHref(params, { tab: "keywords" })} />
                    <label className="workspace-form__field">
                      <span className="dashboard-upload-label">Choose CSV file</span>
                      <div className="dashboard-upload-box">
                        <UploadField name="csv_file" accept=".csv" />
                      </div>
                    </label>
                    <div className="toolbar-actions dashboard-import-actions">
                      <button type="submit" className="button-secondary">Import Keywords</button>
                    </div>
                  </form>
                </div>
              </SubPanel>
            </div>
          </Panel>

          <Panel title="Keywords" description="View and manage tracked keywords">
            {rankingsLatest.length ? (
              <DataTable
                className="dashboard-table dashboard-table-scroll"
                headers={["Keyword", "Current Rank", "Previous Rank", "Change", "Best Rank", "URL", "Last Checked"]}
                rows={rankingsLatest.map((row) => [
                  row.keyword,
                  formatRank(row.position),
                  formatRank(row.previous_position),
                  formatChange(row.position, row.previous_position),
                  formatRank(getBestRank(row.id)),
                  shortUrl(row.url_found),
                  formatDate(row.checked_at),
                ])}
              />
            ) : (
              <InfoBox tone="info">No keywords found. Add keywords below.</InfoBox>
            )}
          </Panel>

          <Panel title="Bulk Actions" description="">
            <div className="surface-grid-3 dashboard-bulk-grid">
              <SubPanel title="Sync to Google Sheets" description="Push latest rankings to your sheet">
                <Badge tone="success">Sync</Badge>
                <div className="dashboard-subpanel-body dashboard-bulk-action-card">
                  {project.google_sheet_id ? (
                    <form action={syncRankingsSheetAction}>
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="return_to" value={buildHref(params, { tab: "keywords" })} />
                      <button type="submit">Sync Now</button>
                    </form>
                  ) : (
                    <InfoBox tone="warning">No Google Sheet linked to this project.</InfoBox>
                  )}
                </div>
              </SubPanel>

              <SubPanel title="Delete Keywords" description="Remove selected keywords from this project">
                <Badge tone="warning">Delete</Badge>
                {keywords.length ? (
                  <form action={deleteKeywordsAction} className="dashboard-selection-form dashboard-bulk-delete-form">
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="return_to" value={buildHref(params, { tab: "keywords" })} />
                    <label className="workspace-form__field">
                      <span className="dashboard-field-label">Select keywords to delete</span>
                      <MultiSelectDropdown
                        name="keyword_ids"
                        options={keywords.map((keyword) => ({
                          value: String(keyword.id),
                          label: keyword.keyword,
                        }))}
                      />
                    </label>
                    <div className="toolbar-actions">
                      <button type="submit" className="button-secondary">Delete Selected</button>
                    </div>
                  </form>
                ) : (
                  <InfoBox tone="info">No keywords available to delete.</InfoBox>
                )}
              </SubPanel>

              <SubPanel title="Export CSV" description="Download a keyword snapshot">
                <Badge tone="info">Export</Badge>
                <div className="dashboard-subpanel-body dashboard-bulk-action-card">
                  {rankingsLatest.length ? (
                    <a href={rankingsCsvHref} download={`${project.name}_keywords.csv`} className="dashboard-action dashboard-action--secondary dashboard-action--link">
                      Download CSV
                    </a>
                  ) : (
                    <InfoBox tone="info">No keywords to export.</InfoBox>
                  )}
                </div>
              </SubPanel>
            </div>
          </Panel>
        </>
      ) : null}

      {activeTab === "rank" ? (
        <>
          {rankMessage ? (
            <InfoBox tone={rankStatus === "error" ? "error" : rankStatus === "warning" ? "warning" : "success"}>
              {rankMessage}
            </InfoBox>
          ) : null}
          <Panel title="Project Snapshot" description="Current keyword counts and last check status">
            <div className="surface-grid-3">
              <StatTile label="Total Keywords" value={String(keywordCount)} detail="Active keywords" />
              <StatTile label="Best Rank" value={bestRank ? String(bestRank) : "N/A"} detail="Best position" />
              <StatTile label="Last Check" value={lastCheck ? formatDate(lastCheck) : "Not checked"} detail="Most recent run" />
            </div>
          </Panel>

          <Panel title="Rank Check Setup" description="Select API and estimate cost">
            <div className="surface-grid-2 dashboard-rank-grid">
              <div className="workspace-form">
                <form action={runRankCheckAction} className="workspace-form">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="return_to" value={buildHref(params, { tab: "rank" })} />
                  <label className="workspace-form__field">
                    <span className="eyebrow">API Provider</span>
                    <select name="api_type" defaultValue={defaultSerpApi}>
                      <option value="serper">Serper.dev</option>
                      <option value="dataforseo">DataForSEO</option>
                      <option value="scrapingrobot">ScrapingRobot</option>
                    </select>
                  </label>
                  <div className="toolbar-actions">
                    <button type="submit">Run Rank Check</button>
                  </div>
                </form>
                <form action={syncRankingsSheetAction}>
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="return_to" value={buildHref(params, { tab: "rank" })} />
                  <button type="submit" className="button-secondary">Sync to Sheets</button>
                </form>
              </div>

              <SubPanel title="Estimated Cost" description="Original cost estimate based on keyword volume and provider">
                <div className="dashboard-estimate">
                  <div className="card-value">{`$${estimate.totalCost}`}</div>
                  <div className="card-subtitle">{estimate.estimatedTimeFormatted}</div>
                  <div className="dashboard-provider-list">
                    <Pill tone={providerStatuses.serper ? "success" : "warning"}>Serper.dev</Pill>
                    <Pill tone={providerStatuses.dataforseo ? "success" : "warning"}>DataForSEO</Pill>
                    <Pill tone={providerStatuses.scrapingrobot ? "success" : "warning"}>ScrapingRobot</Pill>
                  </div>
                </div>
              </SubPanel>
            </div>

            {!providerStatuses[defaultSerpApi as keyof typeof providerStatuses] ? (
              <InfoBox tone="warning">Missing API credentials. Add them in Settings &gt; SERP APIs.</InfoBox>
            ) : null}
          </Panel>

          <Panel title="Failed Keywords" description="Keywords that failed in the latest run">
            {failures.length ? (
              <form action={runRankCheckAction} className="dashboard-failures-form">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="api_type" value={defaultSerpApi} />
                <input type="hidden" name="return_to" value={buildHref(params, { tab: "rank" })} />
                <div className="dashboard-checkbox-list">
                  {failures.map((failure) => (
                    <label key={`${failure.keyword}-${failure.created_at}`} className="workspace-toggle">
                      <span className="workspace-toggle__control">
                        <input type="checkbox" name="keyword_ids" value={failure.keyword_id} defaultChecked />
                      </span>
                      <span className="workspace-toggle__label">{failure.keyword}</span>
                    </label>
                  ))}
                </div>
                <DataTable className="dashboard-table dashboard-table-inline" headers={["Keyword", "Error", "Time"]} rows={failures.map((failure) => [failure.keyword, failure.error_message, formatDate(failure.created_at)])} />
                <div className="toolbar-actions">
                  <button type="submit">Re-run Failed Keywords</button>
                </div>
              </form>
            ) : (
              <InfoBox tone="info">No failed keywords in the latest run.</InfoBox>
            )}
          </Panel>

          <Panel title="Recent Activity" description="Latest rank check logs for this project">
            <div className="dashboard-activity-list">
              {activityLogs.filter((log) => log.sync_type === "rank_check").length ? (
                activityLogs
                  .filter((log) => log.sync_type === "rank_check")
                  .map((log) => (
                    <InfoBox key={`${log.created_at}-${log.message}`} tone={log.status === "success" ? "success" : "warning"}>
                      {`${formatDate(log.created_at)} - ${log.message}`}
                    </InfoBox>
                  ))
              ) : (
                <InfoBox tone="info">No recent rank check logs for this project.</InfoBox>
              )}
            </div>
          </Panel>
        </>
      ) : null}

      {activeTab === "search" ? (
        <>
          {!gscConnected ? (
            <Panel title="Search Console" description="Connect and configure Search Console before fetching project data">
              <div className="dashboard-inline-alert-row">
                <InfoBox tone="warning">Google Search Console not connected.</InfoBox>
                <InfoBox tone="info">{gscConnectionMessage}</InfoBox>
                <a href="/settings?tab=search-console" className="dashboard-action dashboard-action--secondary dashboard-action--link">Open Settings</a>
              </div>
            </Panel>
          ) : (
            <>
              <div className="dashboard-project-badge-row">
                <Pill tone="success">{gscConnectionMessage}</Pill>
              </div>

              <Panel title="GSC Property" description="Select the property to analyze">
                <form method="get" className="workspace-form">
                  <input type="hidden" name="project" value={project.id} />
                  <input type="hidden" name="tab" value="search" />
                  <input type="hidden" name="search_view" value={activeSearchTab} />
                  <label className="workspace-form__field">
                    <span className="eyebrow">GSC Property</span>
                    <select name="selected_property" defaultValue={selectedProperty}>
                      {gscProperties.map((property) => (
                        <option key={property} value={property}>{property}</option>
                      ))}
                    </select>
                  </label>
                  <label className="workspace-form__field">
                    <span className="eyebrow">Manual Override</span>
                    <input name="property_override" defaultValue={params.property_override ?? ""} placeholder="https://example.com/" />
                  </label>
                  <div className="toolbar-actions">
                    <button type="submit" className="button-secondary">Use Property</button>
                  </div>
                </form>
              </Panel>

              <Panel title="Date Range & Actions" description="Choose a timeframe and fetch data">
                <div className="surface-grid-3 dashboard-search-controls">
                  <form method="get" className="workspace-form">
                    <input type="hidden" name="project" value={project.id} />
                    <input type="hidden" name="tab" value="search" />
                    <input type="hidden" name="search_view" value={activeSearchTab} />
                    <input type="hidden" name="selected_property" value={selectedProperty} />
                    <label className="workspace-form__field">
                      <span className="eyebrow">Timeframe</span>
                      <select name="preset_days" defaultValue={String(presetDays)}>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="28">28 days</option>
                        <option value="90">3 months</option>
                        <option value="180">6 months</option>
                        <option value="365">12 months</option>
                        <option value="480">16 months</option>
                      </select>
                    </label>
                    <div className="toolbar-actions">
                      <button type="submit" className="button-secondary">Apply Timeframe</button>
                    </div>
                  </form>

                  <SubPanel title="Selected" description="Current property and timeframe">
                    <div className="dashboard-info-stack">
                      <div><strong>Project:</strong> {project.name}</div>
                      <div><strong>Location:</strong> {project.target_location}</div>
                      <div><strong>Timeframe:</strong> {presetDays} days</div>
                      <div><strong>Property:</strong> {selectedProperty || "No property selected"}</div>
                    </div>
                  </SubPanel>

                  <div className="dashboard-action-stack">
                    <form action={fetchLiveGscAction} className="workspace-form">
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="return_to" value={buildHref(params, { tab: "search" })} />
                      <input type="hidden" name="property" value={selectedProperty} />
                      <input type="hidden" name="start_date" value={presetRange.start} />
                      <input type="hidden" name="end_date" value={presetRange.end} />
                      <label className="workspace-toggle">
                        <span className="workspace-toggle__control">
                          <input type="checkbox" name="include_page" defaultChecked />
                        </span>
                        <span className="workspace-toggle__label">Include page dimension</span>
                      </label>
                      <div className="toolbar-actions">
                        <button type="submit">Fetch &amp; Analyze</button>
                      </div>
                    </form>
                    <form action={clearProjectGscAction}>
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="return_to" value={buildHref(params, { tab: "search" })} />
                      <button type="submit" className="button-secondary">Reset Data</button>
                    </form>
                  </div>
                </div>
              </Panel>

              <Panel title="Search Console Insights" description="Analyze your stored Search Console data">
                <div className="tab-links dashboard-subtabs">
                  <TabLink href={buildHref(params, { tab: "search", search_view: "all" })} label="All Queries" active={activeSearchTab === "all"} />
                  <TabLink href={buildHref(params, { tab: "search", search_view: "new" })} label="New Discoveries" active={activeSearchTab === "new"} />
                  <TabLink href={buildHref(params, { tab: "search", search_view: "opportunities" })} label="Opportunities" active={activeSearchTab === "opportunities"} />
                  <TabLink href={buildHref(params, { tab: "search", search_view: "top" })} label="Top Performers" active={activeSearchTab === "top"} />
                </div>

                {!gscRows.length ? <InfoBox tone="info">No GSC data available yet. Fetch data to see insights.</InfoBox> : null}

                {activeSearchTab === "all" && gscRows.length ? (
                  <DataTable
                    className="dashboard-table dashboard-table-scroll dashboard-table--gsc"
                    headers={["Query", "Clicks", "Impressions", "CTR", "Avg Position"]}
                    rows={gscRows.map((row) => [row.query, String(row.clicks), String(row.impressions), `${(row.ctr * 100).toFixed(2)}%`, row.position.toFixed(1)])}
                  />
                ) : null}

                {activeSearchTab === "new" && gscRows.length ? (
                  newDiscoveries.length ? (
                    <div className="dashboard-stack">
                      <div className="dashboard-mini-count">{`Found ${newDiscoveries.length} new opportunities`}</div>
                      <DataTable
                        className="dashboard-table dashboard-table-scroll dashboard-table--gsc"
                        headers={["Query", "Clicks", "Impressions", "CTR", "Avg Position"]}
                        rows={newDiscoveries.map((row) => [row.query, String(row.clicks), String(row.impressions), `${(row.ctr * 100).toFixed(2)}%`, row.position.toFixed(1)])}
                      />
                        <form action={addKeywordsAction} className="dashboard-selection-form dashboard-selection-form--inline">
                          <input type="hidden" name="project_id" value={project.id} />
                          <input type="hidden" name="return_to" value={buildHref(params, { tab: "search", search_view: "new" })} />
                          <div className="workspace-form__field dashboard-selection-form__field">
                            <span className="dashboard-selection-label">Select queries to add to keyword list</span>
                            <MultiSelectDropdown name="keywords" options={newDiscoveryOptions} />
                          </div>
                          <div className="toolbar-actions dashboard-selection-form__actions">
                            <button type="submit">Add Selected to Keywords</button>
                          </div>
                        </form>
                    </div>
                  ) : (
                    <InfoBox tone="info">No new discoveries found. All stored queries already exist in your keyword list.</InfoBox>
                  )
                ) : null}

                {activeSearchTab === "opportunities" && gscRows.length ? (
                  <div className="dashboard-stack">
                    <div className="surface-grid-2">
                      <SubPanel title="Quick Wins" description="Queries sitting just outside page one"><div className="dashboard-mini-count">{detailedOpportunities.quick_wins.length} queries</div></SubPanel>
                      <SubPanel title="Low Hanging Fruit" description="Queries already close to the top but worth lifting"><div className="dashboard-mini-count">{detailedOpportunities.low_hanging_fruit.length} queries</div></SubPanel>
                      <SubPanel title="High Impressions / Low CTR" description="Strong visibility but weak clickthrough"><div className="dashboard-mini-count">{detailedOpportunities.high_impressions_low_ctr.length} queries</div></SubPanel>
                      <SubPanel title="High Impressions / Poor Position" description="Visibility is there, ranking still needs work"><div className="dashboard-mini-count">{detailedOpportunities.high_impressions_poor_position.length} queries</div></SubPanel>
                    </div>
                    <DataTable
                      className="dashboard-table dashboard-table-scroll dashboard-table--gsc dashboard-table--gsc-all"
                      headers={["Query", "Clicks", "Impressions", "CTR", "Avg Position", "Page"]}
                      rows={allOpportunities.slice(0, 50).map((row) => [row.query, String(row.clicks), String(row.impressions), `${(row.ctr * 100).toFixed(2)}%`, row.position.toFixed(1), shortUrl(row.page_url)])}
                    />
                  </div>
                ) : null}

                {activeSearchTab === "top" && gscRows.length ? (
                  <div className="dashboard-stack">
                    <div className="surface-grid-3">
                      <StatTile label="Total Clicks" value={String(gscRows.reduce((sum, row) => sum + row.clicks, 0))} detail="Across all stored rows" />
                      <StatTile label="Total Impressions" value={String(gscRows.reduce((sum, row) => sum + row.impressions, 0))} detail="Across all stored rows" />
                      <StatTile label="Related Clusters" value={String(groupedQueries.length)} detail="Query families found" />
                    </div>
                    <DataTable
                      className="dashboard-table dashboard-table-scroll dashboard-table--gsc dashboard-table--gsc-all"
                      headers={["Query", "Clicks", "Impressions", "CTR", "Avg Position"]}
                      rows={[...gscRows].sort((a, b) => b.clicks - a.clicks).slice(0, 50).map((row) => [row.query, String(row.clicks), String(row.impressions), `${(row.ctr * 100).toFixed(2)}%`, row.position.toFixed(1)])}
                    />
                  </div>
                ) : null}
              </Panel>

              <Panel title="Page Performance" description="Filter stored page rows by page URL and date range">
                {gscRows.length ? (
                  <div className="dashboard-stack">
                    <form method="get" className="workspace-form dashboard-page-filter-form">
                      <input type="hidden" name="project" value={project.id} />
                      <input type="hidden" name="tab" value="search" />
                      <input type="hidden" name="search_view" value={activeSearchTab} />
                      <input type="hidden" name="selected_property" value={selectedProperty} />
                      <input type="hidden" name="preset_days" value={String(presetDays)} />
                      <div className="surface-grid-2">
                        <label className="workspace-form__field">
                          <span className="eyebrow">Find URL</span>
                          <input name="page_search" defaultValue={pageSearch} placeholder="Type to filter URLs" />
                        </label>
                        <label className="workspace-form__field">
                          <span className="eyebrow">Page URL</span>
                          <select name="page_filter" defaultValue={pageFilter}>
                            <option value="all">All pages</option>
                            {visiblePageOptions.map((page) => (
                              <option key={page} value={page}>{page}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="surface-grid-2">
                        <label className="workspace-form__field">
                          <span className="eyebrow">Start Date</span>
                          <input type="date" name="page_start" defaultValue={pageStart} />
                        </label>
                        <label className="workspace-form__field">
                          <span className="eyebrow">End Date</span>
                          <input type="date" name="page_end" defaultValue={pageEnd} />
                        </label>
                      </div>
                      <div className="toolbar-actions">
                        <button type="submit" className="button-secondary">Apply Page Filters</button>
                      </div>
                    </form>

                    {pageScopedRows.length ? (
                      <>
                        <div className="metric-strip dashboard-metric-strip">
                          <StatTile label="Total Clicks" value={String(pagePerformanceMetrics.clicks)} detail="Filtered rows" />
                          <StatTile label="Total Impressions" value={String(pagePerformanceMetrics.impressions)} detail="Filtered rows" />
                          <StatTile label="Avg CTR" value={`${pagePerformanceMetrics.ctr.toFixed(2)}%`} detail="Stored row average" />
                          <StatTile label="Avg Position" value={pagePerformanceMetrics.position.toFixed(1)} detail="Stored row average" />
                        </div>
                        <DataTable
                          className="dashboard-table dashboard-table-scroll"
                          headers={["Page", "Queries", "Clicks", "Impressions", "Avg CTR", "Avg Position"]}
                          rows={pagePerformance.map((row) => [shortUrl(row.page, 72), String(row.query_count), String(row.total_clicks), String(row.total_impressions), `${(row.avg_ctr * 100).toFixed(2)}%`, row.avg_position.toFixed(1)])}
                        />
                      </>
                    ) : (
                      <InfoBox tone="warning">No page performance data returned for the selected filters.</InfoBox>
                    )}
                  </div>
                ) : (
                  <InfoBox tone="info">No GSC data available yet. Fetch data to see page performance.</InfoBox>
                )}
              </Panel>

              <Panel title="Export to Google Sheets" description="Push GSC queries and cannibalization reports to Sheets">
                <div className="dashboard-sheet-actions dashboard-sheet-actions--full">
                  <form action={syncGscSheetAction}>
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="return_to" value={buildHref(params, { tab: "search", search_view: activeSearchTab })} />
                    <button type="submit">Sync GSC Queries</button>
                  </form>
                  <form action={syncCannibalizationSheetAction}>
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="return_to" value={buildHref(params, { tab: "search", search_view: activeSearchTab })} />
                    <button type="submit" className="button-secondary">Sync Cannibalization</button>
                  </form>
                </div>
              </Panel>
            </>
          )}

          {!gscConnected ? (
            <>
              <Panel title="Search Console Insights" description="Analyze your stored Search Console data">
                <div className="tab-links dashboard-subtabs">
                  <TabLink href={buildHref(params, { tab: "search", search_view: "all" })} label="All Queries" active={activeSearchTab === "all"} />
                  <TabLink href={buildHref(params, { tab: "search", search_view: "new" })} label="New Discoveries" active={activeSearchTab === "new"} />
                  <TabLink href={buildHref(params, { tab: "search", search_view: "opportunities" })} label="Opportunities" active={activeSearchTab === "opportunities"} />
                  <TabLink href={buildHref(params, { tab: "search", search_view: "top" })} label="Top Performers" active={activeSearchTab === "top"} />
                </div>

                {!gscRows.length ? <InfoBox tone="info">No GSC data available yet. Fetch data to see insights.</InfoBox> : null}

                {activeSearchTab === "all" && gscRows.length ? (
                  <DataTable
                    className="dashboard-table dashboard-table-scroll dashboard-table--gsc"
                    headers={["Query", "Clicks", "Impressions", "CTR", "Avg Position"]}
                    rows={gscRows.map((row) => [row.query, String(row.clicks), String(row.impressions), `${(row.ctr * 100).toFixed(2)}%`, row.position.toFixed(1)])}
                  />
                ) : null}

                {activeSearchTab === "new" && gscRows.length ? (
                  newDiscoveries.length ? (
                    <div className="dashboard-stack">
                      <div className="dashboard-mini-count">{`Found ${newDiscoveries.length} new opportunities`}</div>
                      <DataTable
                        className="dashboard-table dashboard-table-scroll dashboard-table--gsc"
                        headers={["Query", "Clicks", "Impressions", "CTR", "Avg Position"]}
                        rows={newDiscoveries.map((row) => [row.query, String(row.clicks), String(row.impressions), `${(row.ctr * 100).toFixed(2)}%`, row.position.toFixed(1)])}
                      />
                        <form action={addKeywordsAction} className="dashboard-selection-form dashboard-selection-form--inline">
                          <input type="hidden" name="project_id" value={project.id} />
                          <input type="hidden" name="return_to" value={buildHref(params, { tab: "search", search_view: "opportunities" })} />
                          <div className="workspace-form__field dashboard-selection-form__field">
                            <span className="dashboard-selection-label">Select queries to add to keyword list</span>
                            <MultiSelectDropdown name="keywords" options={newDiscoveryOptions} />
                          </div>
                          <div className="toolbar-actions dashboard-selection-form__actions">
                            <button type="submit">Add Selected to Keywords</button>
                          </div>
                        </form>
                    </div>
                  ) : (
                    <InfoBox tone="info">No new discoveries found. All stored queries already exist in your keyword list.</InfoBox>
                  )
                ) : null}

                {activeSearchTab === "opportunities" && gscRows.length ? (
                  <div className="dashboard-stack">
                    <div className="surface-grid-2">
                      <SubPanel title="Quick Wins" description="Queries sitting just outside page one"><div className="dashboard-mini-count">{detailedOpportunities.quick_wins.length} queries</div></SubPanel>
                      <SubPanel title="Low Hanging Fruit" description="Queries already close to the top but worth lifting"><div className="dashboard-mini-count">{detailedOpportunities.low_hanging_fruit.length} queries</div></SubPanel>
                      <SubPanel title="High Impressions / Low CTR" description="Strong visibility but weak clickthrough"><div className="dashboard-mini-count">{detailedOpportunities.high_impressions_low_ctr.length} queries</div></SubPanel>
                      <SubPanel title="High Impressions / Poor Position" description="Visibility is there, ranking still needs work"><div className="dashboard-mini-count">{detailedOpportunities.high_impressions_poor_position.length} queries</div></SubPanel>
                    </div>
                    <DataTable
                      className="dashboard-table dashboard-table-scroll dashboard-table--gsc"
                      headers={["Query", "Clicks", "Impressions", "CTR", "Avg Position", "Page"]}
                      rows={allOpportunities.slice(0, 50).map((row) => [row.query, String(row.clicks), String(row.impressions), `${(row.ctr * 100).toFixed(2)}%`, row.position.toFixed(1), shortUrl(row.page_url)])}
                    />
                  </div>
                ) : null}

                {activeSearchTab === "top" && gscRows.length ? (
                  <div className="dashboard-stack">
                    <div className="surface-grid-3">
                      <StatTile label="Total Clicks" value={String(gscRows.reduce((sum, row) => sum + row.clicks, 0))} detail="Across all stored rows" />
                      <StatTile label="Total Impressions" value={String(gscRows.reduce((sum, row) => sum + row.impressions, 0))} detail="Across all stored rows" />
                      <StatTile label="Related Clusters" value={String(groupedQueries.length)} detail="Query families found" />
                    </div>
                    <DataTable
                      className="dashboard-table dashboard-table-scroll dashboard-table--gsc"
                      headers={["Query", "Clicks", "Impressions", "CTR", "Avg Position"]}
                      rows={[...gscRows].sort((a, b) => b.clicks - a.clicks).slice(0, 50).map((row) => [row.query, String(row.clicks), String(row.impressions), `${(row.ctr * 100).toFixed(2)}%`, row.position.toFixed(1)])}
                    />
                  </div>
                ) : null}
              </Panel>

              <Panel title="Page Performance" description="Filter by page URL and date range">
                <InfoBox tone="info">Connect Google Search Console to view page performance.</InfoBox>
              </Panel>

              <Panel title="Export to Google Sheets" description="Push GSC queries and cannibalization reports to Sheets">
                <div className="dashboard-sheet-actions dashboard-sheet-actions--full">
                  <form action={syncGscSheetAction}>
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="return_to" value={buildHref(params, { tab: "search", search_view: activeSearchTab })} />
                    <button type="submit">Sync GSC Queries</button>
                  </form>
                  <form action={syncCannibalizationSheetAction}>
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="return_to" value={buildHref(params, { tab: "search", search_view: activeSearchTab })} />
                    <button type="submit" className="button-secondary">Sync Cannibalization</button>
                  </form>
                </div>
              </Panel>
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === "cannibalization" ? (
        <>
          {!gscRows.length ? (
            <Panel title="Cannibalization" description="Search Console data is required before analyzing page conflicts">
              <InfoBox tone="info">No GSC data available. Fetch data first in the Search Console tab.</InfoBox>
            </Panel>
          ) : (
            <>
              <div className="tab-links dashboard-subtabs">
                <TabLink href={buildHref(params, { tab: "cannibalization", cannibal_view: "gsc" })} label="GSC Queries" active={activeCannibalizationTab === "gsc"} />
                <TabLink href={buildHref(params, { tab: "cannibalization", cannibal_view: "tracked" })} label="Tracked Keywords" active={activeCannibalizationTab === "tracked"} />
              </div>

              {activeCannibalizationTab === "gsc" ? (
                <>
                  <Panel title="Cannibalization Summary" description="Overview of cannibalization status">
                    <div className="metric-strip dashboard-metric-strip">
                      <StatTile label="Total Queries" value={String(new Set(gscRows.map((row) => row.query)).size)} detail="Stored Search Console queries" />
                      <StatTile label="Cannibalized Queries" value={String(gscCases.length)} detail="Queries with multiple pages" />
                      <StatTile label="Total Pages" value={String(gscCases.reduce((sum, item) => sum + item.numPages, 0))} detail="Competing page instances" />
                      <StatTile label="Total Impressions" value={String(gscCases.reduce((sum, item) => sum + item.totalImpressions, 0))} detail="Across cannibalized queries" />
                    </div>
                  </Panel>

                  <Panel title="GSC Query Cases" description="Review overlapping pages detected from stored query/page rows">
                    {gscCases.length ? (
                      <div className="dashboard-accordion-list">
                        {gscCases.map((item) => (
                          <details key={item.query} className="dashboard-accordion">
                            <summary>
                              <span>{`${item.query} (${item.numPages} pages)`}</span>
                              <span>{`${item.totalClicks} clicks, ${item.totalImpressions} impressions`}</span>
                            </summary>
                            <div className="dashboard-accordion-body">
                              <div className="surface-grid-3">
                                <StatTile label="Pages Ranking" value={String(item.numPages)} detail="Competing URLs" />
                                <StatTile label="Best Position" value={item.bestPosition.toFixed(1)} detail="Top-performing page" />
                                <StatTile label="Worst Position" value={item.worstPosition.toFixed(1)} detail="Weakest competing page" />
                              </div>
                              <DataTable
                                className="dashboard-table dashboard-table-inline"
                                headers={["Page", "Position", "Clicks", "Impressions", "CTR"]}
                                rows={item.pages.map((page) => [shortUrl(page.page, 72), page.position.toFixed(1), String(page.clicks), String(page.impressions), `${(page.ctr * 100).toFixed(2)}%`])}
                              />
                              <InfoBox tone="warning">Recommendation: consolidate content to the best-performing page and redirect competing pages.</InfoBox>
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <InfoBox tone="success">No cannibalization found in Search Console queries.</InfoBox>
                    )}
                  </Panel>
                </>
              ) : null}

              {activeCannibalizationTab === "tracked" ? (
                <>
                  <Panel title="Cannibalization Summary" description="Overview of tracked-keyword cannibalization status">
                    <div className="metric-strip dashboard-metric-strip">
                      <StatTile label="Target Keywords" value={String(keywords.length)} detail="Tracked in this project" />
                      <StatTile label="Found in GSC" value={String(new Set(trackedRows.map((row) => row.query.toLowerCase())).size)} detail="Tracked keywords with GSC rows" />
                      <StatTile label="Active Cannibalization" value={String(activeTrackedCases.length)} detail="Still unresolved" />
                      <StatTile label="Resolved Cases" value={String(resolvedTrackedCases.length)} detail="Marked complete" />
                    </div>
                  </Panel>

                  <div className="tab-links dashboard-subtabs">
                    <TabLink href={buildHref(params, { tab: "cannibalization", cannibal_view: "tracked", tracked_view: "active" })} label="Active Cannibalization" active={activeTrackedTab === "active"} />
                    <TabLink href={buildHref(params, { tab: "cannibalization", cannibal_view: "tracked", tracked_view: "resolved" })} label="Resolved Cases" active={activeTrackedTab === "resolved"} />
                    <TabLink href={buildHref(params, { tab: "cannibalization", cannibal_view: "tracked", tracked_view: "all" })} label="All Keywords" active={activeTrackedTab === "all"} />
                  </div>

                  {activeTrackedTab === "active" ? (
                    <Panel title="Active Cannibalization" description="Tracked keywords currently showing multiple competing pages">
                      {activeTrackedCases.length ? (
                        <div className="dashboard-accordion-list">
                          {activeTrackedCases.map((item) => (
                            <details key={item.query} className="dashboard-accordion">
                              <summary>
                                <span>{`${item.query} (${item.numPages} pages)`}</span>
                                <span>{`${item.totalClicks} clicks, ${item.totalImpressions} impressions`}</span>
                              </summary>
                              <div className="dashboard-accordion-body">
                                <DataTable
                                  className="dashboard-table dashboard-table-inline"
                                  headers={["Page", "Position", "Clicks", "Impressions", "CTR"]}
                                  rows={item.pages.map((page) => [shortUrl(page.page, 72), page.position.toFixed(1), String(page.clicks), String(page.impressions), `${(page.ctr * 100).toFixed(2)}%`])}
                                />
                                <form action={markCannibalizationAction} className="dashboard-note-form">
                                  <input type="hidden" name="project_id" value={project.id} />
                                  <input type="hidden" name="keyword" value={item.query} />
                                  <input type="hidden" name="mode" value="resolve" />
                                  <input type="hidden" name="return_to" value={buildHref(params, { tab: "cannibalization", cannibal_view: activeCannibalizationTab, tracked_view: activeTrackedTab })} />
                                  <label className="workspace-form__field">
                                    <span className="eyebrow">Resolution notes (optional)</span>
                                    <input name="notes" placeholder="Merged content and redirected supporting pages" />
                                  </label>
                                  <div className="toolbar-actions">
                                    <button type="submit">Mark as Resolved</button>
                                  </div>
                                </form>
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : (
                        <InfoBox tone="success">No active cannibalization detected for your target keywords.</InfoBox>
                      )}
                    </Panel>
                  ) : null}

                  {activeTrackedTab === "resolved" ? (
                    <Panel title="Resolved Cases" description="Tracked keywords that have already been marked resolved">
                      {resolvedTrackedCases.length ? (
                        <div className="dashboard-accordion-list">
                          {resolvedTrackedCases.map((item) => (
                            <details key={item.query} className="dashboard-accordion">
                              <summary>
                                <span>{`${item.query} (${item.numPages} pages)`}</span>
                                <span>{resolvedMap.get(item.query.toLowerCase())?.notes || "Resolved"}</span>
                              </summary>
                              <div className="dashboard-accordion-body">
                                <DataTable
                                  className="dashboard-table dashboard-table-inline"
                                  headers={["Page", "Position", "Clicks", "Impressions", "CTR"]}
                                  rows={item.pages.map((page) => [shortUrl(page.page, 72), page.position.toFixed(1), String(page.clicks), String(page.impressions), `${(page.ctr * 100).toFixed(2)}%`])}
                                />
                                <form action={markCannibalizationAction}>
                                  <input type="hidden" name="project_id" value={project.id} />
                                  <input type="hidden" name="keyword" value={item.query} />
                                  <input type="hidden" name="mode" value="unresolve" />
                                  <input type="hidden" name="return_to" value={buildHref(params, { tab: "cannibalization", cannibal_view: activeCannibalizationTab, tracked_view: activeTrackedTab })} />
                                  <button type="submit" className="button-secondary">Unmark as Resolved</button>
                                </form>
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : (
                        <InfoBox tone="info">No resolved cases yet.</InfoBox>
                      )}
                    </Panel>
                  ) : null}

                  {activeTrackedTab === "all" ? (
                    <Panel title="All Keywords" description="Tracked keywords matched against stored Search Console rows">
                      <DataTable
                        className="dashboard-table dashboard-table-scroll"
                        headers={["Keyword", "Found in GSC", "Pages", "Clicks", "Impressions", "Resolved"]}
                        rows={allTrackedKeywordRows.map((row) => [
                          row.keyword,
                          row.found ? <Pill tone="success">Yes</Pill> : <Pill tone="warning">No</Pill>,
                          String(row.pages),
                          String(row.clicks),
                          String(row.impressions),
                          row.resolved ? <Pill tone="success">Resolved</Pill> : <Pill tone="neutral">Active</Pill>,
                        ])}
                      />
                    </Panel>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {activeTab === "settings" ? (
        <Panel title="Project Settings" description="Edit the core details for this project">
          <form action={updateProjectAction} className="workspace-form">
            <input type="hidden" name="id" value={project.id} />
            <input type="hidden" name="return_to" value={buildHref(params, { tab: "settings" })} />
            <div className="surface-grid-2 dashboard-settings-grid">
              <label className="workspace-form__field">
                <span className="eyebrow">Name</span>
                <input name="name" defaultValue={project.name} />
              </label>
              <label className="workspace-form__field">
                <span className="eyebrow">URL</span>
                <input name="url" defaultValue={project.url} />
              </label>
              <label className="workspace-form__field">
                <span className="eyebrow">Location</span>
                <input name="target_location" defaultValue={project.target_location} />
              </label>
              <label className="workspace-form__field">
                <span className="eyebrow">Frequency</span>
                <select name="update_frequency" defaultValue={project.update_frequency}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="workspace-form__field">
                <span className="eyebrow">GSC Property</span>
                <input name="gsc_property" defaultValue={project.gsc_property ?? ""} />
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
              <button type="submit">Save Changes</button>
              <a href={buildHref(params, { tab: "settings" })} className="dashboard-action dashboard-action--secondary dashboard-action--link">Cancel</a>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
