import "server-only";

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_DIR = process.cwd();
const DATA_DIR = path.join(APP_DIR, "data");
const BUNDLED_DB_PATH = path.join(DATA_DIR, "seo_tool_new.db");
const TEMP_DB_DIR = path.join(os.tmpdir(), "seo-rank-tracker");
const TEMP_DB_PATH = path.join(TEMP_DB_DIR, "seo_tool_new.db");
const IS_VERCEL = Boolean(process.env.VERCEL);
const RAW_DB_PATH = process.env.SEO_TOOL_DB_PATH;
const RESOLVED_ENV_DB_PATH = RAW_DB_PATH
  ? path.isAbsolute(RAW_DB_PATH)
    ? RAW_DB_PATH
    : path.resolve(APP_DIR, RAW_DB_PATH)
  : null;
const ORIGINAL_RUNTIME_DB =
  process.env.NODE_ENV === "development"
    ? path.join(/* turbopackIgnore: true */ os.homedir(), ".streamlit", "seo-rank-tracker", "seo_tracker.db")
    : "";
const LEGACY_LOCAL_DB =
  process.env.NODE_ENV === "development"
    ? path.resolve(/* turbopackIgnore: true */ APP_DIR, "..", "data", "seo_tracker.db")
    : "";

function shouldUseTempRuntimeDb(candidatePath: string | null) {
  if (!IS_VERCEL || !candidatePath) return false;
  const normalizedAppDir = path.resolve(APP_DIR);
  const normalizedTempDir = path.resolve(TEMP_DB_DIR);
  const normalizedCandidate = path.resolve(candidatePath);
  return normalizedCandidate.startsWith(normalizedAppDir) && !normalizedCandidate.startsWith(normalizedTempDir);
}

const DB_PATH =
  shouldUseTempRuntimeDb(RESOLVED_ENV_DB_PATH) || (!RESOLVED_ENV_DB_PATH && IS_VERCEL)
    ? TEMP_DB_PATH
    : RESOLVED_ENV_DB_PATH ?? BUNDLED_DB_PATH;

let db: Database.Database | null = null;

const INITIAL_PROJECTS = [
  ["Hardcastle Petrofer", "hawcoindia.com", "India", "monthly"],
  ["Jekson - Argentina", "jeksonvision.com", "Argentina", "monthly"],
  ["Jekson - Brazil", "jeksonvision.com", "Brasil", "monthly"],
  ["Jekson - Canada", "jeksonvision.com", "Canada", "monthly"],
  ["Jekson - France", "jeksonvision.com", "France", "monthly"],
  ["Jekson - Germany", "jeksonvision.com", "Germany", "monthly"],
  ["Jekson - Kenya", "jeksonvision.com", "Kenya", "monthly"],
  ["Jekson - Nigeria", "jeksonvision.com", "Nigeria", "monthly"],
  ["Jekson - Switzerland", "jeksonvision.com", "Switzerland", "monthly"],
  ["Jekson Vision", "jeksonvision.com", "Global / US", "monthly"],
  ["Jekson Vision - India", "jeksonvision.com", "India", "monthly"],
  ["Jekson Vision - Italy 1", "jeksonvision.com", "Italia", "monthly"],
  ["Organica - India", "organicabiotech.com", "India", "monthly"],
  ["Organica - New Keywords", "organicabiotech.com", "India", "monthly"],
  ["Organica Biotech - Wastewater Treatment", "organicabiotech.com", "India", "monthly"],
  ["Veeda Lifesciences", "veedalifesciences.com", "India", "monthly"],
  ["Veeda Lifesciences - Bangladesh", "veedalifesciences.com", "Bangladesh", "monthly"],
  ["Veeda Lifesciences - Belgium", "veedalifesciences.com", "Belgium", "monthly"],
  ["Veeda Lifesciences - China", "veedalifesciences.com", "Global / US", "monthly"],
  ["Veeda Lifesciences - Denmark", "veedalifesciences.com", "Denmark", "monthly"],
  ["Veeda Lifesciences - France", "veedalifesciences.com", "France", "monthly"],
  ["Veeda Lifesciences - Germany", "veedalifesciences.com", "Germany", "monthly"],
  ["Veeda Lifesciences - Greece", "veedalifesciences.com", "Greece", "monthly"],
  ["Veeda Lifesciences - Italy", "veedalifesciences.com", "Italia", "monthly"],
  ["Veeda Lifesciences - Malaysia", "veedalifesciences.com", "Malaysia", "monthly"],
  ["Veeda Lifesciences - Netherland", "veedalifesciences.com", "Netherlands", "monthly"],
  ["Veeda Lifesciences - Oman", "veedalifesciences.com", "Oman", "monthly"],
  ["Veeda Lifesciences - Spain", "veedalifesciences.com", "Spain", "monthly"],
  ["Veeda Lifesciences - Switzerland", "veedalifesciences.com", "Switzerland", "monthly"],
  ["Veeda Lifesciences - Taiwan", "veedalifesciences.com", "Taiwan", "monthly"],
  ["Veeda Lifesciences - UAE", "veedalifesciences.com", "UAE", "monthly"],
  ["Veeda Lifesciences - USA", "veedalifesciences.com", "Global / US", "monthly"],
  ["Vertex", "vertexcs.com", "Global / US", "monthly"],
  ["Vertex - New Keywords - USA", "vertexcs.com", "Global / US", "monthly"],
  ["Zydus", "zyduslife.com", "India", "weekly"],
];

function ensureDataDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function bootstrapDatabaseFile() {
  ensureDataDir();

  if (fs.existsSync(DB_PATH)) {
    return;
  }

  const candidates = [BUNDLED_DB_PATH, ORIGINAL_RUNTIME_DB, LEGACY_LOCAL_DB];
  for (const candidate of candidates) {
    if (candidate !== DB_PATH && fs.existsSync(candidate)) {
      fs.copyFileSync(candidate, DB_PATH);
      return;
    }
  }
}

function createSchema(database: Database.Database) {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      target_location TEXT NOT NULL,
      google_sheet_id TEXT,
      google_sheet_url TEXT,
      gsc_property TEXT,
      update_frequency TEXT DEFAULT 'monthly',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, keyword)
    );

    CREATE TABLE IF NOT EXISTS rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword_id INTEGER NOT NULL,
      position INTEGER,
      previous_position INTEGER,
      url_found TEXT,
      checked_at DATE NOT NULL,
      api_used TEXT,
      FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gsc_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      page_url TEXT,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      ctr REAL DEFAULT 0,
      position REAL DEFAULT 0,
      date_range_start DATE,
      date_range_end DATE,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      is_active INTEGER DEFAULT 1,
      email_verified INTEGER DEFAULT 0,
      auth_provider TEXT DEFAULT 'local',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS user_project_access (
      user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      can_edit INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      sync_type TEXT,
      status TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS rank_check_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      keyword_id INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      error_message TEXT,
      run_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cannibalization_resolved (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      resolved_date DATE DEFAULT CURRENT_DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, keyword)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_keywords_project ON keywords(project_id);
    CREATE INDEX IF NOT EXISTS idx_rankings_keyword ON rankings(keyword_id);
    CREATE INDEX IF NOT EXISTS idx_rankings_checked_at ON rankings(checked_at);
    CREATE INDEX IF NOT EXISTS idx_gsc_project ON gsc_queries(project_id);
    CREATE INDEX IF NOT EXISTS idx_sync_log_project ON sync_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_rank_check_failures_project ON rank_check_failures(project_id);
    CREATE INDEX IF NOT EXISTS idx_rank_check_failures_run ON rank_check_failures(project_id, run_id);
    CREATE INDEX IF NOT EXISTS idx_cannibalization_project ON cannibalization_resolved(project_id);
    CREATE INDEX IF NOT EXISTS idx_user_project_access ON user_project_access(user_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_user_settings ON user_settings(user_id, key);
    CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}

function seedDatabase(database: Database.Database) {
  const userCount = database.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const passwordHash = bcrypt.hashSync(process.env.SEO_TOOL_DEFAULT_PASSWORD ?? "admin123", 10);
    database.prepare(`
      INSERT INTO users (username, email, password_hash, role, is_active, email_verified, auth_provider)
      VALUES (@username, @email, @password_hash, 'admin', 1, 1, 'local')
    `).run({
      username: process.env.SEO_TOOL_DEFAULT_USERNAME ?? "admin",
      email: process.env.SEO_TOOL_DEFAULT_EMAIL ?? null,
      password_hash: passwordHash,
    });
  }

  const projectCount = database.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
  if (projectCount.count === 0) {
    const insert = database.prepare(`
      INSERT INTO projects (name, url, target_location, update_frequency, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const transaction = database.transaction(() => {
      for (const project of INITIAL_PROJECTS) {
        insert.run(...project);
      }
    });
    transaction();
  }
}

export function getDb() {
  if (db) return db;
  bootstrapDatabaseFile();
  db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  createSchema(db);
  seedDatabase(db);
  return db;
}

export type DbRow = Record<string, unknown>;
