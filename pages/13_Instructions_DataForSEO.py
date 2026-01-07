"""Instructions - DataForSEO API setup"""
import streamlit as st
from components.auth import require_authentication
from components.modern_ui import load_custom_css, render_header_with_subtitle, section_panel


st.set_page_config(page_title="DataForSEO API", page_icon="D", layout="wide", initial_sidebar_state="expanded")

require_authentication()
load_custom_css()

render_header_with_subtitle(
    "DataForSEO API",
    "Create API credentials and connect them to the app",
    ""
)

with section_panel("Step 1 - Create a DataForSEO account", "", ""):
    st.markdown("""
    1. Sign up: https://dataforseo.com/
    2. Log in to your account dashboard.
    """)

with section_panel("Step 2 - Find your API credentials", "", ""):
    st.markdown("""
    1. Open the dashboard: https://app.dataforseo.com/
    2. Go to your API access or credentials section.
    3. Copy the API login (username) and password.
    """)

with section_panel("Step 3 - Save credentials in the app", "", ""):
    st.markdown("""
    1. Go to Settings -> SERP APIs -> DataForSEO.
    2. Paste the username and password.
    3. Click "Save" and then "Test".
    """)
