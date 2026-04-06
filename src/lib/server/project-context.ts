import "server-only";

import { getProjectsForUser, type User } from "@/lib/server/repo";

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

function coerceProjectId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function resolveProjectContext(
  user: User,
  searchParams: SearchParamsInput,
  activeOnly = false,
) {
  const params = (await searchParams) ?? {};
  const projects = getProjectsForUser(user.id, user.role === "admin", activeOnly);
  const requestedId = coerceProjectId(params.project);
  const project = (requestedId ? projects.find((item) => item.id === requestedId) : null) ?? projects[0] ?? null;

  return {
    projects,
    project,
    selectedProjectId: project?.id ?? null,
  };
}
