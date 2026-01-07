"""Database setup and table creation for SEO Rank Tracker"""
import sqlite3
from pathlib import Path
from typing import Optional
import config
from utils.security import hash_password


def get_connection() -> sqlite3.Connection:
    """Get database connection with foreign keys enabled"""
    # Ensure data directory exists
    config.DATABASE_PATH.parent.mkdir(exist_ok=True)

    conn = sqlite3.connect(str(config.DATABASE_PATH))
    conn.row_factory = sqlite3.Row  # Enable column access by name
    conn.execute("PRAGMA foreign_keys = ON")  # Enable foreign key constraints
    return conn


def init_database():
    """Initialize database and create all tables"""
    conn = get_connection()
    cursor = conn.cursor()

    # Projects table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            target_location TEXT NOT NULL,
            google_sheet_id TEXT,
            google_sheet_url TEXT,
            gsc_property TEXT,
            update_frequency TEXT DEFAULT 'monthly',
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Keywords table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS keywords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            keyword TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, keyword)
        )
    """)

    # Rankings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rankings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword_id INTEGER NOT NULL,
            position INTEGER,
            previous_position INTEGER,
            url_found TEXT,
            checked_at DATE NOT NULL,
            api_used TEXT,
            FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
        )
    """)

    # GSC Queries table
    cursor.execute("""
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
        )
    """)

    # Add page_url column if it doesn't exist (migration)
    try:
        cursor.execute("SELECT page_url FROM gsc_queries LIMIT 1")
    except:
        cursor.execute("ALTER TABLE gsc_queries ADD COLUMN page_url TEXT")

    # Settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )
    """)

    # User project access table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_project_access (
            user_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            can_edit BOOLEAN DEFAULT 0,
            PRIMARY KEY (user_id, project_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    """)

    # Sync log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            sync_type TEXT,
            status TEXT,
            message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        )
    """)

    # Cannibalization resolved tracking table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cannibalization_resolved (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            keyword TEXT NOT NULL,
            resolved_date DATE DEFAULT CURRENT_DATE,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, keyword)
        )
    """)

    # Create indexes for better query performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_keywords_project
        ON keywords(project_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_rankings_keyword
        ON rankings(keyword_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_rankings_checked_at
        ON rankings(checked_at)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_gsc_project
        ON gsc_queries(project_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sync_log_project
        ON sync_log(project_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_cannibalization_project
        ON cannibalization_resolved(project_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_project_access
        ON user_project_access(user_id, project_id)
    """)

    conn.commit()
    conn.close()

    print(f"Database initialized at {config.DATABASE_PATH}")


def seed_initial_data():
    """Seed database with initial projects if empty"""
    conn = get_connection()
    cursor = conn.cursor()

    # Check if projects already exist
    cursor.execute("SELECT COUNT(*) FROM projects")
    count = cursor.fetchone()[0]

    if count == 0:
        print("Seeding initial projects...")
        for project in config.INITIAL_PROJECTS:
            cursor.execute("""
                INSERT INTO projects (name, url, target_location, update_frequency)
                VALUES (?, ?, ?, ?)
            """, (
                project["name"],
                project["url"],
                project["location"],
                project.get("update_frequency", "monthly")
            ))

        conn.commit()
        print(f"Seeded {len(config.INITIAL_PROJECTS)} projects")

    # Set default app password if not exists
    cursor.execute("SELECT value FROM settings WHERE key = 'app_password'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            ("app_password", config.DEFAULT_APP_PASSWORD)
        )
        conn.commit()

    # Set default app username if not exists
    cursor.execute("SELECT value FROM settings WHERE key = 'app_username'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            ("app_username", config.DEFAULT_APP_USERNAME)
        )
        conn.commit()

    # Seed admin user if no users exist
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]
    if user_count == 0:
        cursor.execute("SELECT value FROM settings WHERE key = 'app_username'")
        admin_username = cursor.fetchone()[0] or config.DEFAULT_APP_USERNAME
        cursor.execute("SELECT value FROM settings WHERE key = 'app_password'")
        admin_password = cursor.fetchone()[0] or config.DEFAULT_APP_PASSWORD
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES (?, ?, 'admin', 1)
        """, (admin_username, hash_password(admin_password)))
        conn.commit()

    conn.close()


if __name__ == "__main__":
    init_database()
    seed_initial_data()
