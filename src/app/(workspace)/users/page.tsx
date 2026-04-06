import { DataTable, InfoBox, PageIntro, Panel, TabLink } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import {
  createUserAction,
  deleteUserAction,
  updateProfileAction,
  updateUserAction,
} from "@/lib/server/actions";
import { getAllProjects, getUserProjectAccess, listUsers } from "@/lib/server/repo";
import { requireSessionUser } from "@/lib/server/session";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const currentUser = await requireSessionUser();
  const params = await searchParams;
  const activeTab = getSingle(params.tab) ?? "profile";
  const selectedUsername = getSingle(params.user) ?? "";
  const selectedAccessUser = getSingle(params.access_user) ?? "";
  const status = getSingle(params.status);
  const message = getSingle(params.message);
  const users = listUsers();
  const projects = getAllProjects(false);
  const selectedUser =
    users.find((user) => user.username === selectedUsername) ??
    users.find((user) => user.id !== currentUser.id) ??
    null;
  const accessUser =
    users.find((user) => user.username === selectedAccessUser && user.role !== "admin") ??
    users.find((user) => user.role !== "admin") ??
    null;
  const accessRows = accessUser ? getUserProjectAccess(accessUser.id) : [];
  const selectedProjectIds = new Set(accessRows.map((row) => row.project_id));

  const tabs = [{ key: "profile", label: "My Profile" }];
  if (currentUser.role === "admin") {
    tabs.push({ key: "management", label: "User Management" });
    tabs.push({ key: "access", label: "Access Control" });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Users" subtitle="Manage user accounts, access, and profile settings" />

      {message ? <InfoBox tone={status === "error" ? "error" : status === "warning" ? "warning" : "success"}>{message}</InfoBox> : null}

      <div className="tab-links">
        {tabs.map((tab) => (
          <TabLink key={tab.key} href={`/users?tab=${tab.key}`} label={tab.label} active={activeTab === tab.key} />
        ))}
      </div>

      {activeTab === "profile" ? (
        <Panel title="My Profile" description="Update your account details">
          <form action={updateProfileAction} className="grid gap-4">
            <input type="hidden" name="return_to" value="/users?tab=profile" />
            <div className="surface-grid-2">
              <label className="grid gap-2">
                <span className="eyebrow">Username</span>
                <input name="username" defaultValue={currentUser.username} />
              </label>
              <label className="grid gap-2">
                <span className="eyebrow">Email</span>
                <input name="email" defaultValue={currentUser.email ?? ""} />
              </label>
            </div>

            <div className="surface-grid-2">
              <label className="grid gap-2">
                <span className="eyebrow">Role</span>
                <input value={currentUser.role} disabled />
              </label>
              <div />
            </div>

            <div className="surface-grid-2">
              <label className="grid gap-2">
                <span className="eyebrow">New Password</span>
                <input name="password" type="password" />
              </label>
              <label className="grid gap-2">
                <span className="eyebrow">Confirm Password</span>
                <input type="password" disabled value="" placeholder="Saved on submit" />
              </label>
            </div>

            <button type="submit">Update Profile</button>
          </form>
        </Panel>
      ) : null}

      {currentUser.role === "admin" && activeTab === "management" ? (
        <div className="grid gap-6">
          <Panel title="User Management" description="Create and manage user accounts">
            {users.length ? (
              <DataTable
                headers={["Username", "Email", "Role", "Active", "Last Login"]}
                rows={users.map((user) => [
                  user.username,
                  user.email ?? "—",
                  user.role,
                  user.is_active ? "Yes" : "No",
                  user.last_login ?? "Never",
                ])}
              />
            ) : (
              <div className="info-box info-box--info">
                <div className="info-box-content">No users found.</div>
              </div>
            )}

            <div style={{ marginTop: "1.2rem" }}>
              <form action={createUserAction} className="users-create-form">
                <div className="users-create-grid">
                  <label className="grid gap-2">
                    <span className="eyebrow">Username</span>
                    <input name="username" />
                  </label>
                  <label className="grid gap-2">
                    <span className="eyebrow">Email</span>
                    <input name="email" />
                  </label>
                  <label className="grid gap-2">
                    <span className="eyebrow">Password</span>
                    <PasswordInput name="password" autoComplete="new-password" />
                  </label>
                  <label className="grid gap-2">
                    <span className="eyebrow">Role</span>
                    <select name="role" defaultValue="user">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                </div>
                <div className="users-create-action">
                  <button type="submit">Create User</button>
                </div>
              </form>
            </div>
          </Panel>

          <Panel title="Update User" description="Edit role or deactivate users">
            {!selectedUser ? (
              <div className="info-box info-box--info">
                <div className="info-box-content">No editable users found.</div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="users-edit-topbar">
                  <form method="get" className="users-edit-picker">
                    <input type="hidden" name="tab" value="management" />
                    <label className="grid gap-2 users-edit-picker__select">
                      <span className="eyebrow">Select User</span>
                      <select name="user" defaultValue={selectedUser.username}>
                        {users.map((user) => (
                          <option key={user.id} value={user.username}>
                            {user.username}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="users-edit-picker__action">
                      <button type="submit">Load User</button>
                    </div>
                  </form>

                  {selectedUser.id !== currentUser.id ? (
                    <div className="users-edit-status">
                      <span className="eyebrow">Status</span>
                      <label className="users-edit-status__toggle">
                        <input
                          type="checkbox"
                          name="is_active"
                          form={`users-edit-form-${selectedUser.id}`}
                          defaultChecked={Boolean(selectedUser.is_active)}
                        />
                        <span>Active</span>
                      </label>
                    </div>
                  ) : null}
                </div>

                {selectedUser.id === currentUser.id ? (
                  <div className="info-box info-box--info">
                    <div className="info-box-content">Use the My Profile tab to edit your own account.</div>
                  </div>
                ) : (
                  <div className="users-edit-panel">
                    <form action={updateUserAction} className="users-edit-form" id={`users-edit-form-${selectedUser.id}`}>
                      <input type="hidden" name="id" value={selectedUser.id} />
                      <input type="hidden" name="selected_user" value={selectedUser.username} />
                      <div className="users-edit-grid">
                        <label className="grid gap-2">
                          <span className="eyebrow">Username</span>
                          <input name="username" defaultValue={selectedUser.username} />
                        </label>
                        <label className="grid gap-2">
                          <span className="eyebrow">Email</span>
                          <input name="email" defaultValue={selectedUser.email ?? ""} />
                        </label>
                        <label className="grid gap-2">
                          <span className="eyebrow">Reset Password</span>
                          <PasswordInput name="password" autoComplete="new-password" />
                        </label>
                        <label className="grid gap-2">
                          <span className="eyebrow">Role</span>
                        <select name="role" defaultValue={selectedUser.role}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                    </div>
                    </form>
                    <div className="users-edit-actions">
                      <button type="submit" form={`users-edit-form-${selectedUser.id}`}>Save Changes</button>
                      <form action={deleteUserAction} className="users-edit-actions__form">
                        <input type="hidden" name="id" value={selectedUser.id} />
                        <button type="submit" className="button-secondary">
                          Delete User
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {currentUser.role === "admin" && activeTab === "access" ? (
        <Panel title="Access Control" description="Assign project access to users">
          {!accessUser ? (
            <div className="info-box info-box--info">
              <div className="info-box-content">No non-admin users available.</div>
            </div>
          ) : (
            <div className="grid gap-4">
              <form method="get" className="access-picker">
                <input type="hidden" name="tab" value="access" />
                <label className="grid gap-2 access-picker__select">
                  <span className="eyebrow">User</span>
                  <select name="access_user" defaultValue={accessUser.username}>
                    {users
                      .filter((user) => user.role !== "admin")
                      .map((user) => (
                        <option key={user.id} value={user.username}>
                          {user.username}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="access-picker__action">
                  <button type="submit">Load Access</button>
                </div>
              </form>

              <form action={updateUserAction} className="access-form">
                <input type="hidden" name="access_update" value="1" />
                <input type="hidden" name="id" value={accessUser.id} />
                <input type="hidden" name="selected_access_user" value={accessUser.username} />
                <input type="hidden" name="username" value={accessUser.username} />
                <input type="hidden" name="email" value={accessUser.email ?? ""} />
                <input type="hidden" name="role" value={accessUser.role} />
                {accessUser.is_active ? <input type="hidden" name="is_active" value="on" /> : null}

                <div className="access-project-grid">
                  {projects.map((project) => (
                    <label
                      key={`${accessUser.id}-${project.id}`}
                      className="access-project-card"
                    >
                      <input
                        type="checkbox"
                        name="project_ids"
                        value={project.id}
                        defaultChecked={selectedProjectIds.has(project.id)}
                      />
                      <div className="access-project-card__content">
                        <div className="access-project-card__title">{project.name}</div>
                        <div className="access-project-card__meta">{project.target_location}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="access-actions">
                  <label className="access-actions__toggle">
                    <input
                      type="checkbox"
                      name="can_edit"
                      defaultChecked={accessRows.some((row) => Boolean(row.can_edit))}
                    />
                    <span>Edit access</span>
                  </label>

                  <button type="submit">Save Access</button>
                </div>
              </form>
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
