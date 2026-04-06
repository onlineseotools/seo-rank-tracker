import "server-only";

import bcrypt from "bcryptjs";
import { getDb } from "@/lib/server/db";

export type User = {
  id: number;
  username: string;
  email: string | null;
  role: "admin" | "user";
  is_active: number;
  email_verified: number;
  auth_provider: string;
  password_hash?: string;
  created_at?: string;
  updated_at?: string;
  last_login?: string | null;
};

export type Project = {
  id: number;
  name: string;
  url: string;
  target_location: string;
  google_sheet_id: string | null;
  google_sheet_url: string | null;
  gsc_property: string | null;
  update_frequency: string;
  is_active: number;
  created_at?: string;
  updated_at?: string;
};

export type RankingRow = {
  id: number;
  keyword: string;
  project_id: number;
  position: number | null;
  previous_position: number | null;
  url_found: string | null;
  checked_at: string | null;
  api_used: string | null;
};

export function getUserById(id: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function getUserByLogin(login: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM users WHERE username = ? OR email = ?")
    .get(login.trim(), login.trim().toLowerCase()) as User | undefined;
}

export function verifyUserPassword(user: User | undefined, password: string) {
  if (!user?.password_hash) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

export function updateUserLastLogin(userId: number) {
  const db = getDb();
  db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
}

export function listUsers() {
  const db = getDb();
  return db
    .prepare(`
      SELECT id, username, email, role, is_active, email_verified, auth_provider, created_at, last_login
      FROM users
      ORDER BY username
    `)
    .all() as User[];
}

export function createUser(input: {
  username: string;
  email?: string | null;
  password: string;
  role?: "admin" | "user";
  isActive?: boolean;
}) {
  const db = getDb();
  const result = db
    .prepare(`
      INSERT INTO users (username, email, password_hash, role, is_active, email_verified, auth_provider)
      VALUES (@username, @email, @password_hash, @role, @is_active, 1, 'local')
    `)
    .run({
      username: input.username.trim(),
      email: input.email?.trim().toLowerCase() || null,
      password_hash: bcrypt.hashSync(input.password, 10),
      role: input.role ?? "user",
      is_active: input.isActive === false ? 0 : 1,
    });
  return Number(result.lastInsertRowid);
}

export function updateUser(input: {
  id: number;
  username: string;
  email?: string | null;
  role: "admin" | "user";
  isActive: boolean;
}) {
  const db = getDb();
  db.prepare(`
    UPDATE users
    SET username = @username,
        email = @email,
        role = @role,
        is_active = @is_active,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({
    id: input.id,
    username: input.username.trim(),
    email: input.email?.trim().toLowerCase() || null,
    role: input.role,
    is_active: input.isActive ? 1 : 0,
  });
}

export function updateUserPassword(userId: number, password: string) {
  const db = getDb();
  db.prepare(`
    UPDATE users
    SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(bcrypt.hashSync(password, 10), userId);
}

export function deleteUser(userId: number) {
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

export function getAllProjects(activeOnly = false) {
  const db = getDb();
  const query = activeOnly
    ? "SELECT * FROM projects WHERE is_active = 1 ORDER BY name"
    : "SELECT * FROM projects ORDER BY name";
  return db.prepare(query).all() as Project[];
}

export function getProjectsForUser(userId: number, isAdmin: boolean, activeOnly = false) {
  const db = getDb();
  if (isAdmin) return getAllProjects(activeOnly);
  return db
    .prepare(`
      SELECT p.*
      FROM projects p
      INNER JOIN user_project_access up ON p.id = up.project_id
      WHERE up.user_id = ?
        ${activeOnly ? "AND p.is_active = 1" : ""}
      ORDER BY p.name
    `)
    .all(userId) as Project[];
}

export function createProject(input: {
  name: string;
  url: string;
  target_location: string;
  update_frequency?: string;
  gsc_property?: string | null;
}) {
  const db = getDb();
  const result = db
    .prepare(`
      INSERT INTO projects (name, url, target_location, update_frequency, gsc_property, is_active)
      VALUES (@name, @url, @target_location, @update_frequency, @gsc_property, 1)
    `)
    .run({
      name: input.name,
      url: input.url,
      target_location: input.target_location,
      update_frequency: input.update_frequency ?? "monthly",
      gsc_property: input.gsc_property ?? null,
    });
  return Number(result.lastInsertRowid);
}

export function updateProject(input: {
  id: number;
  name: string;
  url: string;
  target_location: string;
  update_frequency: string;
  gsc_property?: string | null;
  is_active: boolean;
}) {
  const db = getDb();
  db.prepare(`
    UPDATE projects
    SET name = @name,
        url = @url,
        target_location = @target_location,
        update_frequency = @update_frequency,
        gsc_property = @gsc_property,
        is_active = @is_active,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({
    ...input,
    gsc_property: input.gsc_property ?? null,
    is_active: input.is_active ? 1 : 0,
  });
}

export function setProjectSheetLinks(projectId: number, sheetId: string | null, sheetUrl: string | null) {
  const db = getDb();
  db.prepare(`
    UPDATE projects
    SET google_sheet_id = ?,
        google_sheet_url = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sheetId, sheetUrl, projectId);
}

export function deleteProject(projectId: number) {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
}

export function setUserProjectAccess(userId: number, projectIds: number[], canEdit: boolean) {
  const db = getDb();
  const remove = db.prepare("DELETE FROM user_project_access WHERE user_id = ?");
  const insert = db.prepare(`
    INSERT INTO user_project_access (user_id, project_id, can_edit)
    VALUES (?, ?, ?)
  `);
  const tx = db.transaction(() => {
    remove.run(userId);
    for (const projectId of projectIds) {
      insert.run(userId, projectId, canEdit ? 1 : 0);
    }
  });
  tx();
}

export function getUserProjectAccess(userId: number) {
  const db = getDb();
  return db.prepare("SELECT project_id, can_edit FROM user_project_access WHERE user_id = ?").all(userId) as {
    project_id: number;
    can_edit: number;
  }[];
}

export function getProjectById(projectId: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as Project | undefined;
}

export function getKeywordsByProject(projectId: number) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM keywords WHERE project_id = ? AND is_active = 1 ORDER BY keyword")
    .all(projectId) as { id: number; project_id: number; keyword: string; is_active: number; created_at: string }[];
}

export function createKeywordsBulk(projectId: number, keywords: string[]) {
  const db = getDb();
  const insert = db.prepare("INSERT OR IGNORE INTO keywords (project_id, keyword) VALUES (?, ?)");
  const tx = db.transaction(() => {
    let count = 0;
    for (const keyword of keywords) {
      const normalized = keyword.trim();
      if (!normalized) continue;
      const result = insert.run(projectId, normalized);
      if (result.changes > 0) count += 1;
    }
    return count;
  });
  return tx();
}

export function deleteKeywordsBulk(ids: number[]) {
  if (ids.length === 0) return 0;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const result = db.prepare(`DELETE FROM keywords WHERE id IN (${placeholders})`).run(...ids);
  return result.changes;
}

export function getRankingsByProject(projectId: number, latestOnly = true) {
  const db = getDb();
  if (latestOnly) {
    return db.prepare(`
      SELECT k.id, k.project_id, k.keyword, r.position, r.previous_position, r.url_found, r.checked_at, r.api_used
      FROM keywords k
      LEFT JOIN (
        SELECT r1.*
        FROM rankings r1
        INNER JOIN (
          SELECT keyword_id, MAX(id) as max_id
          FROM rankings
          GROUP BY keyword_id
        ) r2 ON r1.id = r2.max_id
      ) r ON k.id = r.keyword_id
      WHERE k.project_id = ? AND k.is_active = 1
      ORDER BY k.keyword
    `).all(projectId) as RankingRow[];
  }
  return db.prepare(`
    SELECT k.keyword, k.id, k.project_id, r.position, r.previous_position, r.url_found, r.checked_at, r.api_used
    FROM keywords k
    LEFT JOIN rankings r ON k.id = r.keyword_id
    WHERE k.project_id = ? AND k.is_active = 1
    ORDER BY k.keyword, r.checked_at DESC
  `).all(projectId) as RankingRow[];
}

export function getBestRank(keywordId: number) {
  const db = getDb();
  const row = db.prepare("SELECT MIN(position) as best FROM rankings WHERE keyword_id = ? AND position IS NOT NULL").get(keywordId) as { best: number | null };
  return row?.best ?? null;
}

export function createRanking(input: {
  keyword_id: number;
  position: number | null;
  previous_position: number | null;
  url_found: string | null;
  checked_at: string;
  api_used: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO rankings (keyword_id, position, previous_position, url_found, checked_at, api_used)
    VALUES (@keyword_id, @position, @previous_position, @url_found, @checked_at, @api_used)
  `).run(input);
}

export function getLatestRanking(keywordId: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM rankings WHERE keyword_id = ? ORDER BY id DESC LIMIT 1").get(keywordId) as {
    id: number;
    position: number | null;
    previous_position: number | null;
    url_found: string | null;
    checked_at: string;
    api_used: string | null;
  } | undefined;
}

export function getProjectStats(projectId: number) {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) as count FROM keywords WHERE project_id = ? AND is_active = 1").get(projectId) as { count: number };
  const latest = getRankingsByProject(projectId, true);
  const ranked = latest.filter((row) => typeof row.position === "number");
  const averagePosition = ranked.length
    ? ranked.reduce((sum, row) => sum + Number(row.position), 0) / ranked.length
    : null;
  const top10 = ranked.filter((row) => Number(row.position) <= 10).length;
  const improved = ranked.filter((row) => row.previous_position && row.position && row.previous_position > row.position).length;
  const declined = ranked.filter((row) => row.previous_position && row.position && row.previous_position < row.position).length;
  return {
    total_keywords: total.count,
    average_position: averagePosition ? Number(averagePosition.toFixed(1)) : null,
    top_10_count: top10,
    improved_count: improved,
    declined_count: declined,
  };
}

export function getTopMovers(projectId: number, limit = 10) {
  const latest = getRankingsByProject(projectId, true)
    .filter((row) => row.position !== null && row.previous_position !== null)
    .map((row) => ({
      keyword: row.keyword,
      position: row.position,
      previous_position: row.previous_position,
      change: Number(row.previous_position) - Number(row.position),
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return latest.slice(0, limit);
}

export function getGscQueries(projectId: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM gsc_queries WHERE project_id = ? ORDER BY clicks DESC").all(projectId) as {
    id: number;
    query: string;
    page_url: string | null;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    date_range_start: string | null;
    date_range_end: string | null;
  }[];
}

export function createGscQuery(input: {
  project_id: number;
  query: string;
  page_url?: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date_range_start?: string | null;
  date_range_end?: string | null;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO gsc_queries (project_id, query, page_url, clicks, impressions, ctr, position, date_range_start, date_range_end)
    VALUES (@project_id, @query, @page_url, @clicks, @impressions, @ctr, @position, @date_range_start, @date_range_end)
  `).run({
    ...input,
    page_url: input.page_url ?? null,
    date_range_start: input.date_range_start ?? null,
    date_range_end: input.date_range_end ?? null,
  });
}

export function clearGscQueries(projectId: number) {
  const db = getDb();
  db.prepare("DELETE FROM gsc_queries WHERE project_id = ?").run(projectId);
}

export function getNewGscDiscoveries(projectId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT gsc.*
    FROM gsc_queries gsc
    LEFT JOIN keywords k
      ON gsc.project_id = k.project_id
     AND LOWER(gsc.query) = LOWER(k.keyword)
    WHERE gsc.project_id = ? AND k.id IS NULL
    ORDER BY gsc.clicks DESC
  `).all(projectId) as {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
}

export function markCannibalizationResolved(projectId: number, keyword: string, notes?: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO cannibalization_resolved (project_id, keyword, notes)
    VALUES (?, ?, ?)
    ON CONFLICT(project_id, keyword) DO UPDATE SET
      resolved_date = CURRENT_DATE,
      notes = excluded.notes,
      created_at = CURRENT_TIMESTAMP
  `).run(projectId, keyword, notes ?? null);
}

export function unmarkCannibalizationResolved(projectId: number, keyword: string) {
  const db = getDb();
  db.prepare("DELETE FROM cannibalization_resolved WHERE project_id = ? AND keyword = ?").run(projectId, keyword);
}

export function getResolvedCannibalization(projectId: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM cannibalization_resolved WHERE project_id = ? ORDER BY resolved_date DESC").all(projectId) as {
    keyword: string;
    notes: string | null;
    resolved_date: string;
  }[];
}

export function getSetting(key: string) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function getUserSetting(userId: number, key: string, fallbackGlobal = true) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM user_settings WHERE user_id = ? AND key = ?").get(userId, key) as { value: string } | undefined;
  if (row) return row.value;
  return fallbackGlobal ? getSetting(key) : null;
}

export function setUserSetting(userId: number, key: string, value: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO user_settings (user_id, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(userId, key, value);
}

export function deleteUserSetting(userId: number, key: string) {
  const db = getDb();
  db.prepare("DELETE FROM user_settings WHERE user_id = ? AND key = ?").run(userId, key);
}

export function addSyncLog(projectId: number | null, syncType: string, status: string, message: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO sync_log (project_id, sync_type, status, message)
    VALUES (?, ?, ?, ?)
  `).run(projectId, syncType, status, message);
}

export function getSyncLogs(projectId?: number, limit = 25) {
  const db = getDb();
  if (projectId) {
    return db.prepare("SELECT * FROM sync_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all(projectId, limit) as {
      created_at: string;
      sync_type: string;
      status: string;
      message: string;
    }[];
  }
  return db.prepare("SELECT * FROM sync_log ORDER BY created_at DESC LIMIT ?").all(limit) as {
    created_at: string;
    sync_type: string;
    status: string;
    message: string;
  }[];
}

export function clearSyncLogs() {
  const db = getDb();
  db.prepare("DELETE FROM sync_log").run();
}

export function clearRankCheckFailures(projectId: number) {
  const db = getDb();
  db.prepare("DELETE FROM rank_check_failures WHERE project_id = ?").run(projectId);
}

export function addRankCheckFailure(input: {
  project_id: number;
  keyword_id: number;
  keyword: string;
  error_message: string;
  run_id: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO rank_check_failures (project_id, keyword_id, keyword, error_message, run_id)
    VALUES (@project_id, @keyword_id, @keyword, @error_message, @run_id)
  `).run(input);
}

export function getLatestRankCheckFailures(projectId: number) {
  const db = getDb();
  const latest = db.prepare(`
    SELECT run_id FROM rank_check_failures
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(projectId) as { run_id: string } | undefined;
  if (!latest) return [];
  return db.prepare(`
    SELECT * FROM rank_check_failures
    WHERE project_id = ? AND run_id = ?
    ORDER BY created_at DESC
  `).all(projectId, latest.run_id) as {
    keyword: string;
    keyword_id: number;
    error_message: string;
    created_at: string;
  }[];
}
