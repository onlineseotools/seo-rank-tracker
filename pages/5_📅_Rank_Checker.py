"""Rank Checker page - Run ranking checks for projects"""
import streamlit as st
from datetime import datetime
from collections import defaultdict
from components.auth import (
    require_authentication,
    get_current_user,
    handle_user_menu,
    get_accessible_projects,
    user_can_edit_project,
)
from components.modern_ui import (
    load_custom_css, render_header_with_subtitle, section_panel,
    render_info_box, render_stat_card, render_sidebar_projects, render_app_footer,
    resolve_project_selection
)
from database.models import (
    get_keywords_by_project,
    get_rankings_by_project, get_sync_logs
)
from services.rank_checker import (
    check_project_rankings, estimate_check_cost, get_api_credentials
)
from services.google_sheets import sync_rankings_to_sheet
from database.models import get_setting


st.set_page_config(page_title="Rank Checker", page_icon="R", layout="wide", initial_sidebar_state="expanded")

require_authentication()

load_custom_css()

render_sidebar_projects(active_only=False)

current_user = get_current_user()
action = render_header_with_subtitle(
    "Rank Checker",
    "Check rankings for your projects with real-time updates",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="rank_checker"
)
handle_user_menu(action)

projects = get_accessible_projects()

if not projects:
    render_info_box("No projects found. Please create a project first.", "warning")
    st.stop()

selected_project_id = st.session_state.pop("active_project_id", None)
(
    project_groups,
    sorted_base_urls,
    default_base_url,
    default_variant_name,
    _
) = resolve_project_selection(projects, selected_project_id)

with section_panel("Project Selection", "", "Choose a website and location variant"):
    sel_col1, sel_col2 = st.columns([1, 1], gap="medium")

    with sel_col1:
        selected_base_url = st.selectbox(
            "Website",
            options=sorted_base_urls,
            index=sorted_base_urls.index(default_base_url) if default_base_url in sorted_base_urls else 0,
            label_visibility="visible"
        )

    with sel_col2:
        variants = project_groups[selected_base_url]
        variants_sorted = sorted(variants, key=lambda x: x['name'])
        variant_options = {p['name']: p for p in variants_sorted}
        variant_names = list(variant_options.keys())
        variant_index = variant_names.index(default_variant_name) if default_variant_name in variant_names else 0

        selected_variant_name = st.selectbox(
            "Variant",
            options=variant_names,
            index=variant_index,
            label_visibility="visible"
        )

        project = variant_options[selected_variant_name]
        project_id = project['id']
        can_edit = user_can_edit_project(project_id)

keywords = get_keywords_by_project(project_id)
rankings = get_rankings_by_project(project_id, latest_only=True)

keyword_count = len(keywords)
positions = [r['position'] for r in rankings if r.get('position')]
last_check = None
if rankings:
    last_dates = [r.get('checked_at') for r in rankings if r.get('checked_at')]
    last_check = max(last_dates) if last_dates else None

with section_panel("Project Snapshot", "", "Current keyword counts and last check status"):
    stat_col1, stat_col2, stat_col3 = st.columns(3)

    with stat_col1:
        render_stat_card("Total Keywords", str(keyword_count), "Active keywords")

    with stat_col2:
        best_rank = min(positions) if positions else None
        render_stat_card("Best Rank", str(best_rank) if best_rank else "N/A", "Best position")

    with stat_col3:
        last_check_text = (
            last_check.strftime("%Y-%m-%d") if isinstance(last_check, datetime)
            else (str(last_check) if last_check else "Not checked")
        )
        render_stat_card("Last Check", last_check_text, "Most recent run")

with section_panel("Rank Check Setup", "", "Select API and estimate cost"):
    api_options = ["serper", "dataforseo", "scrapingrobot"]
    api_labels = {
        "serper": "Serper.dev",
        "dataforseo": "DataForSEO",
        "scrapingrobot": "ScrapingRobot"
    }

    default_api = get_setting("default_serp_api") or "serper"
    api_index = api_options.index(default_api) if default_api in api_options else 0

    api_col1, api_col2 = st.columns([2, 1], gap="medium")

    with api_col1:
        api_type = st.selectbox(
            "API Provider",
            options=api_options,
            index=api_index,
            format_func=lambda x: api_labels.get(x, x)
        )

        st.markdown("<div style='height: 0.35rem;'></div>", unsafe_allow_html=True)
        run_check = st.button("Run Rank Check", type="primary", use_container_width=True, disabled=not can_edit)

    with api_col2:
        estimate = estimate_check_cost(keyword_count, api_type)
        render_stat_card(
            "Estimated Cost",
            f"${estimate['total_cost']}",
            estimate['estimated_time_formatted']
        )

        st.markdown("<div style='height: 0.35rem;'></div>", unsafe_allow_html=True)
        sync_sheet = st.button("Sync to Sheets", type="secondary", use_container_width=True)

creds = get_api_credentials(api_type)
missing_creds = False

if api_type == "serper" and not creds.get("api_key"):
    missing_creds = True
elif api_type == "dataforseo" and (not creds.get("username") or not creds.get("password")):
    missing_creds = True
elif api_type == "scrapingrobot" and not creds.get("api_key"):
    missing_creds = True

if missing_creds:
    render_info_box("Missing API credentials. Add them in Settings > SERP APIs.", "warning")

if sync_sheet:
    if not project.get("google_sheet_id"):
        render_info_box("No Google Sheet linked to this project.", "warning")
    elif not any(row.get("checked_at") for row in rankings):
        render_info_box("Run a rank check before syncing to Google Sheets.", "warning")
    else:
        try:
            with st.spinner("Syncing to Google Sheets..."):
                rankings_history = get_rankings_by_project(project_id, latest_only=False)
                sync_rankings_to_sheet(
                    project['google_sheet_id'],
                    rankings,
                    project_id,
                    rankings_history=rankings_history
                )

            render_info_box("Synced rankings to Google Sheets.", "success")
        except Exception as e:
            st.error(f"Sync failed: {str(e)}")

if run_check:
    if keyword_count == 0:
        render_info_box("No keywords in this project. Add keywords first.", "warning")
    elif missing_creds:
        render_info_box("Missing API credentials. Update Settings before running.", "warning")
    else:
        progress_bar = st.progress(0)
        status_text = st.empty()

        def progress_callback(current, total, keyword):
            progress_bar.progress(current / total)
            status_text.markdown(
                f"Checking **{keyword}** ({current}/{total})",
                unsafe_allow_html=True
            )

        with st.spinner("Running rank checks..."):
            result = check_project_rankings(
                project_id=project_id,
                api_type=api_type,
                api_credentials=creds,
                progress_callback=progress_callback
            )

        progress_bar.empty()
        status_text.empty()

        if result.get("success"):
            render_info_box(
                f"Checked {result['checked']} keywords. Success: {result['success']}, Errors: {result['errors']}",
                "success"
            )
        else:
            st.error(result.get("error", "Rank check failed"))

with section_panel("Recent Activity", "", "Latest rank check logs for this project"):
    logs = get_sync_logs(project_id=project_id, limit=15)

    if logs:
        for log in logs:
            status = log.get("status", "info")
            message = log.get("message", "")
            timestamp = log.get("created_at", "")
            render_info_box(f"{timestamp} - {message}", "info" if status == "success" else "warning")
    else:
        render_info_box("No recent rank check logs for this project.", "info")

render_app_footer()
