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
  getUserSetting,
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
import { getBaseUrl } from "@/lib/server/url";
import { checkRankDataForSeo, checkRankScrapingRobot, checkRankSerper } from "@/lib/server/rank-checker";

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
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const target_location = String(formData.get("target_location") ?? "").trim();
  const update_frequency = String(formData.get("update_frequency") ?? "monthly");
  const gsc_property = String(formData.get("gsc_property") ?? "").trim() || null;
  const shouldCreateSheet = formData.get("create_sheet") === "on";
  if (name && url && target_location) {
    const projectId = createProject({ name, url, target_location, update_frequency, gsc_property });
    if (shouldCreateSheet) {
      try {
        const baseUrl = await getBaseUrl();
        await createProjectSheet(user.id, baseUrl, name, projectId);
      } catch {
        // Keep project creation successful even if Google Sheets setup is unavailable.
      }
    }
  }
  revalidatePath("/projects");
  revalidatePath("/project-dashboard");
}

export async function updateProjectAction(formData: FormData) {
  await requireSessionUser();
  updateProject({
    id: Number(formData.get("id")),
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
}

export async function deleteProjectAction(formData: FormData) {
  await requireSessionUser();
  deleteProject(Number(formData.get("id")));
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/project-dashboard");
}

export async function addKeywordsAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const raw = String(formData.get("keywords") ?? "");
  const fieldKeywords = formData
    .getAll("keywords")
    .map((value) => String(value ?? ""))
    .filter(Boolean);
  const keywords = [...fieldKeywords, ...raw.split(/\r?\n|,/)]
    .map((item) => item.trim())
    .filter(Boolean);
  if (projectId && keywords.length > 0) {
    createKeywordsBulk(projectId, [...new Set(keywords)]);
  }
  revalidatePath("/keywords");
  revalidatePath("/dashboard");
  revalidatePath("/project-dashboard");
}

export async function deleteKeywordsAction(formData: FormData) {
  await requireSessionUser();
  const ids = [...formData.getAll("keyword_ids").map((value) => String(value ?? "")), String(formData.get("keyword_ids") ?? "")]
    .flatMap((value) => value.split(","))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  deleteKeywordsBulk(ids);
  revalidatePath("/keywords");
  revalidatePath("/dashboard");
  revalidatePath("/project-dashboard");
}

export async function importKeywordsCsvAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const file = formData.get("csv_file");

  if (!projectId || !(file instanceof File) || file.size === 0) {
    revalidatePath("/project-dashboard");
    return;
  }

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    revalidatePath("/project-dashboard");
    return;
  }

  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const keywordIndex = headers.findIndex((header) => header === "keyword");
  if (keywordIndex === -1) {
    redirect("/project-dashboard?tab=keywords&error=missing-keyword-column");
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
}

export async function createUserAction(formData: FormData) {
  const currentUser = await requireSessionUser();
  if (currentUser.role !== "admin") redirect("/dashboard");
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "user") as "admin" | "user";
  if (username && password) {
    createUser({ username, email, password, role });
  }
  revalidatePath("/users");
}

export async function updateUserAction(formData: FormData) {
  const currentUser = await requireSessionUser();
  if (currentUser.role !== "admin") redirect("/dashboard");
  const userId = Number(formData.get("id"));
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
  if (formData.has("access_update") || formData.has("project_ids") || formData.has("can_edit")) {
    const canEdit = formData.get("can_edit") === "on";
    setUserProjectAccess(userId, assigned, canEdit);
  }
  revalidatePath("/users");
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireSessionUser();
  if (currentUser.role !== "admin") redirect("/dashboard");
  const userId = Number(formData.get("id"));
  if (userId !== currentUser.id) {
    deleteUser(userId);
  }
  revalidatePath("/users");
}

export async function saveSettingsAction(formData: FormData) {
  const user = await requireSessionUser();
  const keys = [
    "serper_api_key",
    "dataforseo_username",
    "dataforseo_password",
    "scrapingrobot_api_key",
    "default_serp_api",
  ];
  for (const key of keys) {
    const value = String(formData.get(key) ?? "");
    if (value) {
      setUserSetting(user.id, key, value);
    } else {
      deleteUserSetting(user.id, key);
    }
  }
  revalidatePath("/settings");
  revalidatePath("/rank-checker");
}

export async function clearSyncLogsAction() {
  const user = await requireSessionUser();
  if (user.role !== "admin") {
    redirect("/settings?tab=sync-log");
  }
  clearSyncLogs();
  revalidatePath("/settings");
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireSessionUser();
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
}

export async function saveGoogleFilesAction(formData: FormData) {
  const user = await requireSessionUser();
  const oauthFile = formData.get("google_oauth_client_json");
  const serviceAccountFile = formData.get("google_service_account_json");

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

  revalidatePath("/settings");
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
}

export async function importGscDataAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const payload = String(formData.get("payload") ?? "").trim();
  if (!projectId || !payload) return;
  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = JSON.parse(payload) as Array<Record<string, unknown>>;
  } catch {
    redirect(`/search-console?error=invalid-json`);
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
}

export async function fetchLiveGscAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const property =
    String(formData.get("property_override") ?? "").trim() || String(formData.get("property") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const includePage = formData.get("include_page") === "on";
  if (!projectId || !property || !startDate || !endDate) {
    redirect("/search-console?error=missing-gsc-inputs");
  }

  const baseUrl = await getBaseUrl();
  const rows = await fetchGscQueries(user.id, baseUrl, property, startDate, endDate, includePage);
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
}

export async function clearProjectGscAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  if (projectId) {
    clearGscQueries(projectId);
    addSyncLog(projectId, "gsc_import", "success", "Cleared stored Google Search Console rows");
  }
  revalidatePath("/search-console");
  revalidatePath("/cannibalization");
  revalidatePath("/gsc-admin");
  revalidatePath("/project-dashboard");
}

export async function markCannibalizationAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const keyword = String(formData.get("keyword") ?? "");
  const mode = String(formData.get("mode") ?? "resolve");
  const notes = String(formData.get("notes") ?? "").trim();
  if (mode === "resolve") {
    markCannibalizationResolved(projectId, keyword, notes || undefined);
  } else {
    unmarkCannibalizationResolved(projectId, keyword);
  }
  revalidatePath("/cannibalization");
  revalidatePath("/project-dashboard");
}

export async function createProjectSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const project = getProjectById(projectId);
  if (!project) return;
  const baseUrl = await getBaseUrl();
  await createProjectSheet(user.id, baseUrl, project.name, project.id);
  revalidatePath("/project-dashboard");
  revalidatePath("/settings");
  revalidatePath("/projects");
}

export async function deleteProjectSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  if (formData.get("confirm_delete_sheet") !== "on") {
    revalidatePath("/project-dashboard");
    return;
  }
  const { sheetId } = getProjectSheetState(projectId);
  if (!sheetId) return;
  const baseUrl = await getBaseUrl();
  await deleteProjectSheet(user.id, baseUrl, sheetId, projectId);
  revalidatePath("/project-dashboard");
  revalidatePath("/projects");
}

export async function unlinkProjectSheetAction(formData: FormData) {
  await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  if (!projectId) return;
  setProjectSheetLinks(projectId, null, null);
  addSyncLog(projectId, "sheet_link", "success", "Unlinked Google Sheet from project");
  revalidatePath("/project-dashboard");
  revalidatePath("/projects");
}

export async function syncRankingsSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const { sheetId } = getProjectSheetState(projectId);
  if (!sheetId) return;
  const baseUrl = await getBaseUrl();
  const latestRows = getRankingsByProject(projectId, true);
  const historyRows = getRankingsByProject(projectId, false);
  await syncRankingsToSheet(user.id, baseUrl, sheetId, latestRows, historyRows, projectId);
  revalidatePath("/project-dashboard");
}

export async function syncGscSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const { sheetId } = getProjectSheetState(projectId);
  if (!sheetId) return;
  const baseUrl = await getBaseUrl();
  await syncGscToSheet(user.id, baseUrl, sheetId, getGscQueries(projectId), projectId);
  revalidatePath("/project-dashboard");
}

export async function syncCannibalizationSheetAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const { sheetId } = getProjectSheetState(projectId);
  if (!sheetId) return;
  const baseUrl = await getBaseUrl();
  const cases = detectCannibalization(getGscQueries(projectId));
  await syncCannibalizationToSheet(user.id, baseUrl, sheetId, cases, projectId);
  revalidatePath("/project-dashboard");
}

export async function runRankCheckAction(formData: FormData) {
  const user = await requireSessionUser();
  const projectId = Number(formData.get("project_id"));
  const apiType = String(formData.get("api_type") ?? "serper");
  const project = getProjectById(projectId);
  if (!project) {
    revalidatePath("/rank-checker");
    return;
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
    serper_api_key: getUserSetting(user.id, "serper_api_key", false) ?? "",
    dataforseo_username: getUserSetting(user.id, "dataforseo_username", false) ?? "",
    dataforseo_password: getUserSetting(user.id, "dataforseo_password", false) ?? "",
    scrapingrobot_api_key: getUserSetting(user.id, "scrapingrobot_api_key", false) ?? "",
  };

  let success = 0;
  let errors = 0;

  if (keywords.length === 0) {
    revalidatePath("/rank-checker");
    revalidatePath("/project-dashboard");
    return;
  }

  for (const keyword of keywords) {
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
        checked_at: new Date().toISOString().slice(0, 10),
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

  addSyncLog(projectId, "rank_check", errors > 0 ? "warning" : "success", `Checked ${success}/${keywords.length} keywords using ${apiType}`);
  revalidatePath("/rank-checker");
  revalidatePath("/dashboard");
  revalidatePath("/keywords");
  revalidatePath("/project-dashboard");
}
