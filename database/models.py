"""CRUD operations for database models"""
from typing import List, Dict, Optional, Any
from datetime import datetime, date
import sqlite3
from database.db import get_connection
from utils.security import hash_password, verify_password


# ========== PROJECT OPERATIONS ==========

def create_project(name: str, url: str, target_location: str,
                  google_sheet_id: str = None, google_sheet_url: str = None,
                  gsc_property: str = None, update_frequency: str = "monthly") -> int:
    """Create a new project"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO projects (name, url, target_location, google_sheet_id,
                            google_sheet_url, gsc_property, update_frequency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (name, url, target_location, google_sheet_id, google_sheet_url,
          gsc_property, update_frequency))

    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return project_id


def get_all_projects(active_only: bool = True) -> List[Dict]:
    """Get all projects"""
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM projects"
    if active_only:
        query += " WHERE is_active = 1"
    query += " ORDER BY name"

    cursor.execute(query)
    projects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return projects


def get_projects_for_user(user_id: int, is_admin: bool = False, active_only: bool = True) -> List[Dict]:
    """Get projects accessible to a user."""
    if is_admin:
        return get_all_projects(active_only=active_only)

    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT p.*
        FROM projects p
        INNER JOIN user_project_access up ON p.id = up.project_id
        WHERE up.user_id = ?
    """
    params = [user_id]

    if active_only:
        query += " AND p.is_active = 1"

    query += " ORDER BY p.name"

    cursor.execute(query, params)
    projects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return projects


def get_project_by_id(project_id: int) -> Optional[Dict]:
    """Get project by ID"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def update_project(project_id: int, **kwargs) -> bool:
    """Update project fields"""
    conn = get_connection()
    cursor = conn.cursor()

    # Build dynamic UPDATE query
    fields = []
    values = []
    for key, value in kwargs.items():
        fields.append(f"{key} = ?")
        values.append(value)

    if not fields:
        conn.close()
        return False

    # Always update updated_at
    fields.append("updated_at = CURRENT_TIMESTAMP")

    query = f"UPDATE projects SET {', '.join(fields)} WHERE id = ?"
    values.append(project_id)

    cursor.execute(query, values)
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def delete_project(project_id: int) -> bool:
    """Delete project (cascades to keywords and rankings)"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


# ========== USER OPERATIONS ==========

def create_user(username: str, password: str, role: str = "user", is_active: bool = True) -> Optional[int]:
    """Create a new user."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES (?, ?, ?, ?)
        """, (username.strip(), hash_password(password), role, int(is_active)))
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None


def list_users(include_inactive: bool = True, include_password_hash: bool = False) -> List[Dict]:
    """List all users."""
    conn = get_connection()
    cursor = conn.cursor()

    if include_password_hash:
        query = "SELECT id, username, password_hash, role, is_active, created_at, last_login FROM users"
    else:
        query = "SELECT id, username, role, is_active, created_at, last_login FROM users"
    if not include_inactive:
        query += " WHERE is_active = 1"
    query += " ORDER BY username"

    cursor.execute(query)
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users


def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Get user by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_username(username: str) -> Optional[Dict]:
    """Get user by username."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username.strip(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_user(user_id: int, **kwargs) -> bool:
    """Update user fields."""
    conn = get_connection()
    cursor = conn.cursor()

    fields = []
    values = []
    for key, value in kwargs.items():
        fields.append(f"{key} = ?")
        values.append(value)

    if not fields:
        conn.close()
        return False

    fields.append("updated_at = CURRENT_TIMESTAMP")
    query = f"UPDATE users SET {', '.join(fields)} WHERE id = ?"
    values.append(user_id)

    try:
        cursor.execute(query, values)
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        return success
    except sqlite3.IntegrityError:
        conn.close()
        return False


def update_user_password(user_id: int, password: str) -> bool:
    """Update user password."""
    return update_user(user_id, password_hash=hash_password(password))


def delete_user(user_id: int) -> bool:
    """Delete a user."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def verify_user_password(user: Dict, password: str) -> bool:
    """Verify a user's password."""
    if not user:
        return False
    return verify_password(password, user.get("password_hash", ""))


def set_user_project_access(user_id: int, project_ids: List[int], can_edit: bool = False):
    """Set project access for a user."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM user_project_access WHERE user_id = ?", (user_id,))
    for project_id in project_ids:
        cursor.execute("""
            INSERT INTO user_project_access (user_id, project_id, can_edit)
            VALUES (?, ?, ?)
        """, (user_id, project_id, int(can_edit)))

    conn.commit()
    conn.close()


def get_user_project_access(user_id: int) -> List[Dict]:
    """Get project access list for a user."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT project_id, can_edit
        FROM user_project_access
        WHERE user_id = ?
    """, (user_id,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def user_can_access_project(user_id: int, project_id: int) -> bool:
    """Check if user has access to a project."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 1 FROM user_project_access
        WHERE user_id = ? AND project_id = ?
    """, (user_id, project_id))
    allowed = cursor.fetchone() is not None
    conn.close()
    return allowed


def user_can_edit_project(user_id: int, project_id: int) -> bool:
    """Check if user has edit access to a project."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT can_edit FROM user_project_access
        WHERE user_id = ? AND project_id = ?
    """, (user_id, project_id))
    row = cursor.fetchone()
    conn.close()
    return bool(row["can_edit"]) if row else False


# ========== KEYWORD OPERATIONS ==========

def create_keyword(project_id: int, keyword: str) -> Optional[int]:
    """Create a new keyword"""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO keywords (project_id, keyword)
            VALUES (?, ?)
        """, (project_id, keyword))

        keyword_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return keyword_id
    except sqlite3.IntegrityError:
        conn.close()
        return None  # Duplicate keyword


def create_keywords_bulk(project_id: int, keywords: List[str]) -> int:
    """Create multiple keywords, return count of successful inserts"""
    conn = get_connection()
    cursor = conn.cursor()

    count = 0
    for keyword in keywords:
        try:
            cursor.execute("""
                INSERT INTO keywords (project_id, keyword)
                VALUES (?, ?)
            """, (project_id, keyword.strip()))
            count += 1
        except:
            continue  # Skip duplicates

    conn.commit()
    conn.close()
    return count


def get_keywords_by_project(project_id: int, active_only: bool = True) -> List[Dict]:
    """Get all keywords for a project"""
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM keywords WHERE project_id = ?"
    params = [project_id]

    if active_only:
        query += " AND is_active = 1"

    query += " ORDER BY keyword"

    cursor.execute(query, params)
    keywords = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return keywords


def get_keyword_by_id(keyword_id: int) -> Optional[Dict]:
    """Get keyword by ID"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM keywords WHERE id = ?", (keyword_id,))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def delete_keyword(keyword_id: int) -> bool:
    """Delete keyword (cascades to rankings)"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM keywords WHERE id = ?", (keyword_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def delete_keywords_bulk(keyword_ids: List[int]) -> int:
    """Delete multiple keywords"""
    conn = get_connection()
    cursor = conn.cursor()

    placeholders = ','.join(['?'] * len(keyword_ids))
    cursor.execute(f"DELETE FROM keywords WHERE id IN ({placeholders})", keyword_ids)

    count = cursor.rowcount
    conn.commit()
    conn.close()
    return count


# ========== RANKING OPERATIONS ==========

def create_ranking(keyword_id: int, position: Optional[int], url_found: Optional[str],
                  checked_at: date, api_used: str, previous_position: Optional[int] = None) -> int:
    """Create a new ranking record"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO rankings (keyword_id, position, previous_position, url_found, checked_at, api_used)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (keyword_id, position, previous_position, url_found, checked_at, api_used))

    ranking_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return ranking_id


def get_latest_ranking(keyword_id: int) -> Optional[Dict]:
    """Get most recent ranking for a keyword"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM rankings
        WHERE keyword_id = ?
        ORDER BY checked_at DESC
        LIMIT 1
    """, (keyword_id,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_rankings_by_keyword(keyword_id: int, limit: int = 50) -> List[Dict]:
    """Get ranking history for a keyword"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM rankings
        WHERE keyword_id = ?
        ORDER BY checked_at DESC
        LIMIT ?
    """, (keyword_id, limit))

    rankings = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rankings


def get_rankings_by_project(project_id: int, latest_only: bool = True) -> List[Dict]:
    """Get rankings for all keywords in a project"""
    conn = get_connection()
    cursor = conn.cursor()

    if latest_only:
        cursor.execute("""
            SELECT k.*, r.position, r.previous_position, r.url_found,
                   r.checked_at, r.api_used
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
        """, (project_id,))
    else:
        cursor.execute("""
            SELECT k.keyword, k.id as keyword_id, r.*
            FROM keywords k
            LEFT JOIN rankings r ON k.id = r.keyword_id
            WHERE k.project_id = ? AND k.is_active = 1
            ORDER BY k.keyword, r.checked_at DESC
        """, (project_id,))

    rankings = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rankings


def get_best_rank(keyword_id: int) -> Optional[int]:
    """Get best (lowest) position for a keyword"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT MIN(position) FROM rankings
        WHERE keyword_id = ? AND position IS NOT NULL
    """, (keyword_id,))

    result = cursor.fetchone()[0]
    conn.close()
    return result


# ========== GSC QUERY OPERATIONS ==========

def create_gsc_query(project_id: int, query: str, clicks: int, impressions: int,
                    ctr: float, position: float, date_range_start: date,
                    date_range_end: date, page_url: str = None) -> int:
    """Create a GSC query record"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO gsc_queries (project_id, query, page_url, clicks, impressions, ctr,
                                position, date_range_start, date_range_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (project_id, query, page_url, clicks, impressions, ctr, position,
          date_range_start, date_range_end))

    query_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return query_id


def clear_gsc_queries(project_id: int):
    """Clear old GSC queries for a project before importing new ones"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM gsc_queries WHERE project_id = ?", (project_id,))
    conn.commit()
    conn.close()


def get_gsc_queries(project_id: int) -> List[Dict]:
    """Get all GSC queries for a project"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM gsc_queries
        WHERE project_id = ?
        ORDER BY clicks DESC
    """, (project_id,))

    queries = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return queries


def get_new_gsc_discoveries(project_id: int) -> List[Dict]:
    """Get GSC queries that are not in the keyword list"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT gsc.*
        FROM gsc_queries gsc
        LEFT JOIN keywords k ON gsc.project_id = k.project_id
            AND LOWER(gsc.query) = LOWER(k.keyword)
        WHERE gsc.project_id = ? AND k.id IS NULL
        ORDER BY gsc.clicks DESC
    """, (project_id,))

    queries = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return queries


# ========== SETTINGS OPERATIONS ==========

def get_setting(key: str) -> Optional[str]:
    """Get a setting value"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()

    return row[0] if row else None


def set_setting(key: str, value: str):
    """Set a setting value (upsert)"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?
    """, (key, value, value))

    conn.commit()
    conn.close()


# ========== SYNC LOG OPERATIONS ==========

def add_sync_log(project_id: Optional[int], sync_type: str,
                status: str, message: str):
    """Add a sync log entry"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO sync_log (project_id, sync_type, status, message)
        VALUES (?, ?, ?, ?)
    """, (project_id, sync_type, status, message))

    conn.commit()
    conn.close()


def get_sync_logs(project_id: Optional[int] = None, limit: int = 100) -> List[Dict]:
    """Get sync log entries"""
    conn = get_connection()
    cursor = conn.cursor()

    if project_id:
        cursor.execute("""
            SELECT * FROM sync_log
            WHERE project_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (project_id, limit))
    else:
        cursor.execute("""
            SELECT * FROM sync_log
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))

    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs


# ========== ANALYTICS OPERATIONS ==========

def get_project_stats(project_id: int) -> Dict[str, Any]:
    """Get statistics for a project"""
    conn = get_connection()
    cursor = conn.cursor()

    # Total keywords
    cursor.execute("""
        SELECT COUNT(*) FROM keywords
        WHERE project_id = ? AND is_active = 1
    """, (project_id,))
    total_keywords = cursor.fetchone()[0]

    # Average position (latest rankings)
    cursor.execute("""
        SELECT AVG(r.position)
        FROM keywords k
        LEFT JOIN (
            SELECT r1.*
            FROM rankings r1
            INNER JOIN (
                SELECT keyword_id, MAX(checked_at) as max_date
                FROM rankings
                GROUP BY keyword_id
            ) r2 ON r1.keyword_id = r2.keyword_id AND r1.checked_at = r2.max_date
        ) r ON k.id = r.keyword_id
        WHERE k.project_id = ? AND k.is_active = 1 AND r.position IS NOT NULL
    """, (project_id,))
    avg_position = cursor.fetchone()[0]

    # Keywords in Top 10
    cursor.execute("""
        SELECT COUNT(DISTINCT k.id)
        FROM keywords k
        LEFT JOIN (
            SELECT r1.*
            FROM rankings r1
            INNER JOIN (
                SELECT keyword_id, MAX(checked_at) as max_date
                FROM rankings
                GROUP BY keyword_id
            ) r2 ON r1.keyword_id = r2.keyword_id AND r1.checked_at = r2.max_date
        ) r ON k.id = r.keyword_id
        WHERE k.project_id = ? AND k.is_active = 1 AND r.position <= 10
    """, (project_id,))
    top_10_count = cursor.fetchone()[0]

    # Improved/Declined counts
    cursor.execute("""
        SELECT
            SUM(CASE WHEN r.previous_position > r.position THEN 1 ELSE 0 END) as improved,
            SUM(CASE WHEN r.previous_position < r.position THEN 1 ELSE 0 END) as declined
        FROM keywords k
        LEFT JOIN (
            SELECT r1.*
            FROM rankings r1
            INNER JOIN (
                SELECT keyword_id, MAX(checked_at) as max_date
                FROM rankings
                GROUP BY keyword_id
            ) r2 ON r1.keyword_id = r2.keyword_id AND r1.checked_at = r2.max_date
        ) r ON k.id = r.keyword_id
        WHERE k.project_id = ? AND k.is_active = 1
            AND r.position IS NOT NULL AND r.previous_position IS NOT NULL
    """, (project_id,))

    row = cursor.fetchone()
    improved = row[0] or 0
    declined = row[1] or 0

    conn.close()

    return {
        "total_keywords": total_keywords,
        "average_position": round(avg_position, 1) if avg_position else None,
        "top_10_count": top_10_count,
        "improved_count": improved,
        "declined_count": declined
    }


def get_top_movers(project_id: int, limit: int = 10) -> List[Dict]:
    """Get keywords with biggest rank changes"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT k.keyword, r.position, r.previous_position,
               (r.previous_position - r.position) as change
        FROM keywords k
        LEFT JOIN (
            SELECT r1.*
            FROM rankings r1
            INNER JOIN (
                SELECT keyword_id, MAX(checked_at) as max_date
                FROM rankings
                GROUP BY keyword_id
            ) r2 ON r1.keyword_id = r2.keyword_id AND r1.checked_at = r2.max_date
        ) r ON k.id = r.keyword_id
        WHERE k.project_id = ? AND k.is_active = 1
            AND r.position IS NOT NULL AND r.previous_position IS NOT NULL
        ORDER BY ABS(r.previous_position - r.position) DESC
        LIMIT ?
    """, (project_id, limit))

    movers = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return movers


import sqlite3


# ========== CANNIBALIZATION RESOLVED OPERATIONS ==========

def mark_cannibalization_resolved(project_id: int, keyword: str, notes: str = None) -> bool:
    """Mark a keyword cannibalization as resolved"""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO cannibalization_resolved (project_id, keyword, notes)
            VALUES (?, ?, ?)
            ON CONFLICT(project_id, keyword) DO UPDATE SET
                resolved_date = CURRENT_DATE,
                notes = ?,
                created_at = CURRENT_TIMESTAMP
        """, (project_id, keyword, notes, notes))

        conn.commit()
        success = cursor.rowcount > 0
    except Exception as e:
        print(f"Error marking cannibalization as resolved: {e}")
        success = False
    finally:
        conn.close()

    return success


def unmark_cannibalization_resolved(project_id: int, keyword: str) -> bool:
    """Unmark a keyword cannibalization (remove from resolved list)"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM cannibalization_resolved
        WHERE project_id = ? AND keyword = ?
    """, (project_id, keyword))

    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


def get_resolved_cannibalization(project_id: int) -> List[Dict]:
    """Get all resolved cannibalization cases for a project"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM cannibalization_resolved
        WHERE project_id = ?
        ORDER BY resolved_date DESC
    """, (project_id,))

    resolved = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return resolved


def is_cannibalization_resolved(project_id: int, keyword: str) -> bool:
    """Check if a keyword cannibalization is marked as resolved"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(*) FROM cannibalization_resolved
        WHERE project_id = ? AND keyword = ?
    """, (project_id, keyword))

    count = cursor.fetchone()[0]
    conn.close()
    return count > 0
