"""Instructions - ScrapingRobot API setup"""
import streamlit as st
from components.auth import require_authentication
from components.modern_ui import load_custom_css, render_header_with_subtitle, section_panel


st.set_page_config(page_title="ScrapingRobot API", page_icon="R", layout="wide", initial_sidebar_state="expanded")

require_authentication()
load_custom_css()

render_header_with_subtitle(
    "ScrapingRobot API",
    "Get an API key and connect it to SEO Rank Tracker",
    ""
)

with section_panel("Step 1 - Create a ScrapingRobot account", "", ""):
    st.markdown("""
    1. Sign up: https://scrapingrobot.com/
    2. Log in to your dashboard.
    """)

with section_panel("Step 2 - Generate an API key", "", ""):
    st.markdown("""
    1. Open your account dashboard.
    2. Copy your API key from the API settings section.
    """)

with section_panel("Step 3 - Save it in the app", "", ""):
    st.markdown("""
    1. Go to Settings -> SERP APIs -> ScrapingRobot.
    2. Paste the API key.
    3. Click "Save" and then "Test".
    """)
