"""Instructions - Google Sheets API setup"""
import streamlit as st
from components.auth import require_authentication
from components.modern_ui import load_custom_css, render_header_with_subtitle, section_panel, render_info_box


st.set_page_config(page_title="Enable Sheets", page_icon="S", layout="wide", initial_sidebar_state="expanded")

require_authentication()
load_custom_css()

render_header_with_subtitle(
    "Enable Sheets",
    "Set up Google Sheets OAuth and optional service account access",
    ""
)

with section_panel("Prerequisites", "", "What you need before starting"):
    st.markdown("""
    - A Google account with access to Google Drive
    - A Google Cloud project (create one if you do not have it yet)
    """)

with section_panel("Step 1 - Enable Sheets and Drive APIs", "", ""):
    st.markdown("""
    1. Open Google Cloud Console: https://console.cloud.google.com/
    2. Select your project.
    3. Enable Google Sheets API:
       https://console.cloud.google.com/apis/library/sheets.googleapis.com
    4. Enable Google Drive API:
       https://console.cloud.google.com/apis/library/drive.googleapis.com
    """)

with section_panel("Step 2 - Configure OAuth consent screen", "", ""):
    st.markdown("""
    1. Open OAuth consent screen:
       https://console.cloud.google.com/apis/credentials/consent
    2. Choose "External" and fill required fields.
    3. Save and continue.
    """)

with section_panel("Step 3 - Create OAuth client ID (Desktop app)", "", ""):
    st.markdown("""
    1. Open Credentials:
       https://console.cloud.google.com/apis/credentials
    2. Click "Create credentials" -> "OAuth client ID".
    3. Application type: "Desktop app".
    4. Name: "SEO Rank Tracker".
    5. Click "Create" and download JSON.
    """)

with section_panel("Step 4 - Save the JSON for the app", "", ""):
    st.markdown("""
    1. Rename the downloaded file to `google_oauth_client.json`.
    2. Move it to: `credentials/google_oauth_client.json`.
    """)
    render_info_box(
        "The app reads OAuth client secrets from `credentials/google_oauth_client.json`.",
        "info"
    )

with section_panel("Step 5 - Connect from the app", "", ""):
    st.markdown("""
    1. Go to Settings -> Google Sheets.
    2. Click "Connect with Google".
    3. Approve access in the browser.
    4. The token is stored at `credentials/google_oauth_token.json`.
    """)

with section_panel("Optional - Service account mode", "", "Use this for shared drives or automated access"):
    st.markdown("""
    1. Create a service account:
       https://console.cloud.google.com/iam-admin/serviceaccounts
    2. Create and download a JSON key.
    3. Save it as `credentials/google_service_account.json`.
    4. Share any target sheet with the service account email (Editor access).
    """)
