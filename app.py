"""
SEO Rank Tracker - Main Application
A comprehensive web application for tracking SEO rankings across multiple projects
"""
import textwrap
import streamlit as st
from components.auth import require_authentication, get_current_user, handle_user_menu
from components.modern_ui import (
    load_custom_css, render_header_with_subtitle,
    section_panel, render_stat_card,
    render_info_box, render_sidebar_projects, render_app_footer
)
from database.db import init_database, seed_initial_data

# Page config
st.set_page_config(
    page_title="SEO Rank Tracker",
    page_icon="SEO",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Load custom CSS
load_custom_css()

# Initialize database on first run
try:
    init_database()
    seed_initial_data()
except Exception as e:
    st.error(f"Database initialization error: {str(e)}")

# Require authentication
require_authentication()

# Sidebar projects list
render_sidebar_projects(active_only=False)

# Main header
current_user = get_current_user()
action = render_header_with_subtitle(
    "SEO Rank Tracker",
    "Track and analyze your website's search engine rankings across multiple projects",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="app_home"
)
handle_user_menu(action)

with section_panel("Features", "", "Everything you need to track and improve your SEO performance"):
    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("""
        <div class="modern-card">
            <div style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-muted);">DASHBOARD</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">Dashboard</h3>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 12px;">
                Overview of your ranking performance with key metrics and trends
            </p>
            <span class="badge badge-info">Analytics</span>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        st.markdown("""
        <div class="modern-card">
            <div style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-muted);">RANK CHECKER</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">Rank Checker</h3>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 12px;">
                Check rankings using multiple SERP APIs with automated syncing
            </p>
            <span class="badge badge-success">Automated</span>
        </div>
        """, unsafe_allow_html=True)

    with col3:
        st.markdown("""
        <div class="modern-card">
            <div style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-muted);">GSC ANALYTICS</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">GSC Analytics</h3>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 12px;">
                Advanced Search Console analytics with cannibalization detection
            </p>
            <span class="badge badge-warning">Advanced</span>
        </div>
        """, unsafe_allow_html=True)

    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("""
        <div class="modern-card">
            <div style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-muted);">PROJECTS</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">Projects</h3>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 12px;">
                Manage your SEO projects and connect to Google Sheets
            </p>
            <span class="badge badge-info">Management</span>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        st.markdown("""
        <div class="modern-card">
            <div style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-muted);">KEYWORDS</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">Keywords</h3>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 12px;">
                Add, view, and manage keywords for each project
            </p>
            <span class="badge badge-success">Organization</span>
        </div>
        """, unsafe_allow_html=True)

    with col3:
        st.markdown("""
        <div class="modern-card">
            <div style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-muted);">CANNIBALIZATION</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">Cannibalization</h3>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 12px;">
                Track and resolve keyword cannibalization issues
            </p>
            <span class="badge badge-danger">SEO Health</span>
        </div>
        """, unsafe_allow_html=True)

with section_panel("Quick Start Guide", "", "Get started in 3 easy steps"):
    st.markdown(textwrap.dedent("""
    <div class="glass-card" style="margin: 1rem 0;">
        <div class="timeline-item">
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 8px;">
                Step 1: Set up API credentials
            </div>
            <div style="color: var(--text-muted); margin-bottom: 12px;">
                - Configure at least one SERP API (Serper.dev, DataForSEO, or ScrapingRobot)<br>
                - Upload Google Sheets service account credentials (optional)<br>
                - Connect Google Search Console for advanced analytics
            </div>
        </div>

        <div class="timeline-item">
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 8px;">
                Step 2: Review and Configure Projects
            </div>
            <div style="color: var(--text-muted); margin-bottom: 12px;">
                - Initial projects have been seeded for you<br>
                - Create new projects or edit existing ones<br>
                - Link Google Sheets for automatic data syncing
            </div>
        </div>

        <div class="timeline-item" style="border-left: none; padding-bottom: 0;">
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 8px;">
                Step 3: Add Keywords and Check Rankings
            </div>
            <div style="color: var(--text-muted);">
                - Add keywords manually or import from CSV<br>
                - Discover keywords from Google Search Console<br>
                - Start checking rankings with automated syncing
            </div>
        </div>
    </div>
    """), unsafe_allow_html=True)

with section_panel("Current Status", "", "Overview of your SEO tracking setup"):
    from database.models import get_all_projects, get_setting
    from database.db import get_connection

    projects = get_all_projects(active_only=False)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM keywords WHERE is_active = 1")
    total_keywords = cursor.fetchone()[0]
    conn.close()

    apis_configured = 0
    if get_setting("serper_api_key"):
        apis_configured += 1
    if get_setting("dataforseo_username") and get_setting("dataforseo_password"):
        apis_configured += 1
    if get_setting("scrapingrobot_api_key"):
        apis_configured += 1

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        render_stat_card("Total Projects", str(len(projects)), "Active and inactive")

    with col2:
        render_stat_card("Total Keywords", str(total_keywords), "Across all projects")

    with col3:
        render_stat_card("APIs Configured", f"{apis_configured}/3", "SERP API providers")

    with col4:
        gsc_connected = get_setting("gsc_credentials_path") is not None
        render_stat_card("GSC Status", "Connected" if gsc_connected else "Not Connected", "Search Console")

with section_panel("Quick Actions", "", "Navigate to commonly used features"):
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        if st.button("View Dashboard", use_container_width=True, type="primary"):
            st.switch_page("pages/1_\U0001F4CA_Dashboard.py")

    with col2:
        if st.button("Check Rankings", use_container_width=True, type="primary"):
            st.switch_page("pages/5_\U0001F4C5_Rank_Checker.py")

    with col3:
        if st.button("Cannibalization", use_container_width=True, type="primary"):
            st.switch_page("pages/8_\u26A0\ufe0f_Keyword_Cannibalization.py")

    with col4:
        if st.button("Settings", use_container_width=True, type="secondary"):
            st.switch_page("pages/6_\u2699\ufe0f_Settings.py")

with section_panel("Resources", "", "Helpful links and documentation"):
    col1, col2 = st.columns(2)

    with col1:
        st.markdown("""
        <div class="modern-card">
            <h4 style="font-weight: 700; margin-bottom: 12px; color: var(--text-primary);">API Providers</h4>
            <div style="color: var(--text-muted); font-size: 0.875rem; line-height: 1.8;">
                - <a href="https://serper.dev" target="_blank" style="color: #6366f1; text-decoration: none;">Serper.dev</a> - Simple and affordable SERP API<br>
                - <a href="https://dataforseo.com" target="_blank" style="color: #6366f1; text-decoration: none;">DataForSEO</a> - Enterprise SERP API<br>
                - <a href="https://scrapingrobot.com" target="_blank" style="color: #6366f1; text-decoration: none;">ScrapingRobot</a> - Web scraping API
            </div>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        st.markdown("""
        <div class="modern-card">
            <h4 style="font-weight: 700; margin-bottom: 12px; color: var(--text-primary);">Google Services</h4>
            <div style="color: var(--text-muted); font-size: 0.875rem; line-height: 1.8;">
                - <a href="https://console.cloud.google.com" target="_blank" style="color: #6366f1; text-decoration: none;">Google Cloud Console</a> - For service account setup<br>
                - <a href="https://search.google.com/search-console" target="_blank" style="color: #6366f1; text-decoration: none;">Search Console</a> - Track search performance<br>
                - <a href="https://docs.google.com/spreadsheets" target="_blank" style="color: #6366f1; text-decoration: none;">Google Sheets</a> - Data visualization
            </div>
        </div>
        """, unsafe_allow_html=True)

render_app_footer()
