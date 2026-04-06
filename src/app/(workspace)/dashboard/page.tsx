import { Badge, DataTable, PageIntro, Panel, StatTile, TabLink } from "@/components/ui";
import { getProjectsForUser, getProjectStats, getRankingsByProject, getTopMovers } from "@/lib/server/repo";
import { requireSessionUser } from "@/lib/server/session";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildDashboardUrl(site: string, projectId: number, movers: string) {
  const params = new URLSearchParams();
  params.set("site", site);
  params.set("project", String(projectId));
  params.set("movers", movers);
  return `/dashboard?${params.toString()}`;
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

function getDistribution(rows: ReturnType<typeof getRankingsByProject>) {
  const buckets = [
    { label: "1-3", count: 0, color: "#3fdb74" },
    { label: "4-10", count: 0, color: "#22c1f5" },
    { label: "11-20", count: 0, color: "#facc15" },
    { label: "21-50", count: 0, color: "#fb923c" },
    { label: "51-100", count: 0, color: "#60a5fa" },
    { label: "Not Ranked", count: 0, color: "#94a3b8" },
  ] satisfies DistributionBucket[];

  for (const row of rows) {
    const position = row.position;
    if (typeof position !== "number") {
      buckets[5].count += 1;
    } else if (position <= 3) {
      buckets[0].count += 1;
    } else if (position <= 10) {
      buckets[1].count += 1;
    } else if (position <= 20) {
      buckets[2].count += 1;
    } else if (position <= 50) {
      buckets[3].count += 1;
    } else {
      buckets[4].count += 1;
    }
  }

  return buckets;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function buildTrend(rows: ReturnType<typeof getRankingsByProject>) {
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const projects = getProjectsForUser(user.id, user.role === "admin", false);

  if (!projects.length) {
    return (
      <div className="dashboard-page">
        <PageIntro title="Dashboard" subtitle="Overview of your SEO performance and ranking trends" />
        <Panel title="Project Selection" description="Choose a website and location variant">
          <div className="info-box info-box--warning">
            <div className="info-box-content">No projects found. Please create a project first.</div>
          </div>
        </Panel>
      </div>
    );
  }

  const grouped = projects.reduce<Record<string, typeof projects>>((acc, project) => {
    acc[project.url] ??= [];
    acc[project.url].push(project);
    return acc;
  }, {});
  const sortedSites = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const requestedProjectId = Number(getSingle(params.project) ?? 0);
  const requestedProject = projects.find((project) => project.id === requestedProjectId) ?? null;
  const selectedSite = (requestedProject?.url ?? getSingle(params.site) ?? sortedSites[0]) as string;
  const variants = [...(grouped[selectedSite] ?? grouped[sortedSites[0]] ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const selectedProject = variants.find((project) => project.id === requestedProjectId) ?? variants[0];
  const projectId = selectedProject.id;
  const moversView = getSingle(params.movers) ?? "all";

  const stats = getProjectStats(projectId);
  const rankings = getRankingsByProject(projectId, true);
  const allRankings = getRankingsByProject(projectId, false);
  const distribution = getDistribution(rankings);
  const rankingTrend = buildTrend(allRankings);
  const distributionAxisMax = distribution.length ? getDistributionAxisMax(distribution) : 0;
  const distributionTicks = distribution.length ? getDistributionTicks(distributionAxisMax) : [];
  const trendTicks = rankingTrend.length ? getTrendTicks(rankingTrend) : [];
  const distributionChart = distribution.length
    ? (() => {
        const width = 560;
        const height = 290;
        const padding = { top: 16, right: 12, bottom: 62, left: 56 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const slotWidth = plotWidth / distribution.length;
        const barWidth = Math.min(72, slotWidth * 0.62);
        return { width, height, padding, plotWidth, plotHeight, slotWidth, barWidth };
      })()
    : null;
  const trendChart = rankingTrend.length
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
          points.length <= 4 ? points.map((_, index) => index) : [0, Math.floor((points.length - 1) / 2), points.length - 1],
        );
        return { width, height, padding, plotWidth, plotHeight, points, linePath, labelIndexes };
      })()
    : null;
  const topMovers = getTopMovers(projectId, 15);
  const improved = topMovers.filter((item) => item.change > 0);
  const declined = topMovers.filter((item) => item.change < 0);
  const tableRows =
    moversView === "improved"
      ? improved
      : moversView === "declined"
        ? declined
        : topMovers;

  return (
    <div className="dashboard-page">
      <PageIntro title="Dashboard" subtitle="Overview of your SEO performance and ranking trends" />

      <Panel title="Project Selection" description="Choose a website and location variant">
        <form method="get" className="dashboard-picker-form">
          <label className="grid gap-2">
            <span className="eyebrow">Website</span>
            <select name="site" defaultValue={selectedSite}>
              {sortedSites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="eyebrow">Variant</span>
            <select name="project" defaultValue={String(selectedProject.id)}>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>

          <input type="hidden" name="movers" value={moversView} />
          <div className="dashboard-picker-actions">
            <button type="submit" className="dashboard-action">
              Load Dashboard
            </button>
          </div>
        </form>

        <div className="dashboard-inline-note" style={{ marginTop: "0.9rem" }}>
          <Badge tone="success">
            {selectedProject.name} - {selectedProject.target_location}
          </Badge>
        </div>
      </Panel>

      <Panel title="Overview" description="Snapshot of your current ranking performance">
        <div className="metric-strip dashboard-metric-strip">
          <StatTile label="Total Keywords" value={String(stats.total_keywords)} detail="Active keywords" />
          <StatTile
            label="Avg Position"
            value={stats.average_position ? stats.average_position.toFixed(1) : "N/A"}
            detail="Across all keywords"
          />
          <StatTile
            label="Top 10 Rankings"
            value={String(stats.top_10_count)}
            detail={
              stats.total_keywords > 0
                ? `${Math.round((stats.top_10_count / stats.total_keywords) * 100)}% of keywords`
                : "0%"
            }
          />
          <StatTile
            label="Movers"
            value={`+${stats.improved_count} / -${stats.declined_count}`}
            detail="Since last check"
          />
        </div>
      </Panel>

      <Panel title="Performance Charts" description="Visual analysis of your ranking data">
        {!rankings.length ? (
          <div className="info-box info-box--info">
            <div className="info-box-content">
              No ranking data available yet. Use the Rank Checker to start tracking your keywords!
            </div>
          </div>
        ) : (
          <div className="dashboard-chart-grid">
            <div className="sub-panel">
              <div className="sub-panel-title">Ranking Distribution</div>
              <div className="sub-panel-subtitle">Current keyword positions grouped into buckets</div>
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
                    {distributionTicks.map((tick) => {
                      const y =
                        distributionChart.padding.top +
                        distributionChart.plotHeight -
                        (tick / distributionAxisMax) * distributionChart.plotHeight;
                      return (
                        <g key={`dashboard-distribution-tick-${tick}`}>
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

                    {distribution.map((bucket, index) => {
                      const barHeight = bucket.count === 0 ? 0 : (bucket.count / distributionAxisMax) * distributionChart.plotHeight;
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
                <div className="info-box info-box--info">
                  <div className="info-box-content">No ranking data available yet.</div>
                </div>
              )}
            </div>

            <div className="sub-panel">
              <div className="sub-panel-title">Average Position Trend</div>
              <div className="sub-panel-subtitle">Average position across recent ranking checks</div>
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
                    {trendTicks.map((tick) => {
                      const y =
                        trendChart.padding.top +
                        ((tick - trendTicks[0]) / (trendTicks[trendTicks.length - 1] - trendTicks[0] || 1)) * trendChart.plotHeight;
                      return (
                        <g key={`dashboard-trend-tick-${tick}`}>
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
                        <circle cx={point.x} cy={point.y} r="6.5" fill="rgba(37, 193, 245, 0.18)" />
                        <circle cx={point.x} cy={point.y} r="4" fill="#25c1f5" />
                        <text
                          x={point.x}
                          y={point.y - 12}
                          textAnchor="middle"
                          className="dashboard-chart-value-text"
                          style={{ fill: "#e9eef6" }}
                        >
                          {point.average.toFixed(1)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="info-box info-box--info">
                  <div className="info-box-content">No trend data available yet.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Top Movers" description="Keywords with the biggest ranking changes">
        {topMovers.length ? (
          <div className="dashboard-card-stack">
            <div className="dashboard-summary-grid">
              <div className="metric-card metric-info">
                <div className="card-kicker">Total Changes</div>
                <div className="card-value">{topMovers.length}</div>
              </div>
              <div className="metric-card metric-success">
                <div className="card-kicker">Improved</div>
                <div className="card-value">{improved.length}</div>
              </div>
              <div className="metric-card metric-danger">
                <div className="card-kicker">Declined</div>
                <div className="card-value">{declined.length}</div>
              </div>
            </div>

            <div className="tab-links">
              <TabLink href={buildDashboardUrl(selectedSite, projectId, "all")} label="All Changes" active={moversView === "all"} />
              <TabLink href={buildDashboardUrl(selectedSite, projectId, "improved")} label="Improved" active={moversView === "improved"} />
              <TabLink href={buildDashboardUrl(selectedSite, projectId, "declined")} label="Declined" active={moversView === "declined"} />
            </div>

            {tableRows.length ? (
              <DataTable
                headers={["Keyword", "Current", "Previous", "Change"]}
                rows={tableRows.map((row) => [
                  row.keyword,
                  row.position ?? "-",
                  row.previous_position ?? "-",
                  <span
                    key={`${row.keyword}-change`}
                    style={{ color: row.change > 0 ? "var(--accent)" : "var(--danger)", fontWeight: 700 }}
                  >
                    {row.change > 0 ? `+${row.change}` : row.change}
                  </span>,
                ])}
              />
            ) : (
              <div className="info-box info-box--info">
                <div className="info-box-content">
                  {moversView === "improved"
                    ? "No improved rankings in this period"
                    : "No declined rankings in this period"}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="info-box info-box--info">
            <div className="info-box-content">
              No ranking changes found yet. Rankings need at least two checks to show movement.
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
