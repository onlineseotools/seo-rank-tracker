import { ProjectPicker } from "@/components/project-picker";
import { InfoBox, Panel, PageIntro, Pill } from "@/components/ui";
import { addKeywordsAction, deleteKeywordsAction } from "@/lib/server/actions";
import { resolveProjectContext } from "@/lib/server/project-context";
import { getBestRank, getRankingsByProject } from "@/lib/server/repo";
import { requireSessionUser } from "@/lib/server/session";

export default async function KeywordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const status = firstParam(params.status);
  const message = firstParam(params.message);
  const { projects, project } = await resolveProjectContext(user, Promise.resolve(params), true);
  const rankings = project ? getRankingsByProject(project.id, true) : [];
  const keywordRows = rankings.map((row) => ({
    id: row.id,
    keyword: row.keyword,
    projectName: project?.name ?? "Project",
    intent: "Tracked keyword",
    currentRank: row.position,
    previousRank: row.previous_position,
    bestRank: getBestRank(row.id),
    url: row.url_found ?? "Not ranked",
    freshness: row.checked_at ? `checked ${row.checked_at}` : "awaiting first run",
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Keyword management with one working surface for import, review, and action."
        subtitle="The portfolio table and intake rail work off the real SQLite dataset, so you can add, review, and remove tracked keywords directly in the new app."
        badge="Keyword portfolio"
      />

      {message ? <InfoBox tone={status === "error" ? "error" : status === "warning" ? "warning" : "success"}>{message}</InfoBox> : null}

      <Panel kicker="Scope" title="Project selection" description="Choose the project variant you want to manage before adding or deleting keywords.">
        <ProjectPicker projects={projects} selectedProjectId={project?.id ?? null} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.72fr,1.28fr]">
        <Panel kicker="Intake" title="Add and import keywords" description="Designed as a compact operator rail rather than a full page form stack.">
          {project ? (
            <form action={addKeywordsAction} className="grid gap-4">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="return_to" value={`/keywords?project=${project.id}`} />
              <div className="panel-soft rounded-[22px] p-4">
                <div className="eyebrow">Target project</div>
                <div className="mt-3 text-sm text-[var(--text)]">{project.name}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{project.target_location}</div>
              </div>
              <div className="panel-soft rounded-[22px] p-4">
                <div className="eyebrow">Paste keywords</div>
                <textarea
                  name="keywords"
                  className="mt-3 min-h-48 w-full rounded-[18px] border border-white/8 bg-black/10 px-4 py-3 text-sm leading-7 text-[var(--muted)] outline-none"
                  placeholder={"bioavailability studies\nclinical research services\nvision inspection machine"}
                />
              </div>
              <button className="rounded-[20px] bg-[var(--green)] px-4 py-3 font-medium text-slate-950">Add keywords</button>
            </form>
          ) : (
            <div className="text-sm text-[var(--muted)]">Create a project first.</div>
          )}
        </Panel>

        <Panel kicker="Portfolio" title="Tracked keywords" description="Latest rank, previous rank, best rank, and ranking URL in one table view.">
          <div className="table-grid">
            <div className="table-row table-head">
              <div>Keyword</div>
              <div>Project</div>
              <div>Current</div>
              <div>Previous</div>
              <div>Best</div>
              <div>Freshness</div>
            </div>
            {keywordRows.map((row) => (
              <div key={row.keyword} className="table-row">
                <div>
                  <div className="font-medium">{row.keyword}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone="neutral">{row.intent}</Pill>
                    <Pill tone={row.currentRank === null ? "danger" : "success"}>
                      {row.currentRank === null ? "failed run" : row.url}
                    </Pill>
                  </div>
                </div>
                <div className="text-sm text-[var(--muted)]">{row.projectName}</div>
                <div className="text-xl font-semibold">{row.currentRank ?? "NR"}</div>
                <div className="text-sm text-[var(--muted)]">{row.previousRank ?? "-"}</div>
                <div className="text-sm text-[var(--muted)]">{row.bestRank ?? "-"}</div>
                <div className="text-sm text-[var(--muted)]">{row.freshness}</div>
              </div>
            ))}
          </div>
          {keywordRows.length ? (
            <form action={deleteKeywordsAction} className="mt-5 flex gap-3">
              <input type="hidden" name="project_id" value={project?.id ?? ""} />
              <input type="hidden" name="return_to" value={project ? `/keywords?project=${project.id}` : "/keywords"} />
              <input type="hidden" name="keyword_ids" value={keywordRows.map((row) => row.id).join(",")} />
              <button className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                Delete all shown keywords
              </button>
            </form>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
