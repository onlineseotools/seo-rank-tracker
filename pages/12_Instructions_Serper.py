"""Instructions - Serper.dev API setup"""
import streamlit as st
from components.auth import require_authentication
from components.modern_ui import load_custom_css, render_header_with_subtitle, section_panel


st.set_page_config(page_title="Serper.dev API", page_icon="S", layout="wide", initial_sidebar_state="expanded")

require_authentication()
load_custom_css()

render_header_with_subtitle(
    "Serper.dev API",
    "Create an API key and connect it to SEO Rank Tracker",
    ""
)

with section_panel("Step 1 - Create a Serper account", "", ""):
    st.markdown("""
    1. Sign up: https://serper.dev/
    2. Verify your email and log in.
    """)

with section_panel("Step 2 - Get your API key", "", ""):
    st.markdown("""
    1. Open your dashboard: https://serper.dev/dashboard
    2. Copy the API key shown in your account.
    """)

with section_panel("Step 3 - Save it in the app", "", ""):
    st.markdown("""
    1. Go to Settings -> SERP APIs -> Serper.dev.
    2. Paste the API key.
    3. Click "Save" and then "Test".
    """)
