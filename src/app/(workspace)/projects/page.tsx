import Link from "next/link";
import { Badge, InfoBox, PageIntro, Panel, StatTile, TabLink } from "@/components/ui";
import { createProjectAction, deleteProjectAction, updateProjectAction } from "@/lib/server/actions";
import { getKeywordsByProject, getProjectsForUser, getUserProjectAccess } from "@/lib/server/repo";
import { requireSessionUser } from "@/lib/server/session";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const activeTab = getSingle(params.tab) ?? "all";
  const editingProjectId = Number(getSingle(params.edit) ?? 0);
  const status = getSingle(params.status);
  const message = getSingle(params.message);
  const projects = getProjectsForUser(user.id, user.role === "admin", false);
  const accessRows = getUserProjectAccess(user.id);
  const editAccess = new Map(accessRows.map((row) => [row.project_id, Boolean(row.can_edit)]));

  const grouped = projects.reduce<Record<string, typeof projects>>((acc, project) => {
    acc[project.url] ??= [];
    acc[project.url].push(project);
    return acc;
  }, {});

  const totalKeywords = projects.reduce((sum, project) => sum + getKeywordsByProject(project.id).length, 0);
  const activeProjects = projects.filter((project) => Boolean(project.is_active)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Projects" subtitle="Manage your SEO projects and variants" />

      {message ? <InfoBox tone={status === "error" ? "error" : status === "warning" ? "warning" : "success"}>{message}</InfoBox> : null}

      <div className="tab-links">
        <TabLink href="/projects?tab=all" label="All Projects" active={activeTab === "all"} />
        <TabLink href="/projects?tab=create" label="Create New Project" active={activeTab === "create"} />
      </div>

      {activeTab === "create" ? (
        <Panel title="Create New Project" description="Add a new website and location variant to track">
          <form action={createProjectAction} className="grid gap-4">
            <input type="hidden" name="return_to" value="/projects?tab=create" />
            <div className="surface-grid-2">
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="eyebrow">Project Name*</span>
                  <input name="name" placeholder="Acme Corp - US" />
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow">Website URL*</span>
                  <input name="url" placeholder="example.com" />
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow">Target Location*</span>
                  <input name="target_location" placeholder="United States" />
                </label>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="eyebrow">Update Frequency</span>
                  <select name="update_frequency" defaultValue="monthly">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow">GSC Property (optional)</span>
                  <input name="gsc_property" placeholder="https://example.com" />
                </label>
              </div>
            </div>

            <label className="project-inline-option">
              <span className="project-inline-option__control">
                <input type="checkbox" name="create_sheet" defaultChecked />
              </span>
              <span className="project-inline-option__label">Create Google Sheet automatically</span>
            </label>

            <div className="toolbar-actions">
              <button type="submit">Create Project</button>
              <Link href="/projects?tab=create" className="button-link button-secondary">
                Clear Form
              </Link>
            </div>
          </form>
        </Panel>
      ) : (
        <Panel title="All Projects" description="Projects organized by website with location variants">
          {!projects.length ? (
            <div className="info-box info-box--info">
              <div className="info-box-content">
                No projects found. Create your first project in the &quot;Create New Project&quot; tab.
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="metric-strip">
                <StatTile label="Total Websites" value={String(Object.keys(grouped).length)} detail="Unique domains" />
                <StatTile label="Total Projects" value={String(projects.length)} detail="Including all variants" />
                <StatTile label="Total Keywords" value={String(totalKeywords)} detail="Across all projects" />
                <StatTile
                  label="Active Projects"
                  value={String(activeProjects)}
                  detail={projects.length ? `${Math.round((activeProjects / projects.length) * 100)}% active` : "0%"}
                />
              </div>

              {Object.keys(grouped)
                .sort((a, b) => a.localeCompare(b))
                .map((baseUrl) => {
                  const variants = [...grouped[baseUrl]].sort((a, b) => a.name.localeCompare(b.name));
                  const parentKeywords = variants.reduce((sum, project) => sum + getKeywordsByProject(project.id).length, 0);
                  const activeVariants = variants.filter((project) => Boolean(project.is_active)).length;
                  const editableProject = variants.find((project) => project.id === editingProjectId) ?? null;

                  return (
                    <div key={baseUrl} className="sub-panel">
                      <div className="sub-panel-title">{baseUrl}</div>
                      <div className="sub-panel-subtitle">
                        {variants.length} variants • {parentKeywords} keywords • {activeVariants} active
                      </div>

                      <div className="surface-grid-3" style={{ marginTop: "1rem" }}>
                        {variants.map((project) => {
                          const keywordCount = getKeywordsByProject(project.id).length;
                          const canEdit = user.role === "admin" || editAccess.get(project.id) === true;
                          return (
                            <div key={project.id}>
                              <div className="modern-card project-tile">
                                <div className="card-title">{project.name.slice(0, 40)}</div>
                                <div className="card-subtitle">Location: {project.target_location}</div>
                                <div className="project-meta">
                                  <Badge tone="success">{keywordCount} keywords</Badge>
                                  <Badge tone={project.google_sheet_id ? "info" : "muted"}>
                                    {project.google_sheet_id ? "Sheet linked" : "No sheet"}
                                  </Badge>
                                  <Badge tone={project.gsc_property ? "info" : "muted"}>
                                    {project.gsc_property ? "GSC linked" : "No GSC"}
                                  </Badge>
                                  <Badge tone={project.is_active ? "success" : "danger"}>
                                    {project.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </div>

                              <div className="action-row project-action-row">
                                <Link href={`/project-dashboard?project=${project.id}`} className="action-link">
                                  Dashboard
                                </Link>
                                <Link
                                  href={canEdit ? `/projects?tab=all&edit=${project.id}` : "/projects?tab=all"}
                                  className="action-link"
                                  aria-disabled={!canEdit}
                                  style={!canEdit ? { opacity: 0.5, pointerEvents: "none" } : undefined}
                                >
                                  Edit
                                </Link>
                                <form action={deleteProjectAction}>
                                  <input type="hidden" name="id" value={project.id} />
                                  <input type="hidden" name="return_to" value="/projects?tab=all" />
                                  <button type="submit" className="button-secondary" disabled={!canEdit}>
                                    Delete
                                  </button>
                                </form>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {editableProject ? (
                        <div style={{ marginTop: "1.25rem" }}>
                          <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Edit Project</h3>
                          {!(user.role === "admin" || editAccess.get(editableProject.id) === true) ? (
                            <div className="info-box info-box--warning">
                              <div className="info-box-content">You don&apos;t have edit access for this project.</div>
                            </div>
                          ) : (
                            <form action={updateProjectAction} className="grid gap-4">
                              <input type="hidden" name="id" value={editableProject.id} />
                              <input type="hidden" name="return_to" value={`/projects?tab=all&edit=${editableProject.id}`} />
                              <div className="surface-grid-3">
                                <div className="grid gap-4">
                                  <label className="grid gap-2">
                                    <span className="eyebrow">Name</span>
                                    <input name="name" defaultValue={editableProject.name} />
                                  </label>
                                  <label className="grid gap-2">
                                    <span className="eyebrow">URL</span>
                                    <input name="url" defaultValue={editableProject.url} />
                                  </label>
                                </div>

                                <div className="grid gap-4">
                                  <label className="grid gap-2">
                                    <span className="eyebrow">Location</span>
                                    <input name="target_location" defaultValue={editableProject.target_location} />
                                  </label>
                                  <label className="grid gap-2">
                                    <span className="eyebrow">Frequency</span>
                                    <select name="update_frequency" defaultValue={editableProject.update_frequency}>
                                      <option value="daily">Daily</option>
                                      <option value="weekly">Weekly</option>
                                      <option value="monthly">Monthly</option>
                                    </select>
                                  </label>
                                </div>

                                <div className="grid gap-4">
                                  <label className="grid gap-2">
                                    <span className="eyebrow">GSC Property</span>
                                    <input name="gsc_property" defaultValue={editableProject.gsc_property ?? ""} placeholder="https://example.com" />
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]" style={{ paddingTop: "2rem" }}>
                                    <input type="checkbox" name="is_active" defaultChecked={Boolean(editableProject.is_active)} />
                                    Active
                                  </label>
                                </div>
                              </div>

                              <div className="toolbar-actions">
                                <button type="submit">Save</button>
                                <Link href="/projects?tab=all" className="button-link button-secondary">
                                  Cancel
                                </Link>
                              </div>
                            </form>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
