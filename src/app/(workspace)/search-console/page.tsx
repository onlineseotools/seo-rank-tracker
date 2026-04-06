import { ProjectPicker } from "@/components/project-picker";
import { Panel, PageIntro, Pill } from "@/components/ui";
import { fetchLiveGscAction, importGscDataAction } from "@/lib/server/actions";
import { findOpportunities } from "@/lib/server/analytics";
import { listGscProperties } from "@/lib/server/google";
import { resolveProjectContext } from "@/lib/server/project-context";
import { getGscQueries, getNewGscDiscoveries } from "@/lib/server/repo";
import { requireSessionUser } from "@/lib/server/session";
import { getBaseUrl } from "@/lib/server/url";

export default async function SearchConsolePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const { projects, project } = await resolveProjectContext(user, searchParams, true);
  const gscRows = project ? getGscQueries(project.id) : [];
  const opportunities = findOpportunities(gscRows);
  const discoveries = project ? getNewGscDiscoveries(project.id) : [];
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 28);
  let properties: string[] = [];
  try {
    properties = await listGscProperties(user.id, await getBaseUrl());
  } catch {
    properties = [];
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Search Console analysis with clearer opportunity framing."
        subtitle="Stored Search Console rows are surfaced directly from the tracker database. You can also import fresh GSC JSON payloads into the selected project."
        badge="Search Console"
      />

      <Panel kicker="Scope" title="Project selection" description="Switch between project variants before importing or analyzing Search Console query data.">
        <ProjectPicker projects={projects} selectedProjectId={project?.id ?? null} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.82fr,1.18fr]">
        <Panel
          kicker="Connected property"
          title="Google Search Console state"
          description="Shows the active property, pull cadence, and how imported queries support the keyword and cannibalization workspaces."
        >
          <div className="grid gap-4">
            <div className="panel-soft rounded-[22px] p-5">
              <div className="text-lg font-semibold">{project?.name ?? "No project"}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">Property: {project?.gsc_property ?? "No GSC property stored"}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill tone={gscRows.length ? "success" : "warning"}>{gscRows.length ? `${gscRows.length} rows loaded` : "No data loaded"}</Pill>
                <Pill tone="neutral">{discoveries.length} new discoveries</Pill>
                <Pill tone="neutral">{opportunities.length} opportunities</Pill>
              </div>
            </div>
            {project ? (
              <form action={fetchLiveGscAction} className="panel-soft rounded-[22px] p-5">
                <input type="hidden" name="project_id" value={project.id} />
                <div className="eyebrow">Fetch live GSC rows</div>
                <div className="mt-3 grid gap-3">
                  <select
                    name="property"
                    defaultValue={project.gsc_property ?? properties[0] ?? ""}
                    className="rounded-[18px] border border-white/8 bg-black/10 px-4 py-3 text-sm text-[var(--muted)] outline-none"
                  >
                    {(properties.length ? properties : [project.gsc_property ?? ""]).map((property) => (
                      <option key={property} value={property}>
                        {property}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input type="date" name="start_date" defaultValue={startDate.toISOString().slice(0, 10)} className="rounded-[18px] border border-white/8 bg-black/10 px-4 py-3 text-sm" />
                    <input type="date" name="end_date" defaultValue={endDate.toISOString().slice(0, 10)} className="rounded-[18px] border border-white/8 bg-black/10 px-4 py-3 text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <input type="checkbox" name="include_page" defaultChecked />
                    Include page dimension
                  </label>
                </div>
                <button className="mt-4 rounded-[18px] border border-white/10 px-4 py-3 text-sm">Fetch live rows</button>
              </form>
            ) : null}
            {project ? (
              <form action={importGscDataAction} className="panel-soft rounded-[22px] p-5">
                <input type="hidden" name="project_id" value={project.id} />
                <div className="eyebrow">Import GSC JSON</div>
                <textarea
                  name="payload"
                  className="mt-3 min-h-48 w-full rounded-[18px] border border-white/8 bg-black/10 px-4 py-3 text-sm leading-7 text-[var(--muted)] outline-none"
                  placeholder='[{"query":"bioequivalence studies","clicks":12,"impressions":440,"ctr":0.027,"position":11.2,"page_url":"https://example.com/page"}]'
                />
                <button className="mt-4 rounded-[18px] bg-[var(--green)] px-4 py-3 font-medium text-slate-950">Import rows</button>
              </form>
            ) : null}
          </div>
        </Panel>

        <Panel
          kicker="Opportunity board"
          title="High-impression queries to act on"
          description="Queries with enough volume to justify title/meta changes, internal links, or page targeting decisions."
        >
          <div className="table-grid">
            <div className="table-row table-head">
              <div>Query</div>
              <div>Clicks</div>
              <div>Impressions</div>
              <div>CTR</div>
              <div>Position</div>
              <div>Recommended action</div>
            </div>
            {opportunities.map((opportunity) => (
              <div key={`${opportunity.query}-${opportunity.page_url ?? "nopage"}`} className="table-row">
                <div className="font-medium">{opportunity.query}</div>
                <div>{opportunity.clicks}</div>
                <div>{opportunity.impressions}</div>
                <div>{(opportunity.ctr * 100).toFixed(2)}%</div>
                <div>{opportunity.position.toFixed(1)}</div>
                <div className="text-sm text-[var(--muted)]">
                  {opportunity.position > 10 ? "Improve ranking page targeting" : "Improve CTR with title/meta refinement"}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
