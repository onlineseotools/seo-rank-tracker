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
import { getSyncLogs, getUserSetting } from "@/lib/server/repo";
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

  const serperKey = getUserSetting(user.id, "serper_api_key", false) ?? "";
  const dataForSeoUser = getUserSetting(user.id, "dataforseo_username", false) ?? "";
  const dataForSeoPass = getUserSetting(user.id, "dataforseo_password", false) ?? "";
  const scrapingRobotKey = getUserSetting(user.id, "scrapingrobot_api_key", false) ?? "";
  const defaultApi = getUserSetting(user.id, "default_serp_api", false) ?? "serper";
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

      <div className="tab-links">
        {tabs.map((tab) => (
          <TabLink key={tab.key} href={`/settings?tab=${tab.key}`} label={tab.label} active={activeTab === tab.key} />
        ))}
      </div>

      {activeTab === "serp-apis" ? (
        <Panel title="SERP API Configuration" description="Configure your rank tracking API providers">
          <form action={saveSettingsAction} className="settings-serp-grid">
            <details open className="sub-panel settings-provider settings-card">
              <summary className="card-title">Serper.dev</summary>
              <div className="settings-inline-action settings-inline-action--compact" style={{ marginTop: "1rem" }}>
                <label className="grid gap-2">
                  <span className="eyebrow">API Key</span>
                  <input name="serper_api_key" defaultValue={serperKey} type="password" />
                </label>
                <div className="settings-inline-action__button">
                  <button type="submit" className="dashboard-action settings-save-button">
                    Save
                  </button>
                </div>
              </div>
            </details>

            <details className="sub-panel settings-provider settings-card">
              <summary className="card-title">DataForSEO</summary>
              <div className="settings-provider-grid" style={{ marginTop: "1rem" }}>
                <label className="grid gap-2">
                  <span className="eyebrow">Username</span>
                  <input name="dataforseo_username" defaultValue={dataForSeoUser} />
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow">Password</span>
                  <input name="dataforseo_password" defaultValue={dataForSeoPass} type="password" />
                </label>
              </div>
              <div className="settings-provider-actions">
                <button type="submit" className="dashboard-action settings-save-button">
                  Save
                </button>
              </div>
            </details>

            <details className="sub-panel settings-provider settings-card">
              <summary className="card-title">ScrapingRobot</summary>
              <div className="settings-inline-action settings-inline-action--compact" style={{ marginTop: "1rem" }}>
                <label className="grid gap-2">
                  <span className="eyebrow">API Key</span>
                  <input name="scrapingrobot_api_key" defaultValue={scrapingRobotKey} type="password" />
                </label>
                <div className="settings-inline-action__button">
                  <button type="submit" className="dashboard-action settings-save-button">
                    Save
                  </button>
                </div>
              </div>
            </details>

            <div className="panel settings-card">
              <div className="section-header">
                <div className="section-title">Default API</div>
              </div>
              <div className="settings-inline-action">
                <label className="grid gap-2">
                  <span className="eyebrow">Select default SERP API</span>
                  <select name="default_serp_api" defaultValue={defaultApi}>
                    <option value="serper">Serper.dev</option>
                    <option value="dataforseo">DataForSEO</option>
                    <option value="scrapingrobot">ScrapingRobot</option>
                  </select>
                </label>
                <div className="settings-inline-action__button">
                  <button type="submit" className="dashboard-action settings-save-button">
                    Save
                  </button>
                </div>
              </div>
            </div>
          </form>
        </Panel>
      ) : null}

      {activeTab === "google-sheets" ? (
        <Panel title="Google Sheets Configuration" description="Set up Google Sheets integration for data export">
          <div className="info-box info-box--info" style={{ marginBottom: "1rem" }}>
            <div className="info-box-content">
              Connect with Google OAuth (recommended) to create Sheets in your Drive. Service account JSON is also supported.
            </div>
          </div>

          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            Open Google Credentials
          </a>

          <div className="grid gap-4" style={{ marginTop: "1rem" }}>
            <details open className="sub-panel">
              <summary className="card-title">OAuth (Recommended)</summary>
              <div className="settings-card-grid" style={{ marginTop: "1rem" }}>
                <form action={saveGoogleFilesAction} className="settings-upload-form settings-card">
                  <label className="grid gap-2">
                    <span className="eyebrow">Upload OAuth Client Secrets JSON</span>
                    <input type="file" name="google_oauth_client_json" accept="application/json" />
                  </label>
                  <button type="submit">Save OAuth File</button>
                </form>

                <div className="settings-card settings-card--status">
                  <div className="modern-card">
                    <div className="card-title">OAuth Client</div>
                    <div className="card-subtitle">Needed for Search Console OAuth and recommended for Google Sheets.</div>
                    <div style={{ marginTop: "0.75rem" }}>
                      <Badge tone={googleState.oauthClientConfigured ? "success" : "warning"}>
                        {googleState.oauthClientConfigured ? "Configured" : "Missing"}
                      </Badge>
                    </div>
                  </div>
                  <div className="settings-action-pair">
                    <form action={connectGoogleProviderAction}>
                      <input type="hidden" name="provider" value="sheets" />
                      <button type="submit">Connect with Google</button>
                    </form>
                    <form action={disconnectGoogleProviderAction}>
                      <input type="hidden" name="provider" value="sheets" />
                      <button type="submit" className="button-secondary">
                        Disconnect
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </details>

            <details className="sub-panel">
              <summary className="card-title">Service Account (Optional)</summary>
              <div className="settings-card-grid" style={{ marginTop: "1rem" }}>
                <form action={saveGoogleFilesAction} className="settings-upload-form settings-card">
                  <label className="grid gap-2">
                    <span className="eyebrow">Upload Service Account JSON</span>
                    <input type="file" name="google_service_account_json" accept="application/json" />
                  </label>
                  <button type="submit">Save Service Account</button>
                </form>

                <div className="modern-card settings-card">
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

          <div className="settings-card-grid">
            <div className="sub-panel settings-card settings-card--status">
              <div className="sub-panel-title">Connect to Google Search Console for organic search data</div>
              <div className="sub-panel-subtitle">Connect your Google account for Search Console access.</div>
              <div className="settings-action-pair">
                <form action={connectGoogleProviderAction}>
                  <input type="hidden" name="provider" value="gsc" />
                  <button type="submit">Connect Search Console</button>
                </form>
                <form action={disconnectGoogleProviderAction}>
                  <input type="hidden" name="provider" value="gsc" />
                  <button type="submit" className="button-secondary">
                    Disconnect
                  </button>
                </form>
              </div>
            </div>

            <div className="sub-panel settings-card settings-card--status">
              <div className="sub-panel-title">Test your GSC OAuth connection</div>
              <div className="project-meta" style={{ marginTop: "0.75rem" }}>
                <Badge tone={googleState.gscOauthConnected ? "success" : "warning"}>
                  {googleState.gscOauthConnected ? "Connected" : "Not connected"}
                </Badge>
                <Badge tone={googleState.oauthClientConfigured ? "success" : "warning"}>
                  {googleState.oauthClientConfigured ? "Client ready" : "Client missing"}
                </Badge>
              </div>
              <div style={{ marginTop: "1rem" }}>
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
          <div className="settings-profile-layout">
            <form id="account-settings-form" action={updateProfileAction} className="settings-profile-form">
              <div className="settings-provider-grid">
                <label className="grid gap-2">
                  <span className="eyebrow">Username</span>
                  <input name="username" defaultValue={user.username} />
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow">Email</span>
                  <input name="email" defaultValue={user.email ?? ""} />
                </label>
              </div>
              <div className="settings-provider-grid">
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

            <div className="settings-card settings-card--status">
              <div className="modern-card settings-current-card">
                <div className="card-title">Current account</div>
                <div className="card-subtitle">{user.username}{user.email ? ` â€¢ ${user.email}` : ""}</div>
              </div>
              <div className="settings-profile-actions">
                <button type="submit" form="account-settings-form">
                  Update Account
                </button>
                <form action={logoutAction}>
                  <button type="submit" className="button-secondary">
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
                <form method="get" className="grid gap-2">
                  <input type="hidden" name="tab" value="sync-log" />
                  <label className="grid gap-2">
                    <span className="eyebrow">Filter by type</span>
                    <select name="log_type" defaultValue={logType}>
                      <option value="All">All Types</option>
                      <option value="rank_check">Rank Checks</option>
                      <option value="rankings_export">Ranking Exports</option>
                      <option value="gsc_export">GSC Exports</option>
                      <option value="gsc_import">GSC Imports</option>
                    </select>
                  </label>
                  <button type="submit">Apply Filter</button>
                </form>
                <form action={clearSyncLogsAction} className="settings-inline-action__button">
                  <button type="submit" className="button-secondary">
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
