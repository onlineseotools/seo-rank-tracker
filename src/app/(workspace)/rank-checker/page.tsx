import { ProjectPicker } from "@/components/project-picker";
import { InfoBox, Panel, PageIntro, Pill } from "@/components/ui";
import { runRankCheckAction } from "@/lib/server/actions";
import { resolveProjectContext } from "@/lib/server/project-context";
import { getLatestRankCheckFailures, getProjectStats, getRankingsByProject } from "@/lib/server/repo";
import { getSerpSetting } from "@/lib/server/serp-settings";
import { requireSessionUser } from "@/lib/server/session";

export default async function RankCheckerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const rankStatus = firstParam(params.rank_status);
  const rankMessage = firstParam(params.rank_message);
  const projectParam = firstParam(params.project);
  const { projects, project } = await resolveProjectContext(user, Promise.resolve(params), true);
  const stats = project ? getProjectStats(project.id) : null;
  const failures = project ? getLatestRankCheckFailures(project.id) : [];
  const latest = project ? getRankingsByProject(project.id, true) : [];
  const defaultApi = (await getSerpSetting(user.id, "default_serp_api")) ?? "serper";
  const providers = [
    { key: "serper", label: "Serper.dev", status: (await getSerpSetting(user.id, "serper_api_key")) ? "Connected" : "Missing" },
    {
      key: "dataforseo",
      label: "DataForSEO",
      status:
        (await getSerpSetting(user.id, "dataforseo_username")) && (await getSerpSetting(user.id, "dataforseo_password"))
          ? "Connected"
          : "Missing",
    },
    { key: "scrapingrobot", label: "ScrapingRobot", status: (await getSerpSetting(user.id, "scrapingrobot_api_key")) ? "Connected" : "Missing" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Rank checks designed as a run control room, not a narrow utility page."
        subtitle="This page reads the active project from the real tracker database and can execute live rank checks using the configured SERP provider credentials."
        badge="Rank checker"
      />

      {rankMessage ? (
        <InfoBox tone={rankStatus === "error" ? "error" : rankStatus === "warning" ? "warning" : "success"}>
          {rankMessage}
        </InfoBox>
      ) : null}

      <Panel kicker="Scope" title="Project selection" description="Select the variant you want to run or review before firing a new SERP check.">
        <ProjectPicker projects={projects} selectedProjectId={project?.id ?? null} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.86fr,1.14fr]">
        <Panel kicker="Providers" title="SERP lanes" description="Each provider is treated as a first-class operating mode with explicit state.">
          <div className="grid gap-4">
            {providers.map((provider) => (
              <div key={provider.key} className="panel-soft rounded-[22px] p-5">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">{provider.label}</div>
                  <Pill tone={provider.status === "Connected" ? "success" : "warning"}>{provider.status}</Pill>
                </div>
                <div className="mt-3 text-sm text-[var(--muted)]">
                  {provider.key === defaultApi ? "Selected as default provider" : "Available as alternate provider"}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel kicker="Run board" title="Failed keyword queue" description="Latest-run failures are elevated into a clear rerun surface.">
          <div className="grid gap-4">
            {project ? (
              <form action={runRankCheckAction} className="panel-soft rounded-[22px] p-5">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="return_to" value={`/rank-checker${projectParam ? `?project=${projectParam}` : project ? `?project=${project.id}` : ""}`} />
                <div className="eyebrow">Current run</div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{project.name}</div>
                <div className="mt-2 text-sm text-[var(--muted)]">
                  {stats?.total_keywords ?? 0} active keywords - latest ranked rows {latest.length}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <select name="api_type" defaultValue={defaultApi} className="rounded-[16px] border border-white/10 bg-black/10 px-4 py-3 text-sm">
                    <option value="serper">Serper.dev</option>
                    <option value="dataforseo">DataForSEO</option>
                    <option value="scrapingrobot">ScrapingRobot</option>
                  </select>
                  <button className="rounded-[18px] bg-[var(--green)] px-4 py-3 font-medium text-slate-950">Run rank check</button>
                </div>
              </form>
            ) : null}
            <div className="table-grid">
              <div className="table-row table-head">
                <div>Keyword</div>
                <div>Project</div>
                <div>Last state</div>
                <div>Previous</div>
                <div>Best</div>
                <div>Action</div>
              </div>
              {failures.map((row) => (
                <div key={row.keyword} className="table-row">
                  <div className="font-medium">{row.keyword}</div>
                  <div className="text-sm text-[var(--muted)]">{project?.name ?? "Project"}</div>
                  <div>Not ranked</div>
                  <div>-</div>
                  <div>-</div>
                  <div className="text-sm text-[var(--muted)]">{row.error_message}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
