import "server-only";

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import {
  addSyncLog,
  getProjectById,
  getSetting,
  getUserSetting,
  setProjectSheetLinks,
  setUserSetting,
  type RankingRow,
} from "@/lib/server/repo";

const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

type Provider = "sheets" | "gsc";

type OAuthClientJson = {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
};

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
  token_uri: string;
};

type StoredToken = {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string;
  expiry_date?: number | null;
};

function parseJson<T>(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getScopes(provider: Provider) {
  return provider === "sheets" ? SHEETS_SCOPES : GSC_SCOPES;
}

function getTokenSettingKey(provider: Provider) {
  return provider === "sheets" ? "google_sheets_oauth_token" : "google_gsc_oauth_token";
}

export function getStoredOauthClient(userId: number) {
  return (
    parseJson<OAuthClientJson>(getUserSetting(userId, "google_oauth_client_json", false)) ??
    parseJson<OAuthClientJson>(getSetting("google_oauth_client_json")) ??
    parseJson<OAuthClientJson>(process.env.GOOGLE_OAUTH_CLIENT_JSON)
  );
}

export function getStoredServiceAccount(userId: number) {
  return (
    parseJson<ServiceAccountJson>(getUserSetting(userId, "google_service_account_json", false)) ??
    parseJson<ServiceAccountJson>(getSetting("google_service_account_json")) ??
    parseJson<ServiceAccountJson>(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  );
}

function createOauthClient(config: OAuthClientJson, redirectUri: string) {
  const root = config.web ?? config.installed;
  if (!root) {
    throw new Error("OAuth client JSON must include a web or installed block.");
  }

  if (!config.web) {
    throw new Error("Vercel deployment requires a web OAuth client JSON with authorized redirect URIs.");
  }

  return new google.auth.OAuth2(root.client_id, root.client_secret, redirectUri);
}

function mergeTokens(current: StoredToken | null, next: StoredToken | null) {
  if (!current) return next ?? {};
  if (!next) return current;
  return {
    ...current,
    ...next,
    refresh_token: next.refresh_token ?? current.refresh_token ?? null,
  };
}

function getStoredOauthToken(userId: number, provider: Provider) {
  return parseJson<StoredToken>(getUserSetting(userId, getTokenSettingKey(provider), false));
}

function saveOauthToken(userId: number, provider: Provider, token: StoredToken) {
  setUserSetting(userId, getTokenSettingKey(provider), JSON.stringify(token));
}

export function getGoogleConnectionState(userId: number) {
  const oauthClient = getStoredOauthClient(userId);
  const serviceAccount = getStoredServiceAccount(userId);
  return {
    oauthClientConfigured: Boolean(oauthClient),
    sheetsOauthConnected: Boolean(getStoredOauthToken(userId, "sheets")),
    gscOauthConnected: Boolean(getStoredOauthToken(userId, "gsc")),
    serviceAccountConfigured: Boolean(serviceAccount),
  };
}

export function buildGoogleAuthUrl(userId: number, provider: Provider, baseUrl: string, state: string) {
  const oauthClientConfig = getStoredOauthClient(userId);
  if (!oauthClientConfig) {
    throw new Error("Upload a Google OAuth client JSON in Settings before connecting.");
  }

  const redirectUri = `${baseUrl}/api/google/${provider}/callback`;
  const client = createOauthClient(oauthClientConfig, redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: getScopes(provider),
    state,
  });
}

export async function exchangeGoogleCode(userId: number, provider: Provider, baseUrl: string, code: string) {
  const oauthClientConfig = getStoredOauthClient(userId);
  if (!oauthClientConfig) {
    throw new Error("Google OAuth client JSON is missing.");
  }

  const redirectUri = `${baseUrl}/api/google/${provider}/callback`;
  const client = createOauthClient(oauthClientConfig, redirectUri);
  const response = await client.getToken(code);
  const merged = mergeTokens(getStoredOauthToken(userId, provider), response.tokens as StoredToken);
  saveOauthToken(userId, provider, merged);
}

async function getAuthorizedOauthClient(userId: number, provider: Provider, baseUrl: string) {
  const oauthClientConfig = getStoredOauthClient(userId);
  if (!oauthClientConfig) {
    throw new Error("Google OAuth client JSON is missing.");
  }

  const token = getStoredOauthToken(userId, provider);
  if (!token) {
    throw new Error(provider === "sheets" ? "Google Sheets is not connected." : "Google Search Console is not connected.");
  }

  const redirectUri = `${baseUrl}/api/google/${provider}/callback`;
  const client = createOauthClient(oauthClientConfig, redirectUri);
  client.setCredentials(token);
  client.on("tokens", (tokens) => {
    const merged = mergeTokens(token, tokens as StoredToken);
    saveOauthToken(userId, provider, merged);
  });
  await client.getAccessToken();
  return client;
}

async function getSheetsAuth(userId: number, baseUrl: string) {
  try {
    return await getAuthorizedOauthClient(userId, "sheets", baseUrl);
  } catch {
    const serviceAccount = getStoredServiceAccount(userId);
    if (!serviceAccount) {
      throw new Error("Connect Google Sheets OAuth or upload a service account JSON in Settings.");
    }

    return new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: SHEETS_SCOPES,
    });
  }
}

export async function testSheetsConnection(userId: number, baseUrl: string) {
  const auth = await getSheetsAuth(userId, baseUrl);
  const drive = google.drive({ version: "v3", auth });
  await drive.about.get({ fields: "user(displayName,emailAddress)" });
  return true;
}

export async function listGscProperties(userId: number, baseUrl: string) {
  const auth = await getAuthorizedOauthClient(userId, "gsc", baseUrl);
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const response = await searchconsole.sites.list();
  return (response.data.siteEntry ?? []).map((site) => site.siteUrl).filter((value): value is string => Boolean(value));
}

export async function testGscConnection(userId: number, baseUrl: string) {
  const properties = await listGscProperties(userId, baseUrl);
  return {
    count: properties.length,
    properties,
  };
}

export async function fetchGscQueries(
  userId: number,
  baseUrl: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  includePage = false,
) {
  const auth = await getAuthorizedOauthClient(userId, "gsc", baseUrl);
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: includePage ? ["query", "page"] : ["query"],
      rowLimit: 25000,
    },
  });

  return (response.data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    page_url: includePage ? (row.keys?.[1] ?? null) : null,
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
    date_range_start: startDate,
    date_range_end: endDate,
  }));
}

type SheetRowValue = string | number | null | undefined;

function toValueRows(rows: SheetRowValue[][]) {
  return rows.map((row) => row.map((value) => value ?? ""));
}

async function writeSheetBlock(spreadsheetId: string, auth: OAuth2Client | InstanceType<typeof google.auth.GoogleAuth>, range: string, values: SheetRowValue[][]) {
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: toValueRows(values),
    },
  });
}

async function batchClear(spreadsheetId: string, auth: OAuth2Client | InstanceType<typeof google.auth.GoogleAuth>, ranges: string[]) {
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges },
  });
}

export async function createProjectSheet(userId: number, baseUrl: string, projectName: string, projectId?: number) {
  const auth = await getSheetsAuth(userId, baseUrl);
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `SEO Rankings - ${projectName}` },
      sheets: [
        { properties: { title: "Keywords" } },
        { properties: { title: "Ranking History" } },
        { properties: { title: "GSC Queries" } },
        { properties: { title: "Cannibalization Summary" } },
        { properties: { title: "Cannibalization Pages" } },
        { properties: { title: "Summary" } },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId;
  const spreadsheetUrl = createResponse.data.spreadsheetUrl;
  if (!spreadsheetId || !spreadsheetUrl) {
    throw new Error("Google Sheets did not return a spreadsheet id.");
  }

  await Promise.all([
    writeSheetBlock(spreadsheetId, auth, "Keywords!A1:F1", [["Keyword", "Latest", "Change", "Best Rank", "URL Ranking", "Last Checked"]]),
    writeSheetBlock(spreadsheetId, auth, "Ranking History!A1:G1", [["Check Date", "Keyword", "Current Rank", "Previous Rank", "Change", "Best Rank", "URL Ranking"]]),
    writeSheetBlock(spreadsheetId, auth, "GSC Queries!A1:H1", [["Query", "Page", "Clicks", "Impressions", "CTR", "Position", "Start Date", "End Date"]]),
    writeSheetBlock(
      spreadsheetId,
      auth,
      "Cannibalization Summary!A1:J1",
      [["Query", "Pages", "Best Position", "Worst Position", "Total Clicks", "Total Impressions", "Primary Page", "Competing Pages", "Start Date", "End Date"]],
    ),
    writeSheetBlock(
      spreadsheetId,
      auth,
      "Cannibalization Pages!A1:H1",
      [["Query", "Page", "Position", "Clicks", "Impressions", "CTR", "Start Date", "End Date"]],
    ),
    writeSheetBlock(spreadsheetId, auth, "Summary!A1:B5", [["Metric", "Value"], ["Total Keywords", ""], ["Average Position", ""], ["Keywords in Top 10", ""], ["Last Updated", ""]]),
  ]);

  try {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch {
    // Sharing can fail on locked-down Google Workspace domains. The sheet is still valid.
  }

  if (projectId) {
    setProjectSheetLinks(projectId, spreadsheetId, spreadsheetUrl);
    addSyncLog(projectId, "rankings_export", "success", "Created project Google Sheet");
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
  };
}

export async function deleteProjectSheet(userId: number, baseUrl: string, spreadsheetId: string, projectId?: number) {
  const auth = await getSheetsAuth(userId, baseUrl);
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({ fileId: spreadsheetId });
  if (projectId) {
    setProjectSheetLinks(projectId, null, null);
    addSyncLog(projectId, "rankings_export", "success", "Deleted project Google Sheet");
  }
}

export async function syncRankingsToSheet(
  userId: number,
  baseUrl: string,
  spreadsheetId: string,
  latestRows: RankingRow[],
  historyRows: RankingRow[],
  projectId?: number,
) {
  const auth = await getSheetsAuth(userId, baseUrl);
  const rowsByKeyword = new Map<string, Record<string, number | null>>();
  const latestMeta = new Map<string, { url: string; checked: string; best: number | null }>();
  const allDates = new Set<string>();

  for (const row of historyRows) {
    if (!row.keyword || !row.checked_at) continue;
    const history = rowsByKeyword.get(row.keyword) ?? {};
    history[row.checked_at] = row.position;
    rowsByKeyword.set(row.keyword, history);
    allDates.add(row.checked_at);
  }

  for (const row of latestRows) {
    latestMeta.set(row.keyword, {
      url: row.url_found ?? "",
      checked: row.checked_at ?? "",
      best: null,
    });
  }

  const sortedDates = [...allDates].sort((a, b) => b.localeCompare(a));
  const latestDate = sortedDates[0] ?? "";
  const historicalDates = sortedDates.slice(1);
  const keywordRows = [...rowsByKeyword.keys()].sort((a, b) => a.localeCompare(b));

  const values = keywordRows.map((keyword) => {
    const history = rowsByKeyword.get(keyword) ?? {};
    const latestValue = history[latestDate] ?? "";
    const previousValue = historicalDates.length ? history[historicalDates[0]] ?? "" : "";
    const numericPositions = Object.values(history).filter((value): value is number => typeof value === "number");
    const bestRank = numericPositions.length ? Math.min(...numericPositions) : "";
    const change =
      typeof latestValue === "number" && typeof previousValue === "number"
        ? previousValue - latestValue > 0
          ? `+${previousValue - latestValue}`
          : `${previousValue - latestValue}`
        : "";
    const meta = latestMeta.get(keyword);
    return [
      keyword,
      latestValue,
      ...historicalDates.map((date) => history[date] ?? ""),
      change,
      bestRank,
      meta?.url ?? "",
      meta?.checked ?? "",
    ];
  });

  await batchClear(spreadsheetId, auth, ["Keywords!A:Z", "Ranking History!A:Z", "Summary!A:B"]);
  await writeSheetBlock(
    spreadsheetId,
    auth,
    `Keywords!A1:${String.fromCharCode(70 + historicalDates.length)}${values.length + 1}`,
    [["Keyword", "Latest", ...historicalDates, "Change", "Best Rank", "URL Ranking", "Last Checked"], ...values],
  );

  const historyValues = latestRows.map((row) => [
    row.checked_at ?? "",
    row.keyword,
    row.position ?? "",
    row.previous_position ?? "",
    typeof row.position === "number" && typeof row.previous_position === "number" ? row.previous_position - row.position : "",
    values.find((value) => value[0] === row.keyword)?.[historicalDates.length + 3] ?? "",
    row.url_found ?? "",
  ]);
  await writeSheetBlock(
    spreadsheetId,
    auth,
    `Ranking History!A1:G${historyValues.length + 1}`,
    [["Check Date", "Keyword", "Current Rank", "Previous Rank", "Change", "Best Rank", "URL Ranking"], ...historyValues],
  );

  const ranked = latestRows.filter((row) => typeof row.position === "number");
  const avgPosition = ranked.length
    ? (ranked.reduce((sum, row) => sum + Number(row.position), 0) / ranked.length).toFixed(1)
    : "N/A";
  await writeSheetBlock(spreadsheetId, auth, "Summary!A1:B5", [
    ["Metric", "Value"],
    ["Total Keywords", latestRows.length],
    ["Average Position", avgPosition],
    ["Keywords in Top 10", ranked.filter((row) => Number(row.position) <= 10).length],
    ["Last Updated", new Date().toISOString().replace("T", " ").slice(0, 16)],
  ]);

  if (projectId) {
    addSyncLog(projectId, "rankings_export", "success", `Synced ${latestRows.length} ranking rows to Google Sheets`);
  }
}

export async function syncGscToSheet(
  userId: number,
  baseUrl: string,
  spreadsheetId: string,
  rows: Array<{
    query: string;
    page_url: string | null;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    date_range_start: string | null;
    date_range_end: string | null;
  }>,
  projectId?: number,
) {
  const auth = await getSheetsAuth(userId, baseUrl);
  const values = rows.map((row) => [
    row.query,
    row.page_url ?? "",
    row.clicks,
    row.impressions,
    row.ctr,
    row.position,
    row.date_range_start ?? "",
    row.date_range_end ?? "",
  ]);

  await batchClear(spreadsheetId, auth, ["GSC Queries!A:Z"]);
  await writeSheetBlock(spreadsheetId, auth, `GSC Queries!A1:H${values.length + 1}`, [
    ["Query", "Page", "Clicks", "Impressions", "CTR", "Position", "Start Date", "End Date"],
    ...values,
  ]);

  if (projectId) {
    addSyncLog(projectId, "gsc_export", "success", `Synced ${rows.length} GSC rows to Google Sheets`);
  }
}

export async function syncCannibalizationToSheet(
  userId: number,
  baseUrl: string,
  spreadsheetId: string,
  rows: Array<{
    query: string;
    num_pages: number;
    best_position: number;
    worst_position: number;
    total_clicks: number;
    total_impressions: number;
    primary_page: string;
    pages: string[];
  }>,
  projectId?: number,
) {
  const auth = await getSheetsAuth(userId, baseUrl);
  const summaryValues = rows.map((row) => [
    row.query,
    row.num_pages,
    row.best_position,
    row.worst_position,
    row.total_clicks,
    row.total_impressions,
    row.primary_page,
    row.pages.filter((page) => page !== row.primary_page).join(", "),
    "",
    "",
  ]);
  const pageValues = rows.flatMap((row) =>
    row.pages.map((page) => [
      row.query,
      page,
      page === row.primary_page ? row.best_position : row.worst_position,
      "",
      "",
      "",
      "",
      "",
    ]),
  );

  await batchClear(spreadsheetId, auth, ["Cannibalization Summary!A:Z", "Cannibalization Pages!A:Z"]);
  await writeSheetBlock(spreadsheetId, auth, `Cannibalization Summary!A1:J${summaryValues.length + 1}`, [
    ["Query", "Pages", "Best Position", "Worst Position", "Total Clicks", "Total Impressions", "Primary Page", "Competing Pages", "Start Date", "End Date"],
    ...summaryValues,
  ]);
  await writeSheetBlock(spreadsheetId, auth, `Cannibalization Pages!A1:H${pageValues.length + 1}`, [
    ["Query", "Page", "Position", "Clicks", "Impressions", "CTR", "Start Date", "End Date"],
    ...pageValues,
  ]);

  if (projectId) {
    addSyncLog(projectId, "gsc_export", "success", `Synced ${rows.length} cannibalization cases to Google Sheets`);
  }
}

export function disconnectGoogleProvider(userId: number, provider: Provider) {
  setUserSetting(userId, getTokenSettingKey(provider), "");
}

export function storeGoogleJsonSetting(userId: number, key: "google_oauth_client_json" | "google_service_account_json", value: string) {
  setUserSetting(userId, key, value);
}

export function getProjectSheetState(projectId: number) {
  const project = getProjectById(projectId);
  return {
    sheetId: project?.google_sheet_id ?? null,
    sheetUrl: project?.google_sheet_url ?? null,
  };
}
