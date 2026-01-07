"""Google Search Console integration"""
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from pathlib import Path
import shutil
import pickle
import os
import config


SCOPES = config.GOOGLE_OAUTH_SCOPES
TOKEN_PATH = config.GSC_TOKEN_PATH


def _save_gsc_credentials(creds):
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(TOKEN_PATH, 'wb') as token:
        pickle.dump(creds, token)


def _build_gsc_flow(client_secrets_path: str = None, redirect_uri: str = None):
    if client_secrets_path is None:
        client_secrets_path = str(config.GOOGLE_OAUTH_CLIENT_PATH)

    if not client_secrets_path:
        raise FileNotFoundError("Client secrets file not found.")

    client_path = Path(client_secrets_path)
    if not client_path.exists() and config.LEGACY_GOOGLE_OAUTH_CLIENT_PATH.exists():
        client_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(config.LEGACY_GOOGLE_OAUTH_CLIENT_PATH, client_path)

    if not client_path.exists():
        raise FileNotFoundError("Client secrets file not found.")

    flow = InstalledAppFlow.from_client_secrets_file(
        str(client_path), SCOPES
    )
    if redirect_uri:
        flow.redirect_uri = redirect_uri
    return flow


def get_gsc_auth_url(client_secrets_path: str = None, redirect_uri: str = None, state: str = None):
    """Return OAuth consent URL and state for Google Search Console."""
    flow = _build_gsc_flow(client_secrets_path, redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return auth_url, state


def exchange_gsc_auth_code(code: str, client_secrets_path: str = None, redirect_uri: str = None):
    """Exchange OAuth code for credentials and persist the token."""
    if not code:
        raise ValueError("Authorization code is required.")

    flow = _build_gsc_flow(client_secrets_path, redirect_uri)
    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_gsc_credentials(creds)
    return creds


def get_gsc_credentials():
    """Get or create GSC OAuth credentials"""
    creds = None

    # Load existing token
    if TOKEN_PATH.exists():
        with open(TOKEN_PATH, 'rb') as token:
            creds = pickle.load(token)

    # If credentials don't exist or are invalid, return None
    # User will need to authenticate via the Settings page
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                # Save refreshed credentials
                TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
                with open(TOKEN_PATH, 'wb') as token:
                    pickle.dump(creds, token)
            except:
                return None
        else:
            return None

    return creds


def initiate_gsc_auth(client_secrets_path: str = None):
    """
    Initiate GSC OAuth flow
    This should be called from the Settings page

    Returns:
        OAuth flow object
    """
    flow = _build_gsc_flow(client_secrets_path)
    creds = flow.run_local_server(port=0)
    _save_gsc_credentials(creds)
    return creds


def get_gsc_queries(site_url: str, start_date: str, end_date: str,
                   credentials = None, include_page: bool = False) -> List[Dict]:
    """
    Fetch search queries from Google Search Console

    Args:
        site_url: Site property URL (e.g., "https://example.com" or "sc-domain:example.com")
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        credentials: OAuth credentials (optional, will load from file if not provided)
        include_page: Include page URL dimension for page-level analysis

    Returns:
        List of query dictionaries
    """
    if credentials is None:
        credentials = get_gsc_credentials()

    if not credentials:
        raise Exception("GSC credentials not found. Please authenticate in Settings.")

    try:
        service = build('searchconsole', 'v1', credentials=credentials)

        dimensions = ['query', 'page'] if include_page else ['query']

        response = service.searchanalytics().query(
            siteUrl=site_url,
            body={
                'startDate': start_date,
                'endDate': end_date,
                'dimensions': dimensions,
                'rowLimit': 25000
            }
        ).execute()

        queries = []
        for row in response.get('rows', []):
            query_data = {
                'query': row['keys'][0],
                'clicks': row['clicks'],
                'impressions': row['impressions'],
                'ctr': row['ctr'],
                'position': row['position']
            }

            if include_page:
                query_data['page'] = row['keys'][1] if len(row['keys']) > 1 else None

            queries.append(query_data)

        return queries

    except Exception as e:
        raise Exception(f"Failed to fetch GSC data: {str(e)}")


def list_gsc_properties(credentials = None) -> List[str]:
    """
    List all verified properties in Google Search Console

    Returns:
        List of site URLs
    """
    if credentials is None:
        credentials = get_gsc_credentials()

    if not credentials:
        raise Exception("GSC credentials not found. Please authenticate in Settings.")

    try:
        service = build('searchconsole', 'v1', credentials=credentials)
        response = service.sites().list().execute()

        properties = [site['siteUrl'] for site in response.get('siteEntry', [])]
        return properties

    except Exception as e:
        raise Exception(f"Failed to list GSC properties: {str(e)}")


def test_gsc_connection() -> Dict[str, any]:
    """Test GSC API connection"""
    try:
        creds = get_gsc_credentials()

        if not creds:
            return {
                "success": False,
                "message": "Not authenticated. Please connect your Google account in Settings."
            }

        # Try to list properties
        properties = list_gsc_properties(creds)

        return {
            "success": True,
            "message": f"Connected successfully. Found {len(properties)} properties."
        }

    except Exception as e:
        return {"success": False, "message": str(e)}


def get_default_date_range(days: int = 28) -> tuple:
    """
    Get default date range for GSC queries

    Args:
        days: Number of days to look back (default 28, GSC limit is 3 days lag)

    Returns:
        (start_date, end_date) as strings in YYYY-MM-DD format
    """
    # GSC data has ~3 days lag
    end_date = datetime.now() - timedelta(days=3)
    start_date = end_date - timedelta(days=days)

    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")
