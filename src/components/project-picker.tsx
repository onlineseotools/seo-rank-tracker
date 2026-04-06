import { type Project } from "@/lib/server/repo";

export function ProjectPicker({
  projects,
  selectedProjectId,
  label = "Project",
  hiddenFields,
}: {
  projects: Project[];
  selectedProjectId: number | null;
  label?: string;
  hiddenFields?: Record<string, string | undefined>;
}) {
  if (!projects.length) {
    return (
      <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-[var(--muted)]">
        No accessible projects found.
      </div>
    );
  }

  return (
    <form className="dashboard-picker-form">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null,
          )
        : null}
      <label className="dashboard-picker-form__field">
        <span className="eyebrow">{label}</span>
        <select name="project" defaultValue={selectedProjectId ? String(selectedProjectId) : ""}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} ({project.target_location})
            </option>
          ))}
        </select>
      </label>
      <div className="dashboard-picker-actions">
        <button type="submit" className="dashboard-action dashboard-action--secondary">
          Load Project
        </button>
      </div>
    </form>
  );
}
