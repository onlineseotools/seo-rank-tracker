import { Badge, DataTable, PageIntro, Panel, TabLink } from "@/components/ui";
import {
  clearSyncLogsAction,
  connectGoogleProviderAction,
  disconnectGoogleProviderAction,
  logoutAction,
  saveGoogleFilesAction,
  saveSettingsAction,
  updateProfileAction,
} from "@/lib/server/actions";
import { getGoogleConnectionState, listGscProperties } from "@/lib/server/google";
import { getSyncLogs } from "@/lib/server/repo";
import { getSerpSetting } from "@/lib/server/serp-settings";
import { requireSessionUser } from "@/lib/server/session";
import { getBaseUrl } from "@/lib/server/url";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const tabs = [
  { key: "serp-apis", label: "SERP APIs" },
  { key: "google-sheets", label: "Google Sheets" },
  { key: "search-console", label: "Search Console" },
  { key: "app-settings", label: "App Settings" },
  { key: "sync-log", label: "Sync Log" },
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const activeTab = getSingle(params.tab) ?? "serp-apis";
  const logType = getSingle(params.log_type) ?? "All";
  const savedSection = getSingle(params.saved) ?? "";

  const serperKey = (await getSerpSetting(user.id, "serper_api_key")) ?? "";
  const dataForSeoUser = (await getSerpSetting(user.id, "dataforseo_username")) ?? "";
  const dataForSeoPass = (await getSerpSetting(user.id, "dataforseo_password")) ?? "";
  const scrapingRobotKey = (await getSerpSetting(user.id, "scrapingrobot_api_key")) ?? "";
  const defaultApi = (await getSerpSetting(user.id, "default_serp_api")) ?? "serper";
  const googleState = getGoogleConnectionState(user.id);
  const googleSuccess =
    typeof params.google_sheets === "string" || typeof params.google_gsc === "string"
      ? "Google connection updated successfully."
      : null;
  const googleError = typeof params.google_error === "string" ? params.google_error : null;

  let gscProperties: string[] = [];
  try {
    if (googleState.gscOauthConnected) {
      gscProperties = await listGscProperties(user.id, await getBaseUrl());
    }
  } catch {
    gscProperties = [];
  }

  let syncLogs = getSyncLogs(undefined, 200);
  if (logType !== "All") {
    syncLogs = syncLogs.filter((log) => log.sync_type === logType);
  }

  return (
    <div className="settings-page">
      <PageIntro title="Settings" subtitle="Configure API keys, integrations, and app preferences" />

      {googleSuccess ? (
        <div className="info-box info-box--success">
          <div className="info-box-content">{googleSuccess}</div>
        </div>
      ) : null}
      {googleError ? (
        <div className="info-box info-box--error">
          <div className="info-box-content">{googleError}</div>
        </div>
      ) : null}
      {activeTab === "serp-apis" && savedSection ? (
        <div className="info-box info-box--success">
          <div className="info-box-content">
            {savedSection === "serper"
              ? "Serper settings saved."
              : savedSection === "dataforseo"
                ? "DataForSEO settings saved."
                : savedSection === "scrapingrobot"
                  ? "ScrapingRobot settings saved."
                  : savedSection === "default-api"
                    ? "Default SERP API saved."
                    : "Settings saved."}
          </div>
        </div>
      ) : null}

      <div className="tab-links">
        {tabs.map((tab) => (
          <TabLink key={tab.key} href={`/settings?tab=${tab.key}`} label={tab.label} active={activeTab === tab.key} />
        ))}
      </div>

      {activeTab === "serp-apis" ? (
        <Panel title="SERP API Configuration" description="Configure your rank tracking API providers">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="sub-panel settings-provider settings-card flex flex-col gap-4">
              <div className="card-title">Serper.dev</div>
              <form action={saveSettingsAction} className="grid gap-4 lg:grid-cols-[minmax(280px,520px)_auto] lg:items-end">
                <input type="hidden" name="tab" value="serp-apis" />
                <input type="hidden" name="section" value="serper" />
                <input type="hidden" name="dataforseo_username" value={dataForSeoUser} />
                <input type="hidden" name="dataforseo_password" value={dataForSeoPass} />
                <input type="hidden" name="scrapingrobot_api_key" value={scrapingRobotKey} />
                <input type="hidden" name="default_serp_api" value={defaultApi} />
                <label className="grid gap-2">
                  <span className="eyebrow">API Key</span>
                  <input name="serper_api_key" defaultValue={serperKey} type="password" />
                </label>
                <div className="flex items-end">
                  <button type="submit" className="dashboard-action settings-save-button">
                    Save
                  </button>
                </div>
              </form>
            </div>

            <div className="sub-panel settings-provider settings-card flex flex-col gap-4">
              <div className="card-title">DataForSEO</div>
              <form action={saveSettingsAction} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                <input type="hidden" name="tab" value="serp-apis" />
                <input type="hidden" name="section" value="dataforseo" />
                <input type="hidden" name="serper_api_key" value={serperKey} />
                <input type="hidden" name="scrapingrobot_api_key" value={scrapingRobotKey} />
                <input type="hidden" name="default_serp_api" value={defaultApi} />
                <label className="grid gap-2">
                  <span className="eyebrow">Username</span>
                  <input name="dataforseo_username" defaultValue={dataForSeoUser} />
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow">Password</span>
                  <input name="dataforseo_password" defaultValue={dataForSeoPass} type="password" />
                </label>
                <div className="flex items-end xl:justify-self-start">
                  <button type="submit" className="dashboard-action settings-save-button">
                    Save
                  </button>
                </div>
              </form>
            </div>

            <div className="sub-panel settings-provider settings-card flex flex-col gap-4">
              <div className="card-title">ScrapingRobot</div>
              <form action={saveSettingsAction} className="grid gap-4 lg:grid-cols-[minmax(280px,520px)_auto] lg:items-end">
                <input type="hidden" name="tab" value="serp-apis" />
                <input type="hidden" name="section" value="scrapingrobot" />
                <input type="hidden" name="serper_api_key" value={serperKey} />
                <input type="hidden" name="dataforseo_username" value={dataForSeoUser} />
                <input type="hidden" name="dataforseo_password" value={dataForSeoPass} />
                <input type="hidden" name="default_serp_api" value={defaultApi} />
                <label className="grid gap-2">
                  <span className="eyebrow">API Key</span>
                  <input name="scrapingrobot_api_key" defaultValue={scrapingRobotKey} type="password" />
                </label>
                <div className="flex items-end">
                  <button type="submit" className="dashboard-action settings-save-button">
                    Save
                  </button>
                </div>
              </form>
            </div>

            <div className="sub-panel settings-card flex flex-col gap-4">
              <div className="card-title">Default API</div>
              <form action={saveSettingsAction} className="grid gap-4 lg:grid-cols-[minmax(280px,420px)_auto] lg:items-end">
                <input type="hidden" name="tab" value="serp-apis" />
                <input type="hidden" name="section" value="default-api" />
                <input type="hidden" name="serper_api_key" value={serperKey} />
                <input type="hidden" name="dataforseo_username" value={dataForSeoUser} />
                <input type="hidden" name="dataforseo_password" value={dataForSeoPass} />
                <input type="hidden" name="scrapingrobot_api_key" value={scrapingRobotKey} />
                <label className="grid gap-2">
                  <span className="eyebrow">Select default SERP API</span>
                  <select name="default_serp_api" defaultValue={defaultApi}>
                    <option value="serper">Serper.dev</option>
                    <option value="dataforseo">DataForSEO</option>
                      <option value="scrapingrobot">ScrapingRobot</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button type="submit" className="dashboard-action settings-save-button">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Panel>
      ) : null}

      {activeTab === "google-sheets" ? (
        <Panel title="Google Sheets Configuration" description="Set up Google Sheets integration for data export">
          <div
            style={{
              marginBottom: "1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <div className="info-box info-box--info" style={{ marginBottom: 0, flex: "0 1 700px" }}>
              <div className="info-box-content">
                Connect with Google OAuth (recommended) to create Sheets in your Drive. Service account JSON is also supported.
              </div>
            </div>

            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="button-link"
              style={{ flex: "0 0 auto" }}
            >
              Open Google Credentials
            </a>
          </div>

          <div className="grid gap-4" style={{ marginTop: "1rem" }}>
            <details open className="sub-panel">
              <summary className="card-title">OAuth (Recommended)</summary>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]" style={{ marginTop: "1rem" }}>
                <form action={saveGoogleFilesAction} className="settings-upload-form settings-card flex h-full flex-col gap-4">
                  <label className="grid gap-2">
                    <span className="eyebrow">Upload OAuth Client Secrets JSON</span>
                    <input type="file" name="google_oauth_client_json" accept="application/json" />
                  </label>
                  <div className="mt-auto flex flex-wrap gap-3">
                    <button type="submit">Save OAuth File</button>
                  </div>
                </form>

                <div className="settings-card settings-card--status flex h-full flex-col gap-4">
                  <div className="modern-card">
                    <div className="card-title">OAuth Client</div>
                    <div className="card-subtitle">Needed for Search Console OAuth and recommended for Google Sheets.</div>
                    <div style={{ marginTop: "0.75rem" }}>
                      <Badge tone={googleState.oauthClientConfigured ? "success" : "warning"}>
                        {googleState.oauthClientConfigured ? "Configured" : "Missing"}
                      </Badge>
                    </div>
                  </div>
                  <div
                    className="mt-auto"
                    style={{ display: "flex", flexWrap: "nowrap", gap: "0.5rem", alignItems: "center", width: "fit-content" }}
                  >
                    <form action={connectGoogleProviderAction} style={{ display: "inline-flex", margin: 0 }}>
                      <input type="hidden" name="provider" value="sheets" />
                      <button type="submit" className="settings-compact-button">Connect with Google</button>
                    </form>
                    <form action={disconnectGoogleProviderAction} style={{ display: "inline-flex", margin: 0 }}>
                      <input type="hidden" name="provider" value="sheets" />
                      <button type="submit" className="button-secondary settings-compact-button">
                        Disconnect
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </details>

            <details className="sub-panel">
              <summary className="card-title">Service Account (Optional)</summary>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]" style={{ marginTop: "1rem" }}>
                <form action={saveGoogleFilesAction} className="settings-upload-form settings-card flex h-full flex-col gap-4">
                  <label className="grid gap-2">
                    <span className="eyebrow">Upload Service Account JSON</span>
                    <input type="file" name="google_service_account_json" accept="application/json" />
                  </label>
                  <div className="mt-auto flex flex-wrap gap-3">
                    <button type="submit">Save Service Account</button>
                  </div>
                </form>

                <div className="modern-card settings-card flex h-full flex-col justify-between gap-4">
                  <div className="card-title">Connection State</div>
                  <div className="project-meta" style={{ marginTop: "0.75rem" }}>
                    <Badge tone={googleState.sheetsOauthConnected ? "success" : "warning"}>
                      {googleState.sheetsOauthConnected ? "OAuth connected" : "OAuth not connected"}
                    </Badge>
                    <Badge tone={googleState.serviceAccountConfigured ? "success" : "muted"}>
                      {googleState.serviceAccountConfigured ? "Service account configured" : "No service account"}
                    </Badge>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </Panel>
      ) : null}

      {activeTab === "search-console" ? (
        <Panel title="Google Search Console Configuration" description="Connect to Google Search Console for organic search data">
          <div className="info-box info-box--info" style={{ marginBottom: "1rem" }}>
            <div className="info-box-content">
              Search Console requires OAuth authentication. Upload OAuth client secrets and connect your account.
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="sub-panel settings-card settings-card--status flex h-full flex-col gap-4">
              <div className="sub-panel-title">Connect to Google Search Console for organic search data</div>
              <div className="sub-panel-subtitle">Connect your Google account for Search Console access.</div>
              <div
                className="mt-auto"
                style={{ display: "flex", flexWrap: "nowrap", gap: "0.5rem", alignItems: "center", width: "fit-content" }}
              >
                <form action={connectGoogleProviderAction} style={{ display: "inline-flex", margin: 0 }}>
                  <input type="hidden" name="provider" value="gsc" />
                  <button type="submit" className="settings-compact-button">Connect Search Console</button>
                </form>
                <form action={disconnectGoogleProviderAction} style={{ display: "inline-flex", margin: 0 }}>
                  <input type="hidden" name="provider" value="gsc" />
                  <button type="submit" className="button-secondary settings-compact-button">
                    Disconnect
                  </button>
                </form>
              </div>
            </div>

            <div className="sub-panel settings-card settings-card--status flex h-full flex-col gap-4">
              <div className="sub-panel-title">Test your GSC OAuth connection</div>
              <div className="project-meta" style={{ marginTop: "0.75rem" }}>
                <Badge tone={googleState.gscOauthConnected ? "success" : "warning"}>
                  {googleState.gscOauthConnected ? "Connected" : "Not connected"}
                </Badge>
                <Badge tone={googleState.oauthClientConfigured ? "success" : "warning"}>
                  {googleState.oauthClientConfigured ? "Client ready" : "Client missing"}
                </Badge>
              </div>
              <div className="mt-auto" style={{ marginTop: "1rem" }}>
                {gscProperties.length ? (
                  <div className="grid gap-2">
                    {gscProperties.slice(0, 8).map((property) => (
                      <div key={property} className="section-list__item">
                        {property}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="info-box info-box--warning">
                    <div className="info-box-content">No Search Console properties available yet.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      {activeTab === "app-settings" ? (
        <Panel title="Application Settings" description="Manage admin account settings">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-start">
            <form id="account-settings-form" action={updateProfileAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="eyebrow">Username</span>
                  <input name="username" defaultValue={user.username} />
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow">Email</span>
                  <input name="email" defaultValue={user.email ?? ""} />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="eyebrow">New Password</span>
                  <input name="password" type="password" />
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow">Role</span>
                  <input value={user.role} disabled />
                </label>
              </div>
            </form>

            <div className="settings-card settings-card--status flex h-full flex-col gap-4">
              <div className="modern-card settings-current-card">
                <div className="card-title">Current account</div>
                <div className="card-subtitle">{user.username}{user.email ? ` â€¢ ${user.email}` : ""}</div>
              </div>
              <div
                className="mt-auto"
                style={{ display: "flex", flexWrap: "nowrap", gap: "0.5rem", alignItems: "center", width: "fit-content" }}
              >
                <button type="submit" form="account-settings-form">
                  Update Account
                </button>
                <form action={logoutAction} className="inline-flex" style={{ margin: 0 }}>
                  <button type="submit" className="button-secondary settings-compact-button">
                    Logout
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      {activeTab === "sync-log" ? (
        <Panel title="Sync & Activity Log" description="View system activity and sync history">
          {user.role !== "admin" ? (
            <div className="info-box info-box--info">
              <div className="info-box-content">Sync logs are visible to administrators only.</div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="settings-log-toolbar">
                <form method="get" className="settings-log-toolbar__filters">
                  <input type="hidden" name="tab" value="sync-log" />
                  <label className="grid gap-2 settings-log-toolbar__select">
                    <span className="eyebrow">Filter by type</span>
                    <select name="log_type" defaultValue={logType}>
                      <option value="All">All Types</option>
                      <option value="rank_check">Rank Checks</option>
                      <option value="rankings_export">Ranking Exports</option>
                      <option value="gsc_export">GSC Exports</option>
                      <option value="gsc_import">GSC Imports</option>
                    </select>
                  </label>
                  <button type="submit" className="settings-compact-button">Apply Filter</button>
                </form>
                <form action={clearSyncLogsAction} className="settings-log-toolbar__clear">
                  <button type="submit" className="button-secondary settings-compact-button">
                    Clear Logs
                  </button>
                </form>
              </div>

              {syncLogs.length ? (
                <DataTable
                  headers={["Created", "Type", "Status", "Message"]}
                  rows={syncLogs.map((log) => [log.created_at, log.sync_type, log.status, log.message])}
                />
              ) : (
                <div className="info-box info-box--info">
                  <div className="info-box-content">No logs found.</div>
                </div>
              )}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

