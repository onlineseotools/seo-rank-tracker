"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import {
  addRankCheckFailure,
  addSyncLog,
  clearRankCheckFailures,
  clearGscQueries,
  clearSyncLogs,
  createGscQuery,
  createKeywordsBulk,
  createProject,
  createRanking,
  createUser,
  deleteUserSetting,
  deleteKeywordsBulk,
  deleteProject,
  deleteUser,
  getGscQueries,
  getKeywordsByProject,
  getLatestRanking,
  getProjectById,
  getRankingsByProject,
  markCannibalizationResolved,
  setProjectSheetLinks,
  setUserProjectAccess,
  setUserSetting,
  unmarkCannibalizationResolved,
  updateProject,
  updateUser,
  updateUserLastLogin,
  updateUserPassword,
  verifyUserPassword,
  getUserByLogin,
} from "@/lib/server/repo";
import {
  buildGoogleAuthUrl,
  createProjectSheet,
  deleteProjectSheet,
  disconnectGoogleProvider,
  fetchGscQueries,
  getProjectSheetState,
  storeGoogleJsonSetting,
  syncCannibalizationToSheet,
  syncGscToSheet,
  syncRankingsToSheet,
} from "@/lib/server/google";
import { detectCannibalization } from "@/lib/server/analytics";
import { clearSession, createSession, requireSessionUser } from "@/lib/server/session";
import { getSerpSetting, SERP_SETTING_KEYS, setSerpSettingCookie } from "@/lib/server/serp-settings";
import { getBaseUrl } from "@/lib/server/url";
import { checkRankDataForSeo, checkRankScrapingRobot, checkRankSerper } from "@/lib/server/rank-checker";

function buildSafeRedirectTarget(target: string, fallback: string) {
  const trimmed = target.trim();
  if (!trimmed.startsWith("/")) return fallback;
  return trimmed;
}

function withStatusParams(target: string, params: Record<string, string>) {
  const [pathname, search = ""] = target.split("?");
  const next = new URLSearchParams(search);
  for (const [key, value] of Object.entries(params)) {
    next.set(key, value);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function redirectWithStatus(
  rawTarget: string | FormDataEntryValue | null,
  fallback: string,
  params: Record<string, string>,
): never {
  const target = buildSafeRedirectTarget(String(rawTarget ?? ""), fallback);
  redirect(withStatusParams(target, params));
}

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = getUserByLogin(login);

  if (!user || !verifyUserPassword(user, password)) {
    redirect("/login?error=1");
  }

  await createSession(user.id);
  updateUserLastLogin(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function createProjectAction(formData: FormData) {
  const user = await requireSessionUser();
  const returnTo = String(formData.get("return_to") ?? "/projects?tab=create");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const target_location = String(formData.get("target_location") ?? "").trim();
  const update_frequency = String(formData.get("update_frequency") ?? "monthly");
  const gsc_property = String(formData.get("gsc_property") ?? "").trim() || null;
  const shouldCreateSheet = formData.get("create_sheet") === "on";
  if (!name || !url || !target_location) {
    redirectWithStatus(returnTo, "/projects?tab=create", {
      status: "error",
      message: "Project name, website URL, and target location are required.",
    });
  }

  const projectId = createProject({ name, url, target_location, update_frequency, gsc_property });
  let sheetStatus = "";
  if (shouldCreateSheet) {
    try {
      const baseUrl = await getBaseUrl();
      await createProjectSheet(user.id, baseUrl, name, projectId);
      sheetStatus = " Google Sheet linked.";
    } catch {
      sheetStatus = " Project created, but Google Sheet setup could not be completed.";
    }
  }
  revalidatePath("/projects");
  revalidatePath("/project-dashboard");
  redirectWithStatus("/projects?tab=all", "/projects?tab=all", {
    status: sheetStatus.includes("could not") ? "warning" : "success",
    message: `Project created successfully.${sheetStatus}`.trim(),
  });
}

export async function updateProjectAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("id"));
  const returnTo = String(formData.get("return_to") ?? `/projects?tab=all&edit=${projectId}`);
  updateProject({
    id: projectId,
    name: String(formData.get("name") ?? ""),
    url: String(formData.get("url") ?? ""),
    target_location: String(formData.get("target_location") ?? ""),
    update_frequency: String(formData.get("update_frequency") ?? "monthly"),
    gsc_property: String(formData.get("gsc_property") ?? "") || null,
    is_active: formData.get("is_active") === "on",
  });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/project-dashboard");
  revalidatePath("/search-console");
  redirectWithStatus(returnTo, `/projects?tab=all&edit=${projectId}`, {
    status: "success",
    message: "Project details saved.",
  });
}

export async function deleteProjectAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("id"));
  const returnTo = String(formData.get("return_to") ?? "/projects?tab=all");
  deleteProject(projectId);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/projects?tab=all", {
    status: "success",
    message: "Project deleted.",
  });
}

export async function addKeywordsAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? (projectId ? `/project-dashboard?project=${projectId}&tab=keywords` : "/keywords"));
  const raw = String(formData.get("keywords") ?? "");
  const fieldKeywords = formData
    .getAll("keywords")
    .map((value) => String(value ?? ""))
    .filter(Boolean);
  const keywords = [...fieldKeywords, ...raw.split(/\r?\n|,/)]
    .map((item) => item.trim())
    .filter(Boolean);
  if (!projectId) {
    redirectWithStatus(returnTo, "/keywords", {
      status: "error",
      message: "Select a project before adding keywords.",
    });
  }
  if (keywords.length === 0) {
    redirectWithStatus(returnTo, "/keywords", {
      status: "warning",
      message: "Enter at least one keyword first.",
    });
  }
  const uniqueKeywords = [...new Set(keywords)];
  createKeywordsBulk(projectId, uniqueKeywords);
  revalidatePath("/keywords");
  revalidatePath("/dashboard");
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/keywords", {
    status: "success",
    message: `Added ${uniqueKeywords.length} keyword${uniqueKeywords.length === 1 ? "" : "s"}.`,
  });
}

export async function deleteKeywordsAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? (projectId ? `/project-dashboard?project=${projectId}&tab=keywords` : "/keywords"));
  const ids = [...formData.getAll("keyword_ids").map((value) => String(value ?? "")), String(formData.get("keyword_ids") ?? "")]
    .flatMap((value) => value.split(","))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!ids.length) {
    redirectWithStatus(returnTo, "/keywords", {
      status: "warning",
      message: "Select at least one keyword to delete.",
    });
  }
  deleteKeywordsBulk(ids);
  revalidatePath("/keywords");
  revalidatePath("/dashboard");
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/keywords", {
    status: "success",
    message: `Deleted ${ids.length} keyword${ids.length === 1 ? "" : "s"}.`,
  });
}

export async function importKeywordsCsvAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? `/project-dashboard?project=${projectId}&tab=keywords`);
  const file = formData.get("csv_file");

  if (!projectId || !(file instanceof File) || file.size === 0) {
    redirectWithStatus(returnTo, "/project-dashboard?tab=keywords", {
      status: "warning",
      message: "Choose a CSV file before importing keywords.",
    });
  }

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    redirectWithStatus(returnTo, "/project-dashboard?tab=keywords", {
      status: "warning",
      message: "CSV file is empty or missing keyword rows.",
    });
  }

  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const keywordIndex = headers.findIndex((header) => header === "keyword");
  if (keywordIndex === -1) {
    redirectWithStatus(returnTo, "/project-dashboard?tab=keywords", {
      status: "error",
      message: 'CSV must contain a "keyword" column.',
    });
  }

  const keywords = lines
    .slice(1)
    .map((line) => {
      const columns = line.split(",");
      return columns[keywordIndex]?.replace(/^\"|\"$/g, "").trim() ?? "";
    })
    .filter(Boolean);

  if (keywords.length > 0) {
    createKeywordsBulk(projectId, keywords);
  }

  revalidatePath("/keywords");
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/project-dashboard?tab=keywords", {
    status: "success",
    message: `Imported ${keywords.length} keyword${keywords.length === 1 ? "" : "s"} from CSV.`,
  });
}

export async function createUserAction(formData: FormData) {
  const currentUser = await requireSessionUser();
  if (currentUser.role !== "admin") redirect("/dashboard");
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "user") as "admin" | "user";
  if (!username || !password) {
    redirect("/users?tab=management&status=error&message=Username+and+password+are+required.");
  }
  createUser({ username, email, password, role });
  revalidatePath("/users");
  redirect(`/users?tab=management&status=success&message=${encodeURIComponent("User created successfully.")}`);
}

export async function updateUserAction(formData: FormData) {
  const currentUser = await requireSessionUser();
  if (currentUser.role !== "admin") redirect("/dashboard");
  const userId = Number(formData.get("id"));
  const isAccessUpdate = formData.has("access_update") || formData.has("project_ids") || formData.has("can_edit");
  const selectedUser = String(formData.get("selected_user") ?? "");
  const selectedAccessUser = String(formData.get("selected_access_user") ?? "");
  updateUser({
    id: userId,
    username: String(formData.get("username") ?? ""),
    email: String(formData.get("email") ?? "") || null,
    role: String(formData.get("role") ?? "user") as "admin" | "user",
    isActive: formData.get("is_active") === "on",
  });
  const password = String(formData.get("password") ?? "");
  if (password) {
    updateUserPassword(userId, password);
  }
  const assigned = formData
    .getAll("project_ids")
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (isAccessUpdate) {
    const canEdit = formData.get("can_edit") === "on";
    setUserProjectAccess(userId, assigned, canEdit);
  }
  revalidatePath("/users");
  if (isAccessUpdate) {
    redirect(
      `/users?tab=access&access_user=${encodeURIComponent(selectedAccessUser)}&status=success&message=${encodeURIComponent("Access settings saved.")}`,
    );
  }
  redirect(
    `/users?tab=management&user=${encodeURIComponent(selectedUser || String(formData.get("username") ?? ""))}&status=success&message=${encodeURIComponent("User updated successfully.")}`,
  );
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireSessionUser();
  if (currentUser.role !== "admin") redirect("/dashboard");
  const userId = Number(formData.get("id"));
  if (userId !== currentUser.id) {
    deleteUser(userId);
  }
  revalidatePath("/users");
  redirect(`/users?tab=management&status=success&message=${encodeURIComponent("User deleted.")}`);
}

export async function saveSettingsAction(formData: FormData) {
  const user = await requireSessionUser();
  const tab = String(formData.get("tab") ?? "serp-apis");
  const section = String(formData.get("section") ?? "serp");
  for (const key of SERP_SETTING_KEYS) {
    const value = String(formData.get(key) ?? "");
    if (value) {
      setUserSetting(user.id, key, value);
    } else {
      deleteUserSetting(user.id, key);
    }
    await setSerpSettingCookie(key, value);
  }
  revalidatePath("/settings");
  revalidatePath("/rank-checker");
  revalidatePath("/tool-details");
  revalidatePath("/project-dashboard");
  redirect(`/settings?tab=${encodeURIComponent(tab)}&saved=${encodeURIComponent(section)}`);
}

export async function clearSyncLogsAction() {
  const user = await requireSessionUser();
  if (user.role !== "admin") {
    redirect("/settings?tab=sync-log");
  }
  clearSyncLogs();
  revalidatePath("/settings");
  redirect("/settings?tab=sync-log&saved=sync-log-cleared");
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireSessionUser();
  const returnTo = String(formData.get("return_to") ?? "/users?tab=profile");
  updateUser({
    id: user.id,
    username: String(formData.get("username") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim() || null,
    role: user.role,
    isActive: true,
  });

  const password = String(formData.get("password") ?? "").trim();
  if (password) {
    updateUserPassword(user.id, password);
  }

  revalidatePath("/settings");
  revalidatePath("/users");
  redirectWithStatus(returnTo, "/users?tab=profile", {
    status: "success",
    message: "Profile updated successfully.",
  });
}

export async function saveGoogleFilesAction(formData: FormData) {
  const user = await requireSessionUser();
  const tab = String(formData.get("tab") ?? "google-sheets");
  const oauthFile = formData.get("google_oauth_client_json");
  const serviceAccountFile = formData.get("google_service_account_json");

  try {
    if (oauthFile instanceof File && oauthFile.size > 0) {
      const text = await oauthFile.text();
      JSON.parse(text);
      storeGoogleJsonSetting(user.id, "google_oauth_client_json", text);
    }

    if (serviceAccountFile instanceof File && serviceAccountFile.size > 0) {
      const text = await serviceAccountFile.text();
      JSON.parse(text);
      storeGoogleJsonSetting(user.id, "google_service_account_json", text);
    }
  } catch {
    redirect(`/settings?tab=${encodeURIComponent(tab)}&google_error=invalid-json-file`);
  }

  revalidatePath("/settings");
  redirect(`/settings?tab=${encodeURIComponent(tab)}&saved=google-files`);
}

export async function connectGoogleProviderAction(formData: FormData) {
  const user = await requireSessionUser();
  const provider = String(formData.get("provider") ?? "") as "sheets" | "gsc";
  if (provider !== "sheets" && provider !== "gsc") {
    redirect("/settings?google_error=invalid-provider");
  }

  const state = randomUUID();
  const store = await cookies();
  store.set(`seo_google_state_${provider}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const baseUrl = await getBaseUrl();
  const authUrl = buildGoogleAuthUrl(user.id, provider, baseUrl, state);
  redirect(authUrl);
}

export async function disconnectGoogleProviderAction(formData: FormData) {
  const user = await requireSessionUser();
  const provider = String(formData.get("provider") ?? "") as "sheets" | "gsc";
  if (provider === "sheets" || provider === "gsc") {
    disconnectGoogleProvider(user.id, provider);
  }
  revalidatePath("/settings");
  redirect(`/settings?tab=${provider === "gsc" ? "search-console" : "google-sheets"}&saved=${provider}-disconnected`);
}

export async function importGscDataAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? (projectId ? `/project-dashboard?project=${projectId}&tab=search` : "/search-console"));
  const payload = String(formData.get("payload") ?? "").trim();
  if (!projectId || !payload) {
    redirectWithStatus(returnTo, "/search-console", {
      status: "warning",
      message: "Paste a JSON payload before importing GSC data.",
    });
  }
  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = JSON.parse(payload) as Array<Record<string, unknown>>;
  } catch {
    redirectWithStatus(returnTo, "/search-console", {
      status: "error",
      message: "Invalid JSON payload. Please check the format and try again.",
    });
  }
  clearGscQueries(projectId);
  for (const row of rows) {
    createGscQuery({
      project_id: projectId,
      query: String(row.query ?? ""),
      page_url: row.page_url ? String(row.page_url) : row.page ? String(row.page) : null,
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0),
      date_range_start: row.date_range_start ? String(row.date_range_start) : null,
      date_range_end: row.date_range_end ? String(row.date_range_end) : null,
    });
  }
  addSyncLog(projectId, "gsc_import", "success", `Imported ${rows.length} GSC rows`);
  revalidatePath("/search-console");
  revalidatePath("/cannibalization");
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/search-console", {
    status: "success",
    message: `Imported ${rows.length} Search Console row${rows.length === 1 ? "" : "s"}.`,
  });
}

export async function fetchLiveGscAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? (projectId ? `/project-dashboard?project=${projectId}&tab=search` : "/search-console"));
  const property =
    String(formData.get("property_override") ?? "").trim() || String(formData.get("property") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const includePage = formData.get("include_page") === "on";
  if (!projectId || !property || !startDate || !endDate) {
    redirectWithStatus(returnTo, "/search-console", {
      status: "error",
      message: "Property, start date, and end date are required to fetch live GSC data.",
    });
  }

  const baseUrl = await getBaseUrl();
  let rows;
  try {
    rows = await fetchGscQueries(user.id, baseUrl, property, startDate, endDate, includePage);
  } catch (error) {
    redirectWithStatus(returnTo, "/search-console", {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to fetch data from Google Search Console.",
    });
  }
  clearGscQueries(projectId);
  for (const row of rows) {
    createGscQuery({
      project_id: projectId,
      query: row.query,
      page_url: row.page_url,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      date_range_start: row.date_range_start,
      date_range_end: row.date_range_end,
    });
  }
  addSyncLog(projectId, "gsc_import", "success", `Fetched ${rows.length} rows from Google Search Console`);
  revalidatePath("/search-console");
  revalidatePath("/cannibalization");
  revalidatePath("/gsc-admin");
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/search-console", {
    status: "success",
    message: `Fetched ${rows.length} Search Console row${rows.length === 1 ? "" : "s"} from Google Search Console.`,
  });
}

export async function clearProjectGscAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? (projectId ? `/project-dashboard?project=${projectId}&tab=search` : "/search-console"));
  if (projectId) {
    clearGscQueries(projectId);
    addSyncLog(projectId, "gsc_import", "success", "Cleared stored Google Search Console rows");
  }
  revalidatePath("/search-console");
  revalidatePath("/cannibalization");
  revalidatePath("/gsc-admin");
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/search-console", {
    status: "success",
    message: "Stored Search Console data cleared.",
  });
}

export async function markCannibalizationAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const keyword = String(formData.get("keyword") ?? "");
  const mode = String(formData.get("mode") ?? "resolve");
  const returnTo = String(formData.get("return_to") ?? (projectId ? `/project-dashboard?project=${projectId}&tab=cannibalization` : "/cannibalization"));
  const notes = String(formData.get("notes") ?? "").trim();
  if (mode === "resolve") {
    markCannibalizationResolved(projectId, keyword, notes || undefined);
  } else {
    unmarkCannibalizationResolved(projectId, keyword);
  }
  revalidatePath("/cannibalization");
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/cannibalization", {
    status: "success",
    message: mode === "resolve" ? "Cannibalization case marked as resolved." : "Cannibalization case restored.",
  });
}

export async function createProjectSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? `/project-dashboard?project=${projectId}&tab=settings`);
  const project = getProjectById(projectId);
  if (!project) {
    redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
      status: "error",
      message: "Project not found.",
    });
  }
  const baseUrl = await getBaseUrl();
  try {
    await createProjectSheet(user.id, baseUrl, project.name, project.id);
  } catch (error) {
    redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create Google Sheet.",
    });
  }
  revalidatePath("/project-dashboard");
  revalidatePath("/settings");
  revalidatePath("/projects");
  redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
    status: "success",
    message: "Google Sheet created and linked to the project.",
  });
}

export async function deleteProjectSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? `/project-dashboard?project=${projectId}&tab=settings`);
  if (formData.get("confirm_delete_sheet") !== "on") {
    redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
      status: "warning",
      message: "Confirm sheet deletion before removing the Google Sheet.",
    });
  }
  const { sheetId } = getProjectSheetState(projectId);
  if (!sheetId) {
    redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
      status: "warning",
      message: "No Google Sheet is linked to this project.",
    });
  }
  const baseUrl = await getBaseUrl();
  try {
    await deleteProjectSheet(user.id, baseUrl, sheetId, projectId);
  } catch (error) {
    redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to delete the linked Google Sheet.",
    });
  }
  revalidatePath("/project-dashboard");
  revalidatePath("/projects");
  redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
    status: "success",
    message: "Linked Google Sheet deleted.",
  });
}

export async function unlinkProjectSheetAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? `/project-dashboard?project=${projectId}&tab=settings`);
  if (!projectId) {
    redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
      status: "error",
      message: "Project not found.",
    });
  }
  setProjectSheetLinks(projectId, null, null);
  addSyncLog(projectId, "sheet_link", "success", "Unlinked Google Sheet from project");
  revalidatePath("/project-dashboard");
  revalidatePath("/projects");
  redirectWithStatus(returnTo, "/project-dashboard?tab=settings", {
    status: "success",
    message: "Google Sheet unlinked from this project.",
  });
}

export async function syncRankingsSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? `/project-dashboard?project=${projectId}&tab=keywords`);
  const { sheetId } = getProjectSheetState(projectId);
  if (!sheetId) {
    redirectWithStatus(returnTo, "/project-dashboard", {
      status: "warning",
      message: "Link a Google Sheet before syncing rankings.",
    });
  }
  const baseUrl = await getBaseUrl();
  const latestRows = getRankingsByProject(projectId, true);
  const historyRows = getRankingsByProject(projectId, false);
  try {
    await syncRankingsToSheet(user.id, baseUrl, sheetId, latestRows, historyRows, projectId);
  } catch (error) {
    redirectWithStatus(returnTo, "/project-dashboard", {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to sync rankings to Google Sheets.",
    });
  }
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/project-dashboard", {
    status: "success",
    message: "Rankings synced to Google Sheets.",
  });
}

export async function syncGscSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? `/project-dashboard?project=${projectId}&tab=search`);
  const { sheetId } = getProjectSheetState(projectId);
  if (!sheetId) {
    redirectWithStatus(returnTo, "/project-dashboard", {
      status: "warning",
      message: "Link a Google Sheet before syncing Search Console data.",
    });
  }
  const baseUrl = await getBaseUrl();
  try {
    await syncGscToSheet(user.id, baseUrl, sheetId, getGscQueries(projectId), projectId);
  } catch (error) {
    redirectWithStatus(returnTo, "/project-dashboard", {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to sync Search Console data to Google Sheets.",
    });
  }
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/project-dashboard", {
    status: "success",
    message: "Search Console data synced to Google Sheets.",
  });
}

export async function syncCannibalizationSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const returnTo = String(formData.get("return_to") ?? `/project-dashboard?project=${projectId}&tab=search`);
  const { sheetId } = getProjectSheetState(projectId);
  if (!sheetId) {
    redirectWithStatus(returnTo, "/project-dashboard", {
      status: "warning",
      message: "Link a Google Sheet before syncing cannibalization data.",
    });
  }
  const baseUrl = await getBaseUrl();
  const cases = detectCannibalization(getGscQueries(projectId));
  try {
    await syncCannibalizationToSheet(user.id, baseUrl, sheetId, cases, projectId);
  } catch (error) {
    redirectWithStatus(returnTo, "/project-dashboard", {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to sync cannibalization data to Google Sheets.",
    });
  }
  revalidatePath("/project-dashboard");
  redirectWithStatus(returnTo, "/project-dashboard", {
    status: "success",
    message: "Cannibalization report synced to Google Sheets.",
  });
}

export async function runRankCheckAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const apiType = String(formData.get("api_type") ?? "serper");
  const returnTo = buildSafeRedirectTarget(String(formData.get("return_to") ?? "/rank-checker"), "/rank-checker");
  const project = getProjectById(projectId);
  if (!project) {
    redirect(withStatusParams(returnTo, { rank_status: "error", rank_message: "Project not found." }));
  }

  const selectedKeywordIds = [...formData.getAll("keyword_ids").map((value) => String(value ?? "")), String(formData.get("keyword_ids") ?? "")]
    .flatMap((value) => value.split(","))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const keywords = getKeywordsByProject(projectId).filter((keyword) =>
    selectedKeywordIds.length ? selectedKeywordIds.includes(keyword.id) : true,
  );
  const runId = randomUUID();
  clearRankCheckFailures(projectId);

  const creds = {
    serper_api_key: (await getSerpSetting(user.id, "serper_api_key")) ?? "",
    dataforseo_username: (await getSerpSetting(user.id, "dataforseo_username")) ?? "",
    dataforseo_password: (await getSerpSetting(user.id, "dataforseo_password")) ?? "",
    scrapingrobot_api_key: (await getSerpSetting(user.id, "scrapingrobot_api_key")) ?? "",
  };

  const missingCredentialMessage =
    apiType === "dataforseo"
      ? !creds.dataforseo_username || !creds.dataforseo_password
        ? "Configure DataForSEO username and password in Settings before running checks."
        : ""
      : apiType === "scrapingrobot"
        ? !creds.scrapingrobot_api_key
          ? "Configure the ScrapingRobot API key in Settings before running checks."
          : ""
        : !creds.serper_api_key
          ? "Configure the Serper.dev API key in Settings before running checks."
          : "";

  if (missingCredentialMessage) {
    redirect(withStatusParams(returnTo, { rank_status: "error", rank_message: missingCredentialMessage }));
  }

  if (keywords.length === 0) {
    redirect(withStatusParams(returnTo, { rank_status: "warning", rank_message: "No keywords available for this run." }));
  }

  const checkedAt = new Date().toISOString().slice(0, 10);
  const queue = [...keywords];
  let success = 0;
  let errors = 0;

  const workerCount = Math.min(4, queue.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length) {
      const keyword = queue.shift();
      if (!keyword) return;
      try {
        const previous = getLatestRanking(keyword.id);
        let result: { position: number | null; url: string | null; error: string | null };
        if (apiType === "dataforseo") {
          result = await checkRankDataForSeo(
            keyword.keyword,
            project.target_location,
            project.url,
            creds.dataforseo_username,
            creds.dataforseo_password,
          );
        } else if (apiType === "scrapingrobot") {
          result = await checkRankScrapingRobot(
            keyword.keyword,
            project.target_location,
            project.url,
            creds.scrapingrobot_api_key,
          );
        } else {
          result = await checkRankSerper(
            keyword.keyword,
            project.target_location,
            project.url,
            creds.serper_api_key,
          );
        }

        if (result.error) {
          errors += 1;
          addRankCheckFailure({
            project_id: projectId,
            keyword_id: keyword.id,
            keyword: keyword.keyword,
            error_message: result.error,
            run_id: runId,
          });
          continue;
        }

        createRanking({
          keyword_id: keyword.id,
          position: result.position,
          previous_position: previous?.position ?? null,
          url_found: result.url,
          checked_at: checkedAt,
          api_used: apiType,
        });
        success += 1;
      } catch (error) {
        errors += 1;
        addRankCheckFailure({
          project_id: projectId,
          keyword_id: keyword.id,
          keyword: keyword.keyword,
          error_message: error instanceof Error ? error.message : "Unknown error",
          run_id: runId,
        });
      }
    }
  });

  await Promise.all(workers);

  addSyncLog(projectId, "rank_check", errors > 0 ? "warning" : "success", `Checked ${success}/${keywords.length} keywords using ${apiType}`);
  revalidatePath("/rank-checker");
  revalidatePath("/dashboard");
  revalidatePath("/keywords");
  revalidatePath("/project-dashboard");
  redirect(
    withStatusParams(returnTo, {
      rank_status: errors > 0 ? "warning" : "success",
      rank_message:
        errors > 0
          ? `Checked ${success}/${keywords.length} keywords using ${apiType}. ${errors} failed.`
          : `Checked ${success}/${keywords.length} keywords using ${apiType}.`,
    }),
  );
}
