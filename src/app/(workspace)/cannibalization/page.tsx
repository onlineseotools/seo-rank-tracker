import { ProjectPicker } from "@/components/project-picker";
import { InfoBox, Panel, PageIntro, Pill } from "@/components/ui";
import { markCannibalizationAction } from "@/lib/server/actions";
import { detectCannibalization } from "@/lib/server/analytics";
import { resolveProjectContext } from "@/lib/server/project-context";
import { getGscQueries, getResolvedCannibalization } from "@/lib/server/repo";
import { requireSessionUser } from "@/lib/server/session";

export default async function CannibalizationPage({
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
  const rows = project ? getGscQueries(project.id) : [];
  const resolved = new Set((project ? getResolvedCannibalization(project.id) : []).map((item) => item.keyword));
  const cannibalizationCases = detectCannibalization(rows).map((item) => ({
    ...item,
    projectName: project?.name ?? "Project",
    primaryPage: item.primary_page,
    severity: resolved.has(item.query) ? "Resolved" : item.num_pages > 2 ? "High" : "Medium",
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Cannibalization review focused on target keywords and page conflict."
        subtitle="Stored query-page pairs are analyzed the same way as the original tool: multiple pages for the same query are grouped, ranked, and marked resolved when action has been taken."
        badge="Cannibalization"
      />

      {message ? <InfoBox tone={status === "error" ? "error" : status === "warning" ? "warning" : "success"}>{message}</InfoBox> : null}

      <Panel kicker="Scope" title="Project selection" description="Review cannibalization one project variant at a time, just like the original workflow.">
        <ProjectPicker projects={projects} selectedProjectId={project?.id ?? null} />
      </Panel>

      <Panel kicker="Conflict map" title="Tracked keyword collisions" description="Each row shows which pages are competing, which page should lead, and whether the issue is still active.">
        <div className="grid gap-4">
          {cannibalizationCases.map((item) => (
            <div key={item.query} className="panel-soft rounded-[24px] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <div className="text-xl font-semibold tracking-[-0.03em]">{item.query}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">{item.projectName}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.pages.map((page) => (
                      <Pill key={page} tone={page === item.primaryPage ? "success" : "neutral"}>
                        {page}
                      </Pill>
                    ))}
                  </div>
                </div>
                <Pill
                  tone={
                    item.severity === "High"
                      ? "danger"
                      : item.severity === "Medium"
                        ? "warning"
                        : "success"
                  }
                >
                  {item.severity}
                </Pill>
              </div>
              <div className="mt-5 text-sm text-[var(--muted)]">
                Primary page recommendation: <span className="text-[var(--text)]">{item.primaryPage}</span>
              </div>
              {project ? (
                <form action={markCannibalizationAction} className="mt-4 flex gap-3">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="keyword" value={item.query} />
                  <input type="hidden" name="mode" value={item.severity === "Resolved" ? "unresolve" : "resolve"} />
                  <input type="hidden" name="return_to" value={`/cannibalization?project=${project.id}`} />
                  <button className="text-sm text-[var(--muted)]">
                    {item.severity === "Resolved" ? "Mark active again" : "Mark resolved"}
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
