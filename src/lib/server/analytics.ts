import "server-only";

export type GscRow = {
  query: string;
  page_url: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date_range_start?: string | null;
  date_range_end?: string | null;
};

function uniqueTokens(query: string) {
  return new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

export function detectCannibalization(rows: GscRow[], threshold = 2) {
  const grouped = new Map<string, GscRow[]>();
  for (const row of rows) {
    if (!row.page_url) continue;
    const list = grouped.get(row.query) ?? [];
    list.push(row);
    grouped.set(row.query, list);
  }

  return [...grouped.entries()]
    .filter(([, items]) => items.length >= threshold)
    .map(([query, items]) => {
      const sorted = [...items].sort((a, b) => a.position - b.position);
      return {
        query,
        num_pages: sorted.length,
        primary_page: sorted[0]?.page_url ?? "",
        pages: sorted.map((item) => item.page_url ?? ""),
        total_clicks: sorted.reduce((sum, item) => sum + item.clicks, 0),
        total_impressions: sorted.reduce((sum, item) => sum + item.impressions, 0),
        best_position: sorted[0]?.position ?? 0,
        worst_position: sorted[sorted.length - 1]?.position ?? 0,
      };
    })
    .sort((a, b) => b.total_impressions - a.total_impressions);
}

export function findOpportunities(rows: GscRow[]) {
  return rows
    .filter((row) => (row.ctr < 0.02 && row.impressions > 100) || (row.position > 10 && row.impressions > 100))
    .sort((a, b) => b.impressions - a.impressions);
}

export function findDetailedOpportunities(rows: GscRow[]) {
  const sorted = [...rows].sort((a, b) => b.impressions - a.impressions);
  return {
    quick_wins: sorted.filter((row) => row.position > 10 && row.position <= 20 && row.impressions > 100),
    low_hanging_fruit: sorted.filter((row) => row.position >= 4 && row.position <= 10 && row.impressions > 100),
    high_impressions_low_ctr: sorted.filter((row) => row.impressions > 250 && row.ctr < 0.02),
    high_impressions_poor_position: sorted.filter((row) => row.impressions > 250 && row.position > 20),
  };
}

function aggregateByQuery(rows: GscRow[]) {
  const aggregated = new Map<
    string,
    {
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
      pages: Set<string>;
    }
  >();

  for (const row of rows) {
    const existing =
      aggregated.get(row.query) ??
      {
        query: row.query,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        pages: new Set<string>(),
      };
    existing.clicks += row.clicks;
    existing.impressions += row.impressions;
    existing.ctr += row.ctr * row.impressions;
    existing.position += row.position * row.impressions;
    if (row.page_url) existing.pages.add(row.page_url);
    aggregated.set(row.query, existing);
  }

  return [...aggregated.values()].map((row) => ({
    query: row.query,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.impressions ? row.ctr / row.impressions : 0,
    position: row.impressions ? row.position / row.impressions : 0,
    pages: [...row.pages],
  }));
}

export function compareQueryPeriods(currentRows: GscRow[], previousRows: GscRow[]) {
  const current = new Map(aggregateByQuery(currentRows).map((row) => [row.query, row]));
  const previous = new Map(aggregateByQuery(previousRows).map((row) => [row.query, row]));

  const newQueries = [...current.values()].filter((row) => !previous.has(row.query));
  const lostQueries = [...previous.values()].filter((row) => !current.has(row.query));
  const improvedQueries = [...current.values()]
    .filter((row) => previous.has(row.query))
    .map((row) => {
      const prior = previous.get(row.query)!;
      return {
        query: row.query,
        current_position: row.position,
        previous_position: prior.position,
        position_change: prior.position - row.position,
        current_clicks: row.clicks,
      };
    })
    .filter((row) => row.position_change > 0)
    .sort((a, b) => b.position_change - a.position_change);
  const declinedQueries = [...current.values()]
    .filter((row) => previous.has(row.query))
    .map((row) => {
      const prior = previous.get(row.query)!;
      return {
        query: row.query,
        current_position: row.position,
        previous_position: prior.position,
        position_change: prior.position - row.position,
        current_clicks: row.clicks,
      };
    })
    .filter((row) => row.position_change < 0)
    .sort((a, b) => a.position_change - b.position_change);

  return {
    new_queries: newQueries,
    lost_queries: lostQueries,
    improved_queries: improvedQueries,
    declined_queries: declinedQueries,
  };
}

export function groupRelatedQueries(rows: GscRow[], similarityThreshold = 0.5) {
  const queries = aggregateByQuery(rows);
  const used = new Set<string>();
  const groups: Array<{
    primary_query: string;
    query_count: number;
    total_clicks: number;
    total_impressions: number;
    avg_position: number;
    avg_ctr: number;
    keywords: string[];
    queries: typeof queries;
  }> = [];

  for (const row of queries) {
    if (used.has(row.query)) continue;
    const seedTokens = uniqueTokens(row.query);
    const related = queries.filter((candidate) => !used.has(candidate.query) && jaccard(seedTokens, uniqueTokens(candidate.query)) >= similarityThreshold);
    related.forEach((candidate) => used.add(candidate.query));
    groups.push({
      primary_query: row.query,
      query_count: related.length,
      total_clicks: related.reduce((sum, candidate) => sum + candidate.clicks, 0),
      total_impressions: related.reduce((sum, candidate) => sum + candidate.impressions, 0),
      avg_position: related.reduce((sum, candidate) => sum + candidate.position, 0) / related.length,
      avg_ctr: related.reduce((sum, candidate) => sum + candidate.ctr, 0) / related.length,
      keywords: [...new Set(related.flatMap((candidate) => [...uniqueTokens(candidate.query)]))],
      queries: related,
    });
  }

  return groups.sort((a, b) => b.total_impressions - a.total_impressions);
}

export function analyzePagePerformance(rows: GscRow[]) {
  const grouped = new Map<string, GscRow[]>();
  for (const row of rows) {
    const page = row.page_url ?? "Unknown";
    const list = grouped.get(page) ?? [];
    list.push(row);
    grouped.set(page, list);
  }

  return [...grouped.entries()]
    .map(([page, pageRows]) => ({
      page,
      query_count: pageRows.length,
      total_clicks: pageRows.reduce((sum, row) => sum + row.clicks, 0),
      total_impressions: pageRows.reduce((sum, row) => sum + row.impressions, 0),
      avg_position: pageRows.reduce((sum, row) => sum + row.position, 0) / pageRows.length,
      avg_ctr: pageRows.reduce((sum, row) => sum + row.ctr, 0) / pageRows.length,
      top_queries: [...pageRows].sort((a, b) => b.clicks - a.clicks).slice(0, 10),
    }))
    .sort((a, b) => b.total_clicks - a.total_clicks);
}

export function calculateVisibilityScore(rows: GscRow[]) {
  const totalImpressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  if (!totalImpressions) return 0;

  const weighted = rows.reduce((sum, row) => {
    const positionScore = Math.max(0, 100 - (row.position - 1) * 4);
    const ctrScore = Math.min(100, row.ctr * 1000);
    return sum + ((positionScore * 0.7 + ctrScore * 0.3) * row.impressions);
  }, 0);

  return Number((weighted / totalImpressions).toFixed(1));
}
