"""Google Sheets integration for data sync"""
import gspread
from gspread.utils import rowcol_to_a1
from collections import defaultdict
from datetime import datetime
from google.oauth2.service_account import Credentials
from google.oauth2.credentials import Credentials as UserCredentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from typing import List, Dict, Tuple, Optional
import config
from database.models import add_sync_log
import json
from pathlib import Path
import shutil


SCOPES = config.GOOGLE_OAUTH_SCOPES

REQUIRED_SERVICE_ACCOUNT_FIELDS = {
    "type",
    "client_email",
    "token_uri",
    "private_key",
}

REQUIRED_OAUTH_ROOT_KEYS = {"installed", "web"}


def _load_service_account_info(credentials_path):
    """Load and validate service account JSON."""
    try:
        data = json.loads(credentials_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("Invalid JSON file. Please upload a service account JSON.") from exc

    if not isinstance(data, dict):
        raise ValueError("Invalid credentials format. Please upload a service account JSON.")

    if "installed" in data or "web" in data:
        raise ValueError(
            "OAuth client secrets detected. Please upload a service account JSON "
            "that includes client_email and token_uri."
        )

    missing = REQUIRED_SERVICE_ACCOUNT_FIELDS.difference(data.keys())
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise ValueError(
            f"Service account info missing required fields: {missing_list}. "
            "Please upload the correct service account JSON."
        )

    return data


def _load_oauth_client_info(credentials_path):
    """Load and validate OAuth client secrets JSON."""
    try:
        data = json.loads(credentials_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError("Invalid JSON file. Please upload an OAuth client secrets JSON.") from exc

    if not isinstance(data, dict):
        raise ValueError("Invalid OAuth client secrets format.")

    if not REQUIRED_OAUTH_ROOT_KEYS.intersection(data.keys()):
        raise ValueError(
            "OAuth client secrets JSON must include 'installed' or 'web' root key."
        )

    return data


def _save_oauth_credentials(creds, token_path):
    token_path.parent.mkdir(exist_ok=True)
    token_path.write_text(creds.to_json(), encoding="utf-8")


def _build_oauth_flow(client_secrets_path: str = None, redirect_uri: str = None):
    if client_secrets_path is None:
        client_secrets_path = str(config.GOOGLE_OAUTH_CLIENT_PATH)

    if not client_secrets_path:
        raise FileNotFoundError("OAuth client secrets file not found.")

    client_path = Path(client_secrets_path)
    if not client_path.exists() and config.LEGACY_GOOGLE_OAUTH_CLIENT_PATH.exists():
        client_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(config.LEGACY_GOOGLE_OAUTH_CLIENT_PATH, client_path)

    if not client_path.exists():
        raise FileNotFoundError("OAuth client secrets file not found.")

    _load_oauth_client_info(client_path)

    flow = InstalledAppFlow.from_client_secrets_file(
        str(client_path), SCOPES
    )
    if redirect_uri:
        flow.redirect_uri = redirect_uri
    return flow


def get_sheets_auth_url(client_secrets_path: str = None, redirect_uri: str = None, state: str = None):
    """Return OAuth consent URL and state for Google Sheets."""
    flow = _build_oauth_flow(client_secrets_path, redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return auth_url, state


def exchange_sheets_auth_code(code: str, client_secrets_path: str = None, redirect_uri: str = None):
    """Exchange OAuth code for credentials and persist the token."""
    if not code:
        raise ValueError("Authorization code is required.")

    flow = _build_oauth_flow(client_secrets_path, redirect_uri)
    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_oauth_credentials(creds, config.GOOGLE_OAUTH_TOKEN_PATH)
    return creds


def get_oauth_credentials(token_path=None):
    """Load OAuth credentials for Google Sheets."""
    if token_path is None:
        token_path = config.GOOGLE_OAUTH_TOKEN_PATH

    if not token_path.exists():
        return None

    try:
        creds = UserCredentials.from_authorized_user_file(str(token_path), SCOPES)
    except Exception:
        return None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                _save_oauth_credentials(creds, token_path)
            except Exception:
                return None
        else:
            return None

    return creds


def initiate_sheets_oauth(client_secrets_path: str = None):
    """Initiate OAuth flow and store token for Google Sheets."""
    if client_secrets_path is None:
        client_secrets_path = str(config.GOOGLE_OAUTH_CLIENT_PATH)

    if not client_secrets_path or not Path(client_secrets_path).exists():
        raise FileNotFoundError("OAuth client secrets file not found.")

    _load_oauth_client_info(Path(client_secrets_path))

    flow = InstalledAppFlow.from_client_secrets_file(
        client_secrets_path, SCOPES
    )
    creds = flow.run_local_server(port=0)
    _save_oauth_credentials(creds, config.GOOGLE_OAUTH_TOKEN_PATH)
    return creds


def get_sheets_client(credentials_path: str = None):
    """Get authenticated Google Sheets client"""
    oauth_creds = get_oauth_credentials()
    if oauth_creds:
        return gspread.authorize(oauth_creds)

    if config.GOOGLE_OAUTH_TOKEN_PATH.exists():
        raise ValueError(
            "Google Sheets OAuth credentials are invalid or expired. "
            "Reconnect in Settings."
        )

    if credentials_path is None:
        credentials_path = config.GOOGLE_CREDENTIALS_PATH

    if not credentials_path.exists() and config.LEGACY_GOOGLE_CREDENTIALS_PATH.exists():
        credentials_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(config.LEGACY_GOOGLE_CREDENTIALS_PATH, credentials_path)

    if not credentials_path.exists():
        raise FileNotFoundError(
            "Google Sheets credentials not found. "
            "Please connect with OAuth or upload a service account JSON in Settings."
        )

    service_account_info = _load_service_account_info(credentials_path)
    creds = Credentials.from_service_account_info(service_account_info, scopes=SCOPES)
    return gspread.authorize(creds)


def _get_or_create_worksheet(sheet, title: str, rows: int = 1000, cols: int = 10):
    try:
        return sheet.worksheet(title)
    except Exception:
        return sheet.add_worksheet(title, rows=rows, cols=cols)


def _apply_header_format(ws, cell_range: str):
    try:
        ws.format(cell_range, {
            "backgroundColor": {"red": 0.2, "green": 0.2, "blue": 0.8},
            "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}}
        })
        ws.freeze(rows=1)
    except Exception:
        pass


def create_project_sheet(project_name: str) -> Tuple[str, str]:
    """
    Create new Google Sheet with required tabs for a project

    Returns:
        (sheet_id, sheet_url)
    """
    try:
        client = get_sheets_client()

        # Create new spreadsheet
        sheet = client.create(f"SEO Rankings - {project_name}")

        # Add required worksheets
        sheet.add_worksheet("Keywords", rows=1000, cols=10)
        sheet.add_worksheet("Ranking History", rows=2000, cols=10)
        sheet.add_worksheet("GSC Queries", rows=2000, cols=10)
        sheet.add_worksheet("Cannibalization Summary", rows=2000, cols=12)
        sheet.add_worksheet("Cannibalization Pages", rows=5000, cols=12)
        sheet.add_worksheet("Summary", rows=20, cols=5)

        # Delete default Sheet1
        default_sheet = sheet.sheet1
        sheet.del_worksheet(default_sheet)

        # Set up Keywords tab headers
        keywords_ws = sheet.worksheet("Keywords")
        keywords_ws.update("A1:F1", [[
            "Keyword", "Latest", "Change",
            "Best Rank", "URL Ranking", "Last Checked"
        ]])
        _apply_header_format(keywords_ws, "A1:F1")

        # Set up Ranking History tab headers
        history_ws = sheet.worksheet("Ranking History")
        history_ws.update("A1:G1", [[
            "Check Date", "Keyword", "Current Rank", "Previous Rank",
            "Change", "Best Rank", "URL Ranking"
        ]])
        _apply_header_format(history_ws, "A1:G1")

        # Set up GSC Queries tab headers
        gsc_ws = sheet.worksheet("GSC Queries")
        gsc_ws.update("A1:H1", [[
            "Query", "Page", "Clicks", "Impressions", "CTR", "Position",
            "Start Date", "End Date"
        ]])
        _apply_header_format(gsc_ws, "A1:H1")

        summary_ws = sheet.worksheet("Cannibalization Summary")
        summary_ws.update("A1:J1", [[
            "Query", "Pages", "Best Position", "Worst Position",
            "Total Clicks", "Total Impressions", "Primary Page",
            "Competing Pages", "Start Date", "End Date"
        ]])
        _apply_header_format(summary_ws, "A1:J1")

        pages_ws = sheet.worksheet("Cannibalization Pages")
        pages_ws.update("A1:H1", [[
            "Query", "Page", "Position", "Clicks", "Impressions",
            "CTR", "Start Date", "End Date"
        ]])
        _apply_header_format(pages_ws, "A1:H1")

        # Set up Summary tab
        summary_ws = sheet.worksheet("Summary")
        summary_ws.update("A1:B5", [
            ["Metric", "Value"],
            ["Total Keywords", ""],
            ["Average Position", ""],
            ["Keywords in Top 10", ""],
            ["Last Updated", ""]
        ])
        _apply_header_format(summary_ws, "A1:B1")

        # Share sheet (make it accessible to anyone with link)
        sheet.share('', perm_type='anyone', role='reader')

        return sheet.id, sheet.url

    except Exception as e:
        raise Exception(f"Failed to create Google Sheet: {str(e)}")


def _normalize_date(value):
    if value is None or value == "":
        return None
    if hasattr(value, "date"):
        try:
            return value.date()
        except Exception:
            pass
    if hasattr(value, "isoformat"):
        try:
            return value
        except Exception:
            pass
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                return datetime.strptime(value[:19], fmt).date()
            except Exception:
                continue
        try:
            return datetime.fromisoformat(value).date()
        except Exception:
            return None
    return None


def sync_rankings_to_sheet(sheet_id: str, rankings_data: List, project_id: int = None,
                           rankings_history: List[Dict] = None):
    """
    Push ranking data to Google Sheet as time-series columns
    Each rank check adds a new column with the date

    Args:
        sheet_id: Google Sheet ID
        rankings_data: List of rows [keyword, current_rank, prev_rank, change, best_rank, url, date]
        project_id: Project ID for logging
    """
    try:
        client = get_sheets_client()
        sheet = client.open_by_key(sheet_id)
        ws = _get_or_create_worksheet(sheet, "Keywords", rows=1000, cols=20)

        history_rows = rankings_history or rankings_data or []
        if not history_rows:
            raise ValueError("No ranking data available to sync.")

        # Build history map: keyword -> {date: position}
        history_map = defaultdict(dict)
        dates = set()
        for row in history_rows:
            if not isinstance(row, dict):
                continue
            keyword = row.get("keyword") or row.get("Keyword")
            checked_at = _normalize_date(row.get("checked_at"))
            position = row.get("position")
            if keyword and checked_at:
                history_map[keyword][checked_at] = position if position is not None else ""
                dates.add(checked_at)

        if not dates:
            raise ValueError("No checked rankings found. Run a rank check before syncing.")

        sorted_dates = sorted(dates, reverse=True)
        latest_date = sorted_dates[0]
        history_dates = sorted_dates[1:]

        latest_meta = {}
        if rankings_data:
            for row in rankings_data:
                if not isinstance(row, dict):
                    continue
                keyword = row.get("keyword") or row.get("Keyword")
                if not keyword:
                    continue
                latest_meta[keyword] = {
                    "url": row.get("url_found") or row.get("URL Ranking") or "",
                    "checked": row.get("checked_at") or "",
                    "best_rank": row.get("best_rank") or row.get("best_position") or "",
                }

        headers = ["Keyword", "Latest"] + [d.isoformat() for d in history_dates] + [
            "Change", "Best Rank", "URL Ranking", "Last Checked"
        ]

        ws.clear()
        ws.update(f"A1:{rowcol_to_a1(1, len(headers))}", [headers])
        _apply_header_format(ws, f"A1:{rowcol_to_a1(1, len(headers))}")

        normalized_rows = []
        for keyword in sorted(history_map.keys()):
            latest_value = history_map[keyword].get(latest_date, "")
            prev_value = history_map[keyword].get(history_dates[0], "") if history_dates else ""

            change = ""
            if isinstance(latest_value, (int, float)) and isinstance(prev_value, (int, float)):
                diff = prev_value - latest_value
                change = f"+{diff}" if diff > 0 else str(diff)

            best_rank = ""
            numeric_positions = [v for v in history_map[keyword].values() if isinstance(v, (int, float))]
            if numeric_positions:
                best_rank = min(numeric_positions)

            meta = latest_meta.get(keyword, {})
            url = meta.get("url", "")
            checked = meta.get("checked", "")

            row = [keyword, latest_value]
            for date_value in history_dates:
                row.append(history_map[keyword].get(date_value, ""))
            row.extend([
                change,
                best_rank,
                url,
                checked,
            ])
            normalized_rows.append(row)

        if normalized_rows:
            ws.update(f"A2:{rowcol_to_a1(len(normalized_rows)+1, len(headers))}", normalized_rows)

        history_ws = _get_or_create_worksheet(sheet, "Ranking History", rows=2000, cols=10)
        history_ws.update("A1:G1", [[
            "Check Date", "Keyword", "Current Rank", "Previous Rank",
            "Change", "Best Rank", "URL Ranking"
        ]])
        _apply_header_format(history_ws, "A1:G1")

        history_rows = []
        for row in normalized_rows:
            checked = row[6] or datetime.now().strftime("%Y-%m-%d")
            history_rows.append([checked, row[0], row[1], row[2], row[3], row[4], row[5]])

        if history_rows:
            history_ws.append_rows(history_rows, value_input_option="USER_ENTERED")

        summary_ws = _get_or_create_worksheet(sheet, "Summary", rows=20, cols=5)
        summary_ws.update("A1:B1", [["Metric", "Value"]])
        _apply_header_format(summary_ws, "A1:B1")

        total_kw = len(normalized_rows)
        ranked_kws = [
            r[1] for r in normalized_rows
            if r[1] not in ("", "-", None, "Not Ranked")
            and isinstance(r[1], (int, float))
        ]
        avg_pos = sum(ranked_kws) / len(ranked_kws) if ranked_kws else 0
        top_10 = sum(
            1 for r in normalized_rows
            if isinstance(r[1], (int, float)) and r[1] <= 10
        )

        summary_ws.update("A1:B5", [
            ["Metric", "Value"],
            ["Total Keywords", total_kw],
            ["Average Position", round(avg_pos, 1) if avg_pos else "N/A"],
            ["Keywords in Top 10", top_10],
            ["Last Updated", datetime.now().strftime("%Y-%m-%d %H:%M")]
        ])

        if project_id:
            add_sync_log(
                project_id, "rankings_export",
                "success", f"Synced {len(normalized_rows)} keywords to Google Sheets"
            )

    except Exception as e:
        if project_id:
            add_sync_log(
                project_id, "rankings_export",
                "error", f"Failed to sync: {str(e)}"
            )
        raise Exception(f"Failed to sync rankings: {str(e)}")


def sync_gsc_to_sheet(sheet_id: str, gsc_data: List[List], project_id: int = None):
    """
    Push GSC query data to Google Sheet

    Args:
        sheet_id: Google Sheet ID
        gsc_data: List of rows [query, clicks, impressions, ctr, position, date_range]
        project_id: Project ID for logging
    """
    try:
        client = get_sheets_client()
        sheet = client.open_by_key(sheet_id)
        ws = _get_or_create_worksheet(sheet, "GSC Queries", rows=2000, cols=10)

        ws.update("A1:H1", [[
            "Query", "Page", "Clicks", "Impressions", "CTR", "Position",
            "Start Date", "End Date"
        ]])
        _apply_header_format(ws, "A1:H1")

        normalized_rows = []
        for row in gsc_data:
            if isinstance(row, dict):
                start_date = row.get("date_range_start", "")
                end_date = row.get("date_range_end", "")
                normalized_rows.append([
                    row.get("query", ""),
                    row.get("page") or row.get("page_url") or "",
                    row.get("clicks", 0),
                    row.get("impressions", 0),
                    row.get("ctr", 0),
                    row.get("position", 0),
                    str(start_date) if start_date is not None else "",
                    str(end_date) if end_date is not None else "",
                ])
            else:
                data = list(row)
                if len(data) >= 8:
                    normalized_rows.append(data[:8])
                elif len(data) == 6:
                    normalized_rows.append([data[0], "", data[1], data[2], data[3], data[4], "", ""])
                else:
                    padded = data + [""] * (8 - len(data))
                    normalized_rows.append(padded[:8])

        ws.batch_clear(["A2:H20000"])
        if normalized_rows:
            ws.update(f"A2:H{len(normalized_rows)+1}", normalized_rows)

        if project_id:
            add_sync_log(
                project_id, "gsc_export",
                "success", f"Synced {len(normalized_rows)} GSC queries to Google Sheets"
            )

    except Exception as e:
        if project_id:
            add_sync_log(
                project_id, "gsc_export",
                "error", f"Failed to sync GSC data: {str(e)}"
            )
        raise Exception(f"Failed to sync GSC data: {str(e)}")


def sync_cannibalization_to_sheet(sheet_id: str, cannibalization_cases: List[Dict],
                                  date_range_start: str = "", date_range_end: str = "",
                                  project_id: int = None):
    """Push cannibalization summary and pages to Google Sheets."""
    try:
        date_range_start = str(date_range_start) if date_range_start is not None else ""
        date_range_end = str(date_range_end) if date_range_end is not None else ""
        client = get_sheets_client()
        sheet = client.open_by_key(sheet_id)

        summary_ws = _get_or_create_worksheet(sheet, "Cannibalization Summary", rows=2000, cols=12)
        summary_ws.update("A1:J1", [[
            "Query", "Pages", "Best Position", "Worst Position",
            "Total Clicks", "Total Impressions", "Primary Page",
            "Competing Pages", "Start Date", "End Date"
        ]])
        _apply_header_format(summary_ws, "A1:J1")

        pages_ws = _get_or_create_worksheet(sheet, "Cannibalization Pages", rows=5000, cols=12)
        pages_ws.update("A1:H1", [[
            "Query", "Page", "Position", "Clicks", "Impressions",
            "CTR", "Start Date", "End Date"
        ]])
        _apply_header_format(pages_ws, "A1:H1")

        summary_rows = []
        page_rows = []
        for case in cannibalization_cases:
            summary_rows.append([
                case.get("query", ""),
                case.get("num_pages", 0),
                case.get("best_position", ""),
                case.get("worst_position", ""),
                case.get("total_clicks", 0),
                case.get("total_impressions", 0),
                case.get("primary_page", ""),
                ", ".join(case.get("competing_pages", [])),
                date_range_start,
                date_range_end,
            ])

            for page in case.get("pages", []):
                page_rows.append([
                    case.get("query", ""),
                    page.get("page", ""),
                    page.get("position", ""),
                    page.get("clicks", 0),
                    page.get("impressions", 0),
                    page.get("ctr", 0),
                    date_range_start,
                    date_range_end,
                ])

        summary_ws.batch_clear(["A2:J20000"])
        if summary_rows:
            summary_ws.update(f"A2:J{len(summary_rows)+1}", summary_rows)

        pages_ws.batch_clear(["A2:H50000"])
        if page_rows:
            pages_ws.update(f"A2:H{len(page_rows)+1}", page_rows)

        if project_id:
            add_sync_log(
                project_id, "gsc_export",
                "success", f"Synced {len(summary_rows)} cannibalization cases to Google Sheets"
            )
    except Exception as e:
        if project_id:
            add_sync_log(
                project_id, "gsc_export",
                "error", f"Failed to sync cannibalization: {str(e)}"
            )
        raise Exception(f"Failed to sync cannibalization: {str(e)}")


def delete_project_sheet(sheet_id: str):
    """Delete a Google Sheet by ID."""
    client = get_sheets_client()
    client.del_spreadsheet(sheet_id)


def read_keywords_from_sheet(sheet_id: str) -> List[str]:
    """
    Read keywords from Google Sheet (for importing)

    Returns:
        List of keyword strings
    """
    try:
        client = get_sheets_client()
        sheet = client.open_by_key(sheet_id)
        ws = sheet.worksheet("Keywords")

        # Get all values from column A (skip header)
        values = ws.col_values(1)[1:]  # Skip header row

        # Filter out empty cells
        keywords = [kw.strip() for kw in values if kw.strip()]

        return keywords

    except Exception as e:
        raise Exception(f"Failed to read keywords from sheet: {str(e)}")


def test_sheets_connection() -> Dict[str, any]:
    """Test Google Sheets API connection"""
    try:
        client = get_sheets_client()

        # Try to list spreadsheets (this will fail if credentials are invalid)
        # Note: This just tests auth, doesn't actually list sheets
        if client:
            return {"success": True, "message": "Google Sheets connection successful"}
        else:
            return {"success": False, "message": "Failed to create client"}

    except FileNotFoundError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        return {"success": False, "message": f"Connection failed: {str(e)}"}
