"""Instructions - Google Search Console API setup"""
import streamlit as st
from components.auth import require_authentication
from components.modern_ui import load_custom_css, render_header_with_subtitle, section_panel, render_info_box


st.set_page_config(page_title="Get GSC API", page_icon="G", layout="wide", initial_sidebar_state="expanded")

require_authentication()
load_custom_css()

render_header_with_subtitle(
    "Get GSC API",
    "Step-by-step guide to create the Search Console OAuth client and JSON",
    ""
)

with section_panel("Prerequisites", "", "What you need before starting"):
    st.markdown("""
    - A Google account that owns or has access to your Search Console properties
    - A Google Cloud project (you can create one during the steps below)
    - Access to the Google Cloud Console
    """)

with section_panel("Step 1 - Create or select a Google Cloud project", "", ""):
    st.markdown("""
    1. Open Google Cloud Console: https://console.cloud.google.com/
    2. Use the project selector at the top to create or select a project.
    3. Give it a clear name, for example: "SEO Rank Tracker".
    """)

with section_panel("Step 2 - Enable Google Search Console API", "", ""):
    st.markdown("""
    1. Open the API Library: https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
    2. Click "Enable".
    """)

with section_panel("Step 3 - Configure OAuth consent screen", "", ""):
    st.markdown("""
    1. Open OAuth consent screen: https://console.cloud.google.com/apis/credentials/consent
    2. Choose "External" (for most accounts) and click "Create".
    3. Fill required fields (App name, User support email, Developer contact).
    4. Save and continue until the screen is created.
    """)

with section_panel("Step 4 - Create OAuth client ID", "", ""):
    st.markdown("""
    1. Open Credentials: https://console.cloud.google.com/apis/credentials
    2. Click "Create credentials" -> "OAuth client ID".
    3. Application type: "Desktop app".
    4. Name it "SEO Rank Tracker".
    5. Click "Create".
    """)

with section_panel("Step 5 - Download JSON and place it in the app", "", ""):
    st.markdown("""
    1. In the OAuth client list, click "Download JSON".
    2. Rename the file to `client_secrets.json`.
    3. Move it to: `credentials/client_secrets.json`.
    """)
    render_info_box(
        "The app expects `credentials/client_secrets.json` for Search Console OAuth.",
        "info"
    )

with section_panel("Step 6 - Authenticate once", "", ""):
    st.markdown("""
    1. From your project root, run:
       `python setup_gsc.py`
    2. A browser window will open. Log in and approve access.
    3. This creates `credentials/gsc_token.pickle` for the app to use.
    """)

with section_panel("Step 7 - Verify your site in Search Console", "", ""):
    st.markdown("""
    1. Open Search Console: https://search.google.com/search-console
    2. Add and verify your property (URL-prefix or domain).
    3. In the app, update each project with the correct GSC property if needed.
    """)
