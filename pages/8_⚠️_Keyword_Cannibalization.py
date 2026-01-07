"""Keyword Cannibalization Admin - Track cannibalization for target keywords"""
import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
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
    render_info_box, render_sidebar_projects, render_app_footer,
    resolve_project_selection
)
from database.models import (
    get_keywords_by_project,
    get_gsc_queries, mark_cannibalization_resolved,
    unmark_cannibalization_resolved, get_resolved_cannibalization,
    clear_gsc_queries, create_gsc_query
)
from services.search_console import (
    get_gsc_queries as fetch_gsc_queries,
    test_gsc_connection,
    list_gsc_properties
)


st.set_page_config(page_title="Keyword Cannibalization", page_icon="K", layout="wide", initial_sidebar_state="expanded")

require_authentication()

load_custom_css()

render_sidebar_projects(active_only=False)

current_user = get_current_user()
action = render_header_with_subtitle(
    "Keyword Cannibalization",
    "Track cannibalization for your targeted keywords",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="cannibalization"
)
handle_user_menu(action)

connection_status = test_gsc_connection()

if not connection_status['success']:
    render_info_box("Google Search Console not connected", "error")
    render_info_box(connection_status['message'], "warning")
    render_info_box("Connect your Google account in Settings > Search Console", "info")
    st.stop()

st.markdown(
    "<div class='notice-pill notice-pill--success'>Connected to Google Search Console</div>",
    unsafe_allow_html=True
)

projects = get_accessible_projects()

if not projects:
    render_info_box("No projects found.", "warning")
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
    col1, col2 = st.columns([1, 1], gap="medium")

    with col1:
        selected_base_url = st.selectbox(
            "Website",
            options=sorted_base_urls,
            index=sorted_base_urls.index(default_base_url) if default_base_url in sorted_base_urls else 0,
            help="Choose the main website/domain",
            label_visibility="visible"
        )

    with col2:
        variants = project_groups[selected_base_url]
        variants_sorted = sorted(variants, key=lambda x: x['name'])
        variant_options = {p['name']: p for p in variants_sorted}
        variant_names = list(variant_options.keys())
        variant_index = variant_names.index(default_variant_name) if default_variant_name in variant_names else 0

        selected_variant_name = st.selectbox(
            "Variant",
            options=variant_names,
            index=variant_index,
            help="Choose the specific location or variant",
            label_visibility="visible"
        )

        project = variant_options[selected_variant_name]
        project_id = project['id']
        can_edit = user_can_edit_project(project_id)

    st.markdown(
        f"<span class='badge badge-success'>{project['name']} - {project['target_location']}</span>",
        unsafe_allow_html=True
    )

with section_panel("GSC Property", "", "Select the property to analyze"):
    try:
        properties = list_gsc_properties()

        if not properties:
            st.warning("No verified properties found in your Search Console account.")
            st.stop()

        col1, col2 = st.columns([2, 1])

        with col1:
            default_property = project.get('gsc_property')

            if not default_property:
                for prop in properties:
                    if selected_base_url in prop or prop in selected_base_url:
                        default_property = prop
                        break

            if not default_property:
                default_property = properties[0]

            selected_property = st.selectbox(
                "GSC Property URL",
                options=properties,
                index=properties.index(default_property) if default_property in properties else 0,
                help="Select the Search Console property to analyze"
            )

        with col2:
            manual_override = st.checkbox(
                "Manual Override",
                help="Enable to enter custom property URL"
            )

        if manual_override:
            custom_property = st.text_input(
                "Custom Property URL",
                value=selected_property,
                placeholder="https://example.com or sc-domain:example.com",
                help="Enter exact property URL from Search Console"
            )
            selected_property = custom_property

        st.success(f"Using property: {selected_property}")

    except Exception as e:
        st.error(f"Error loading properties: {str(e)}")
        st.stop()

with section_panel("Date Range", "", "Choose a timeframe for analysis"):
    date_mode = st.radio(
        "Select Mode",
        options=["Quick Presets", "Custom Range"],
        horizontal=True
    )

    if date_mode == "Quick Presets":
        preset_options = {
            "Last 7 days": 7,
            "Last 14 days": 14,
            "Last 28 days": 28,
            "Last 3 months": 90,
            "Last 6 months": 180,
            "Last 12 months": 365,
            "Last 16 months (Max)": 480
        }

        selected_preset = st.selectbox(
            "Choose timeframe",
            options=list(preset_options.keys()),
            index=2
        )

        days = preset_options[selected_preset]
        current_end = datetime.now() - timedelta(days=3)
        current_start = current_end - timedelta(days=days)

        st.info(f"{current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')} ({days} days)")

    else:
        col1, col2 = st.columns(2)

        max_date = datetime.now() - timedelta(days=3)
        min_date = max_date - timedelta(days=480)

        with col1:
            custom_start = st.date_input(
                "Start Date",
                value=(max_date - timedelta(days=28)).date(),
                min_value=min_date.date(),
                max_value=max_date.date()
            )

        with col2:
            custom_end = st.date_input(
                "End Date",
                value=max_date.date(),
                min_value=custom_start,
                max_value=max_date.date()
            )

        current_start = datetime.combine(custom_start, datetime.min.time())
        current_end = datetime.combine(custom_end, datetime.min.time())
        days = (current_end - current_start).days

        st.info(f"{current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')} ({days} days)")

with section_panel("Fetch & Analyze", "", "Load GSC data for cannibalization analysis"):
    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Website", selected_base_url)

    with col2:
        st.metric("Variant", project['target_location'])

    with col3:
        st.metric("Date Range", f"{days} days")

    action_col1, action_col2 = st.columns(2, gap="small")

    with action_col1:
        if st.button("Fetch GSC Data", type="primary", use_container_width=True, disabled=not can_edit):
            with st.spinner("Fetching data from Google Search Console..."):
                try:
                    gsc_data = fetch_gsc_queries(
                        selected_property,
                        current_start.strftime("%Y-%m-%d"),
                        current_end.strftime("%Y-%m-%d"),
                        include_page=True
                    )

                    clear_gsc_queries(project_id)

                    for query in gsc_data:
                        create_gsc_query(
                            project_id=project_id,
                            query=query['query'],
                            clicks=query['clicks'],
                            impressions=query['impressions'],
                            ctr=query['ctr'],
                            position=query['position'],
                            date_range_start=current_start.date(),
                            date_range_end=current_end.date(),
                            page_url=query.get('page')
                        )

                    st.session_state['keyword_cannibal_fetched'] = True
                    st.success(f"Fetched {len(gsc_data)} query-page combinations")
                    st.rerun()

                except Exception as e:
                    st.error(f"Error fetching data: {str(e)}")

    with action_col2:
        if st.button("Reset Data", type="secondary", use_container_width=True, disabled=not can_edit):
            clear_gsc_queries(project_id)
            st.session_state['keyword_cannibal_fetched'] = False
            st.success("Data cleared")
            st.rerun()

st.divider()

if not st.session_state.get('keyword_cannibal_fetched', False):
    existing_data = get_gsc_queries(project_id)
    if existing_data:
        st.session_state['keyword_cannibal_fetched'] = True
    else:
        st.info("Click 'Fetch GSC Data' to load cannibalization analysis")
        st.stop()

gsc_data_db = get_gsc_queries(project_id)

if not gsc_data_db:
    st.warning("No GSC data available")
    st.stop()

keywords_db = get_keywords_by_project(project_id)
target_keywords = {k['keyword'].lower(): k['keyword'] for k in keywords_db}

filtered_gsc_data = []
for item in gsc_data_db:
    query_lower = item['query'].lower()
    if query_lower in target_keywords:
        filtered_gsc_data.append(item)

if not filtered_gsc_data:
    st.warning("No GSC data found for your target keywords. Add keywords to this project.")
    st.stop()

cannibalization_cases = {}

for item in filtered_gsc_data:
    query = item['query']
    page = item.get('page_url', 'Unknown')

    if query not in cannibalization_cases:
        cannibalization_cases[query] = []

    cannibalization_cases[query].append({
        'page': page,
        'position': item['position'],
        'clicks': item['clicks'],
        'impressions': item['impressions'],
        'ctr': item['ctr']
    })

cannibalized_keywords = {
    keyword: pages
    for keyword, pages in cannibalization_cases.items()
    if len(pages) > 1
}

resolved_cases = get_resolved_cannibalization(project_id)
resolved_keywords = {r['keyword'] for r in resolved_cases}

active_cannibalization = {
    k: v for k, v in cannibalized_keywords.items()
    if k not in resolved_keywords
}

resolved_cannibalization = {
    k: v for k, v in cannibalized_keywords.items()
    if k in resolved_keywords
}

with section_panel("Cannibalization Summary", "", "Overview of cannibalization status"):
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Target Keywords", len(target_keywords))

    with col2:
        st.metric("Found in GSC", len(cannibalization_cases))

    with col3:
        st.metric("Active Cannibalization", len(active_cannibalization),
                  delta=f"-{len(resolved_cannibalization)}" if resolved_cannibalization else None)

    with col4:
        st.metric("Resolved Cases", len(resolved_cannibalization))

st.divider()

tab1, tab2, tab3 = st.tabs(["Active Cannibalization", "Resolved Cases", "All Keywords"])

with tab1:
    st.subheader("Active Keyword Cannibalization")

    if not active_cannibalization:
        st.success("No active cannibalization detected for your target keywords.")
    else:
        st.warning(f"Found {len(active_cannibalization)} keywords with cannibalization")

        for keyword, pages in sorted(active_cannibalization.items(),
                                     key=lambda x: sum(p['clicks'] for p in x[1]),
                                     reverse=True):
            pages_sorted = sorted(pages, key=lambda x: x['position'])

            total_clicks = sum(p['clicks'] for p in pages)
            total_impressions = sum(p['impressions'] for p in pages)
            best_position = pages_sorted[0]['position']
            worst_position = pages_sorted[-1]['position']

            with st.expander(
                f"{keyword} ({len(pages)} pages) - {total_clicks} clicks, {total_impressions:,} impressions"
            ):
                col1, col2, col3 = st.columns(3)

                with col1:
                    st.metric("Pages Ranking", len(pages))

                with col2:
                    st.metric("Best Position", f"{best_position:.1f}")

                with col3:
                    st.metric("Worst Position", f"{worst_position:.1f}")

                df_pages = pd.DataFrame(pages_sorted)
                df_pages['ctr'] = (df_pages['ctr'] * 100).round(2).astype(str) + '%'
                df_pages['position'] = df_pages['position'].round(1)
                df_pages.columns = ['Page', 'Position', 'Clicks', 'Impressions', 'CTR']

                st.dataframe(df_pages, use_container_width=True, hide_index=True)

                st.info(
                    "Recommendation: consolidate content to the best-performing page and redirect competing pages."
                )

                col1, col2 = st.columns([3, 1], vertical_alignment="bottom")

                with col1:
                    notes = st.text_input(
                        "Resolution notes (optional)",
                        key=f"notes_{keyword}",
                        placeholder="e.g., Merged content and added redirects"
                    )

                with col2:
                    if st.button("Mark as Resolved", key=f"resolve_{keyword}", disabled=not can_edit):
                        if mark_cannibalization_resolved(project_id, keyword, notes):
                            st.success(f"Marked '{keyword}' as resolved")
                            st.rerun()
                        else:
                            st.error("Failed to mark as resolved")

with tab2:
    st.subheader("Resolved Cannibalization Cases")

    if not resolved_cannibalization:
        st.info("No resolved cases yet")
    else:
        st.success(f"You have resolved {len(resolved_cannibalization)} cannibalization cases")

        for keyword, pages in sorted(resolved_cannibalization.items(),
                                     key=lambda x: sum(p['clicks'] for p in x[1]),
                                     reverse=True):
            resolution_info = next((r for r in resolved_cases if r['keyword'] == keyword), None)
            pages_sorted = sorted(pages, key=lambda x: x['position'])

            total_clicks = sum(p['clicks'] for p in pages)
            total_impressions = sum(p['impressions'] for p in pages)

            with st.expander(
                f"{keyword} ({len(pages)} pages still showing) - "
                f"Resolved on {resolution_info['resolved_date'] if resolution_info else 'Unknown'}"
            ):
                if resolution_info and resolution_info.get('notes'):
                    st.info(f"Notes: {resolution_info['notes']}")

                st.warning(
                    "This keyword is still showing multiple pages in GSC data. "
                    "It may take time for changes to reflect in Search Console."
                )

                col1, col2 = st.columns(3)

                with col1:
                    st.metric("Pages Still Showing", len(pages))

                with col2:
                    st.metric("Total Clicks", total_clicks)

                df_pages = pd.DataFrame(pages_sorted)
                df_pages['ctr'] = (df_pages['ctr'] * 100).round(2).astype(str) + '%'
                df_pages['position'] = df_pages['position'].round(1)
                df_pages.columns = ['Page', 'Position', 'Clicks', 'Impressions', 'CTR']

                st.dataframe(df_pages, use_container_width=True, hide_index=True)

                if st.button("Unmark as Resolved", key=f"unresolve_{keyword}", disabled=not can_edit):
                    if unmark_cannibalization_resolved(project_id, keyword):
                        st.success(f"Moved '{keyword}' back to active cannibalization")
                        st.rerun()
                    else:
                        st.error("Failed to unmark")

with tab3:
    st.subheader("All Target Keywords in GSC")

    all_keywords_data = []

    for keyword, pages in cannibalization_cases.items():
        total_clicks = sum(p['clicks'] for p in pages)
        total_impressions = sum(p['impressions'] for p in pages)
        avg_position = sum(p['position'] for p in pages) / len(pages)
        avg_ctr = total_clicks / total_impressions if total_impressions > 0 else 0

        all_keywords_data.append({
            'Keyword': keyword,
            'Pages': len(pages),
            'Clicks': total_clicks,
            'Impressions': total_impressions,
            'CTR': f"{avg_ctr*100:.2f}%",
            'Avg Position': round(avg_position, 1),
            'Status': 'Resolved' if keyword in resolved_keywords else
                      ('Cannibalized' if len(pages) > 1 else 'OK')
        })

    df_all = pd.DataFrame(all_keywords_data)
    df_all = df_all.sort_values('Clicks', ascending=False)

    st.dataframe(df_all, use_container_width=True, hide_index=True, height=500)

    st.metric("Total Keywords", len(all_keywords_data))

with section_panel("Quick Summary", "", "Overall cannibalization health"):
    summary_col1, summary_col2, summary_col3 = st.columns(3)

    with summary_col1:
        st.write("Cannibalization Rate")
        cannibal_rate = (len(cannibalized_keywords) / len(target_keywords) * 100) if target_keywords else 0
        st.metric("", f"{cannibal_rate:.1f}%")

    with summary_col2:
        st.write("Resolution Progress")
        resolution_rate = (len(resolved_cannibalization) / len(cannibalized_keywords) * 100) if cannibalized_keywords else 0
        st.metric("", f"{resolution_rate:.0f}%")

    with summary_col3:
        st.write("Keywords Not in GSC")
        missing = len(target_keywords) - len(cannibalization_cases)
        st.metric("", missing)
        st.caption("Keywords in your list but not found in GSC data")

render_app_footer()
