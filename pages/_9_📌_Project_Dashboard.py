"""Project Dashboard - Per-project performance view"""
import io
from datetime import datetime, timedelta

import pandas as pd
import streamlit as st

from components.auth import (
    require_authentication,
    get_current_user,
    handle_user_menu,
    get_accessible_projects,
    user_can_edit_project,
)
from components.modern_ui import (
    load_custom_css,
    render_header_with_subtitle,
    section_panel,
    render_stat_card,
    render_info_box,
    render_sidebar_projects,
    render_app_footer,
    resolve_project_selection,
)
from database.models import (
    get_project_stats,
    get_rankings_by_project,
    get_top_movers,
    get_keywords_by_project,
    create_keywords_bulk,
    delete_keywords_bulk,
    create_gsc_query,
    clear_gsc_queries,
    get_gsc_queries as get_stored_gsc_queries,
    get_new_gsc_discoveries,
    update_project,
    get_sync_logs,
    get_setting,
    get_best_rank,
    user_can_access_project,
    get_resolved_cannibalization,
)
from components.charts import (
    create_ranking_distribution_chart,
    create_trend_line_chart,
)
from components.tables import display_top_movers_table
from services.rank_checker import (
    check_project_rankings,
    estimate_check_cost,
    get_api_credentials,
)
from services.google_sheets import (
    sync_rankings_to_sheet,
    sync_gsc_to_sheet,
    sync_cannibalization_to_sheet,
    create_project_sheet,
    delete_project_sheet,
)
from services.search_console import (
    get_gsc_queries as fetch_gsc_queries,
    test_gsc_connection,
    list_gsc_properties,
)
from services.gsc_analytics import detect_cannibalization, find_opportunities


st.set_page_config(
    page_title="Project Dashboard",
    page_icon="Project",
    layout="wide",
    initial_sidebar_state="expanded",
)

require_authentication()

load_custom_css()

render_sidebar_projects(active_only=False)

current_user = get_current_user()
action = render_header_with_subtitle(
    "Project Dashboard",
    "All project data and actions in one place",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="project_dashboard"
)
handle_user_menu(action)

projects = get_accessible_projects()

if not projects:
    render_info_box("No projects found. Please create a project first.", "warning")
    render_app_footer()
    st.stop()

selected_project_id = st.session_state.pop("active_project_id", None)
(
    project_groups,
    sorted_base_urls,
    default_base_url,
    default_variant_name,
    selected_project,
) = resolve_project_selection(projects, selected_project_id)

if selected_project:
    project = selected_project
else:
    if not default_base_url:
        render_info_box("No project selected.", "warning")
        render_app_footer()
        st.stop()
    variants = project_groups[default_base_url]
    variants_sorted = sorted(variants, key=lambda x: x["name"])
    project = next(
        (p for p in variants_sorted if p["name"] == default_variant_name),
        variants_sorted[0],
    )

project_id = project["id"]
if current_user and current_user.get("role") != "admin":
    if not user_can_access_project(current_user["id"], project_id):
        render_info_box("You don't have access to this project.", "warning")
        render_app_footer()
        st.stop()
can_edit = user_can_edit_project(project_id)

st.markdown(
    f"<span class='badge badge-success'>{project['name']} - {project['target_location']}</span>",
    unsafe_allow_html=True,
)

keywords = get_keywords_by_project(project_id)
keyword_count = len(keywords)
rankings_latest = get_rankings_by_project(project_id, latest_only=True)
rankings_history = get_rankings_by_project(project_id, latest_only=False)

history_df = pd.DataFrame(rankings_history)
if not history_df.empty and "checked_at" in history_df.columns:
    history_df["checked_at"] = pd.to_datetime(history_df["checked_at"], errors="coerce").dt.date
    history_df = history_df.dropna(subset=["checked_at"])

stats = get_project_stats(project_id)

(tab_overview,
 tab_keywords,
 tab_rank,
 tab_search,
 tab_insights,
 tab_cannibalization,
 tab_settings) = st.tabs([
    "Overview",
    "Keywords",
    "Rank Checker",
    "Search Console",
    "Insights",
    "Cannibalization",
    "Project Settings",
])

with tab_overview:
    with section_panel("Project Overview", "", "Core performance snapshot"):
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            render_stat_card("Total Keywords", str(stats.get("total_keywords", 0)), "Active keywords")

        with col2:
            avg_pos = stats.get("average_position")
            render_stat_card("Avg Position", f"{avg_pos:.1f}" if avg_pos else "N/A", "Across all keywords")

        with col3:
            top_10_count = stats.get("top_10_count", 0)
            total_kw = stats.get("total_keywords", 0) or 0
            top_10_pct = f"{(top_10_count/total_kw*100):.0f}% of keywords" if total_kw > 0 else "0%"
            render_stat_card("Top 10 Rankings", str(top_10_count), top_10_pct)

        with col4:
            improved = stats.get("improved_count", 0)
            declined = stats.get("declined_count", 0)
            render_stat_card("Movers", f"+{improved} / -{declined}", "Since last check")

    with section_panel("Project Info", "", "Settings and links for this project"):
        info_col1, info_col2, info_col3 = st.columns(3)

        with info_col1:
            st.write(f"**Name:** {project['name']}")
            st.write(f"**URL:** {project['url']}")
            st.write(f"**Location:** {project['target_location']}")

        with info_col2:
            st.write(f"**Frequency:** {project.get('update_frequency', 'monthly')}")
            st.write(f"**Status:** {'Active' if project.get('is_active') else 'Inactive'}")
            st.write(f"**GSC Property:** {project.get('gsc_property') or 'Not linked'}")

        with info_col3:
            if project.get("google_sheet_url"):
                st.link_button("Open Google Sheet", project["google_sheet_url"], use_container_width=True)
                unlink = st.button("Unlink Sheet", use_container_width=True, key="unlink_sheet", disabled=not can_edit)
                confirm_delete = st.checkbox("Confirm delete sheet", key="confirm_delete_sheet")
                delete_sheet = st.button("Delete Sheet", use_container_width=True, key="delete_sheet", disabled=not can_edit)

                if unlink:
                    update_project(project_id, google_sheet_id=None, google_sheet_url=None)
                    st.success("Sheet unlinked")
                    st.rerun()

                if delete_sheet:
                    if not confirm_delete:
                        st.warning("Confirm delete sheet to continue.")
                    else:
                        try:
                            with st.spinner("Deleting sheet..."):
                                delete_project_sheet(project["google_sheet_id"])
                            update_project(project_id, google_sheet_id=None, google_sheet_url=None)
                            st.success("Sheet deleted")
                            st.rerun()
                        except Exception as exc:
                            st.error(f"Failed to delete sheet: {exc}")
            else:
                if st.button("Create Google Sheet", use_container_width=True, disabled=not can_edit):
                    try:
                        with st.spinner("Creating Google Sheet..."):
                            sheet_id, sheet_url = create_project_sheet(project["name"])
                            update_project(project_id, google_sheet_id=sheet_id, google_sheet_url=sheet_url)
                            st.success("Google Sheet created")
                            st.rerun()
                    except Exception as exc:
                        st.error(f"Failed to create sheet: {exc}")

    with section_panel("Performance Charts", "", "Ranking distribution and trends"):
        if not rankings_latest:
            render_info_box("No ranking data available yet for this project.", "info")
        else:
            chart_col1, chart_col2 = st.columns(2)

            with chart_col1:
                dist_chart = create_ranking_distribution_chart(rankings_latest)
                st.plotly_chart(dist_chart, use_container_width=True)

            with chart_col2:
                if history_df.empty:
                    render_info_box("No ranking history available yet.", "info")
                else:
                    trend_chart = create_trend_line_chart(history_df)
                    st.plotly_chart(trend_chart, use_container_width=True)

    with section_panel("Top Movers", "", "Largest ranking changes in the latest run"):
        movers = get_top_movers(project_id, limit=10)
        if movers:
            display_top_movers_table(movers)
        else:
            render_info_box("No movers found yet for this project.", "info")

    with section_panel("Recent Rankings", "", "Latest positions for tracked keywords"):
        if not rankings_latest:
            render_info_box("No keywords found yet.", "info")
        else:
            table_data = []
            for row in rankings_latest:
                table_data.append({
                    "Keyword": row.get("keyword", ""),
                    "Current Rank": row.get("position") or "Not Ranked",
                    "Previous Rank": row.get("previous_position") or "-",
                    "URL": (row.get("url_found") or "-")[:60],
                    "Last Checked": row.get("checked_at") or "-",
                })

            st.dataframe(pd.DataFrame(table_data), use_container_width=True, hide_index=True, height=420)

with tab_keywords:
    with section_panel("Keywords", "", "View and manage tracked keywords"):
        if not rankings_latest:
            render_info_box("No keywords found. Add keywords below.", "info")
        else:
            table_rows = []
            for row in rankings_latest:
                change = "-"
                if row.get("position") and row.get("previous_position"):
                    diff = row["previous_position"] - row["position"]
                    change = f"+{diff}" if diff > 0 else str(diff)

                table_rows.append({
                    "ID": row.get("id"),
                    "Keyword": row.get("keyword", ""),
                    "Current Rank": row.get("position") or "Not Ranked",
                    "Previous Rank": row.get("previous_position") or "-",
                    "Change": change,
                    "URL": (row.get("url_found") or "-")[:60],
                    "Last Checked": row.get("checked_at") or "-",
                })

            df_keywords = pd.DataFrame(table_rows)
            st.dataframe(df_keywords.drop(columns=["ID"]), use_container_width=True, hide_index=True, height=500)

            delete_ids = st.multiselect(
                "Select keywords to delete",
                options=df_keywords["ID"].tolist(),
                format_func=lambda x: df_keywords[df_keywords["ID"] == x]["Keyword"].values[0],
            )
            if delete_ids and st.button("Delete Selected", type="secondary", use_container_width=True, disabled=not can_edit):
                count = delete_keywords_bulk(delete_ids)
                st.success(f"Deleted {count} keywords")
                st.rerun()

    with section_panel("Add Keywords", "", "Add new keywords for this project"):
        add_method = st.radio(
            "Add Method",
            options=["Single Keyword", "Bulk Paste"],
            horizontal=True,
        )

        if add_method == "Single Keyword":
            with st.form("add_single_keyword_dashboard"):
                keyword = st.text_input("Keyword", placeholder="seo tools")
                submit = st.form_submit_button("Add Keyword", disabled=not can_edit)

                if submit and keyword:
                    count = create_keywords_bulk(project_id, [keyword.strip()])
                    if count > 0:
                        st.success(f"Added keyword: {keyword}")
                        st.rerun()
                    else:
                        st.error("Keyword already exists or failed to add")
        else:
            with st.form("add_bulk_keywords_dashboard"):
                st.write("Paste keywords below (one per line):")
                keywords_text = st.text_area(
                    "Keywords",
                    placeholder="keyword 1\nkeyword 2\nkeyword 3",
                    height=200,
                )

                submit = st.form_submit_button("Add Keywords", disabled=not can_edit)

                if submit and keywords_text:
                    keywords_list = [kw.strip() for kw in keywords_text.splitlines() if kw.strip()]

                    if keywords_list:
                        count = create_keywords_bulk(project_id, keywords_list)
                        st.success(f"Added {count} out of {len(keywords_list)} keywords")
                        st.rerun()

    with section_panel("Import/Export", "", "Import keywords from CSV or export a snapshot"):
        col1, col2 = st.columns(2)

        with col1:
            uploaded_file = st.file_uploader("Choose CSV file", type=["csv"], key="project_dashboard_upload", disabled=not can_edit)

            if uploaded_file:
                try:
                    df_import = pd.read_csv(uploaded_file)

                    if "keyword" not in df_import.columns:
                        st.error("CSV must have a 'keyword' column")
                    else:
                        keywords_to_import = df_import["keyword"].dropna().tolist()
                        st.write(f"Found {len(keywords_to_import)} keywords")

                        if st.button("Import Keywords", key="project_dashboard_import", disabled=not can_edit):
                            count = create_keywords_bulk(project_id, keywords_to_import)
                            st.success(f"Imported {count} keywords")
                            st.rerun()

                except Exception as exc:
                    st.error(f"Failed to read CSV: {exc}")

        with col2:
            if rankings_latest:
                export_data = []
                for row in rankings_latest:
                    export_data.append({
                        "keyword": row.get("keyword", ""),
                        "current_rank": row.get("position", ""),
                        "previous_rank": row.get("previous_position", ""),
                        "url_found": row.get("url_found", ""),
                        "last_checked": row.get("checked_at", ""),
                    })

                df_export = pd.DataFrame(export_data)
                csv_buffer = io.StringIO()
                df_export.to_csv(csv_buffer, index=False)

                st.download_button(
                    label="Download CSV",
                    data=csv_buffer.getvalue(),
                    file_name=f"{project['name']}_keywords.csv",
                    mime="text/csv",
                )
            else:
                render_info_box("No keywords to export", "info")

with tab_rank:
    with section_panel("Rank Check Setup", "", "Select API and estimate cost"):
        api_options = ["serper", "dataforseo", "scrapingrobot"]
        api_labels = {
            "serper": "Serper.dev",
            "dataforseo": "DataForSEO",
            "scrapingrobot": "ScrapingRobot",
        }

        default_api = get_setting("default_serp_api") or "serper"
        api_index = api_options.index(default_api) if default_api in api_options else 0

        api_col1, api_col2 = st.columns([2, 1], gap="medium")

        with api_col1:
            api_type = st.selectbox(
                "API Provider",
                options=api_options,
                index=api_index,
                format_func=lambda x: api_labels.get(x, x),
            )

            st.markdown("<div style='height: 0.35rem;'></div>", unsafe_allow_html=True)
            run_check = st.button("Run Rank Check", type="primary", use_container_width=True, disabled=not can_edit)

        with api_col2:
            estimate = estimate_check_cost(keyword_count, api_type)
            render_stat_card(
                "Estimated Cost",
                f"${estimate['total_cost']}",
                estimate["estimated_time_formatted"],
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
        elif not any(row.get("checked_at") for row in rankings_latest):
            render_info_box("Run a rank check before syncing to Google Sheets.", "warning")
        else:
            try:
                with st.spinner("Syncing to Google Sheets..."):
                    rankings_history = get_rankings_by_project(project_id, latest_only=False)
                    sync_rankings_to_sheet(
                        project["google_sheet_id"],
                        rankings_latest,
                        project_id,
                        rankings_history=rankings_history
                    )

                render_info_box("Synced rankings to Google Sheets.", "success")
            except Exception as exc:
                st.error(f"Sync failed: {exc}")

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
                    unsafe_allow_html=True,
                )

            with st.spinner("Running rank checks..."):
                result = check_project_rankings(
                    project_id=project_id,
                    api_type=api_type,
                    api_credentials=creds,
                    progress_callback=progress_callback,
                )

            progress_bar.empty()
            status_text.empty()

            if result.get("success"):
                render_info_box(
                    f"Checked {result['checked']} keywords. Success: {result['success']}, Errors: {result['errors']}",
                    "success",
                )
                st.rerun()
            else:
                st.error(result.get("error", "Rank check failed"))

    with section_panel("Recent Activity", "", "Latest rank check logs for this project"):
        logs = get_sync_logs(project_id=project_id, limit=15)

        if logs:
            for log in logs:
                status = log.get("status", "info")
                message = log.get("message", "")
                timestamp = log.get("created_at", "")
                render_info_box(
                    f"{timestamp} - {message}",
                    "info" if status == "success" else "warning",
                )
        else:
            render_info_box("No recent rank check logs for this project.", "info")

with tab_search:
    connection_status = test_gsc_connection()

    if not connection_status["success"]:
        render_info_box("Google Search Console not connected.", "warning")
        render_info_box(connection_status["message"], "info")
        if st.button("Open Settings", use_container_width=True):
            st.switch_page("pages/6_⚙️_Settings.py")
    else:
        with section_panel("Search Console Fetch", "", "Pull fresh queries for this project"):
            properties = list_gsc_properties()

            if not properties:
                render_info_box("No verified properties found.", "warning")
            else:
                default_property = project.get("gsc_property")
                if not default_property:
                    for prop in properties:
                        if project["url"] in prop or prop in project["url"]:
                            default_property = prop
                            break
                if not default_property:
                    default_property = properties[0]

                selected_property = default_property
                st.caption(f"Using property: {selected_property}")

                preset_options = {
                    "7 days": 7,
                    "14 days": 14,
                    "28 days": 28,
                    "3 months": 90,
                    "6 months": 180,
                    "12 months": 365,
                }

                selected_preset = st.selectbox(
                    "Timeframe",
                    options=list(preset_options.keys()),
                    index=2,
                )

                current_days = preset_options[selected_preset]
                end_date = datetime.now() - timedelta(days=3)
                start_date = end_date - timedelta(days=current_days)

                st.caption(f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

                if st.button("Fetch GSC Data", type="primary", use_container_width=True, disabled=not can_edit):
                    try:
                        with st.spinner("Fetching data..."):
                            queries = fetch_gsc_queries(
                                selected_property,
                                start_date.strftime("%Y-%m-%d"),
                                end_date.strftime("%Y-%m-%d"),
                                include_page=True,
                            )

                            clear_gsc_queries(project_id)
                            for query in queries:
                                create_gsc_query(
                                    project_id=project_id,
                                    query=query["query"],
                                    clicks=query["clicks"],
                                    impressions=query["impressions"],
                                    ctr=query["ctr"],
                                    position=query["position"],
                                    date_range_start=start_date.date(),
                                    date_range_end=end_date.date(),
                                    page_url=query.get("page"),
                                )

                        st.success(f"Fetched {len(queries)} queries from GSC")
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Fetch failed: {exc}")

    gsc_queries = get_stored_gsc_queries(project_id)

    with section_panel("GSC Summary", "", "Latest Search Console data stored for this project"):
            if not gsc_queries:
                render_info_box("No GSC data available yet. Fetch data to see insights.", "info")
            else:
                df_gsc = pd.DataFrame(gsc_queries)

                metric_col1, metric_col2, metric_col3, metric_col4 = st.columns(4)
                with metric_col1:
                    st.metric("Total Clicks", int(df_gsc["clicks"].sum()))
                with metric_col2:
                    st.metric("Total Impressions", int(df_gsc["impressions"].sum()))
                with metric_col3:
                    avg_ctr = (df_gsc["ctr"].mean() * 100) if not df_gsc.empty else 0
                    st.metric("Avg CTR", f"{avg_ctr:.2f}%")
                with metric_col4:
                    avg_pos = df_gsc["position"].mean() if not df_gsc.empty else 0
                    st.metric("Avg Position", f"{avg_pos:.1f}")

                display_df = df_gsc[["query", "clicks", "impressions", "ctr", "position"]].copy()
                display_df["ctr"] = (display_df["ctr"] * 100).round(2).astype(str) + "%"
                display_df["position"] = display_df["position"].round(1)
                display_df.columns = ["Query", "Clicks", "Impressions", "CTR", "Position"]

                st.dataframe(display_df.head(50), use_container_width=True, hide_index=True, height=420)

                new_discoveries = get_new_gsc_discoveries(project_id)
                st.metric("New Queries (not in keywords)", len(new_discoveries))

    with section_panel("Export to Google Sheets", "", "Push GSC queries and cannibalization reports to Sheets"):
        col_a, col_b = st.columns(2)
        with col_a:
            export_gsc = st.button("Sync GSC Queries", use_container_width=True)
        with col_b:
            export_cannibal = st.button("Sync Cannibalization", use_container_width=True)

        if export_gsc:
            if not project.get("google_sheet_id"):
                render_info_box("No Google Sheet linked to this project.", "warning")
            elif not gsc_queries:
                render_info_box("No GSC data available to export.", "info")
            else:
                try:
                    with st.spinner("Syncing GSC queries..."):
                        sync_gsc_to_sheet(project["google_sheet_id"], gsc_queries, project_id)
                    render_info_box("GSC queries synced to Google Sheets.", "success")
                except Exception as exc:
                    st.error(f"GSC sync failed: {exc}")

        if export_cannibal:
            if not project.get("google_sheet_id"):
                render_info_box("No Google Sheet linked to this project.", "warning")
            elif not gsc_queries:
                render_info_box("No GSC data available to analyze.", "info")
            else:
                try:
                    with st.spinner("Syncing cannibalization report..."):
                        cannibalization = detect_cannibalization([
                            {
                                "query": row.get("query"),
                                "clicks": row.get("clicks"),
                                "impressions": row.get("impressions"),
                                "ctr": row.get("ctr"),
                                "position": row.get("position"),
                                "page": row.get("page_url"),
                            }
                            for row in gsc_queries
                        ], threshold=2)

                        start_dates = [row.get("date_range_start") for row in gsc_queries if row.get("date_range_start")]
                        end_dates = [row.get("date_range_end") for row in gsc_queries if row.get("date_range_end")]
                        date_start = min(start_dates) if start_dates else ""
                        date_end = max(end_dates) if end_dates else ""

                        sync_cannibalization_to_sheet(
                            project["google_sheet_id"],
                            cannibalization,
                            date_start,
                            date_end,
                            project_id
                        )
                    render_info_box("Cannibalization report synced to Google Sheets.", "success")
                except Exception as exc:
                    st.error(f"Cannibalization sync failed: {exc}")

with tab_insights:
    gsc_queries = get_stored_gsc_queries(project_id)

    if not gsc_queries:
        render_info_box("No GSC data available. Fetch data first in the Search Console tab.", "info")
    else:
        current_data = []
        for row in gsc_queries:
            current_data.append({
                "query": row.get("query"),
                "clicks": row.get("clicks"),
                "impressions": row.get("impressions"),
                "ctr": row.get("ctr"),
                "position": row.get("position"),
                "page": row.get("page_url"),
            })

        opportunities = find_opportunities(current_data)
        cannibalization = detect_cannibalization(current_data, threshold=2)

        with section_panel("Opportunity Summary", "", "Quick wins and optimization targets"):
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                render_stat_card("Quick Wins", str(len(opportunities.get("quick_wins", []))), "Position 11-20")
            with col2:
                render_stat_card("Low Hanging", str(len(opportunities.get("low_hanging_fruit", []))), "Position 4-10")
            with col3:
                render_stat_card("Low CTR", str(len(opportunities.get("high_impressions_low_ctr", []))), "Improve clicks")
            with col4:
                render_stat_card("Poor Position", str(len(opportunities.get("high_impressions_poor_position", []))), "High impressions")

        with section_panel("Cannibalization", "", "Potential query cannibalization cases"):
            if cannibalization:
                cannibal_df = pd.DataFrame(cannibalization)
                cannibal_df = cannibal_df[["query", "num_pages", "total_clicks", "total_impressions"]]
                cannibal_df.columns = ["Query", "Pages", "Clicks", "Impressions"]
                st.dataframe(cannibal_df.head(30), use_container_width=True, hide_index=True, height=400)
            else:
                render_info_box("No cannibalization detected for this project.", "success")

        with section_panel("Open Detailed Analysis", "", "Jump to full analytics pages"):
            action_cols = st.columns(2)
            with action_cols[0]:
                if st.button("Open GSC Admin", use_container_width=True):
                    st.session_state.active_project_id = project_id
                    st.switch_page("pages/7_\U0001F50D_GSC_Admin.py")
            with action_cols[1]:
                if st.button("Open Cannibalization", use_container_width=True):
                    st.session_state.active_project_id = project_id
                    st.switch_page("pages/8_\u26A0\ufe0f_Keyword_Cannibalization.py")

with tab_cannibalization:
    gsc_queries = get_stored_gsc_queries(project_id)

    if not gsc_queries:
        render_info_box("No GSC data available. Fetch data first in the Search Console tab.", "info")
    else:
        current_data = []
        for row in gsc_queries:
            current_data.append({
                "query": row.get("query"),
                "clicks": row.get("clicks"),
                "impressions": row.get("impressions"),
                "ctr": row.get("ctr"),
                "position": row.get("position"),
                "page": row.get("page_url"),
            })

        cannibalization = detect_cannibalization(current_data, threshold=2)
        resolved_cases = get_resolved_cannibalization(project_id)
        resolved_keywords = {case["keyword"] for case in resolved_cases}
        active_cases = [case for case in cannibalization if case["query"] not in resolved_keywords]
        resolved_report = [case for case in cannibalization if case["query"] in resolved_keywords]
        limit_key = f"active_cases_limit_{project_id}"
        if limit_key not in st.session_state:
            st.session_state[limit_key] = 25

        with section_panel("Active Cases Summary", "", "Overall status for active cannibalization"):
            render_stat_card("Active Cases", str(len(active_cases)), "Current active cases")

        with section_panel("Active Keyword Cannibalization", "", "Queries with multiple ranking pages that are still active"):
            if not active_cases:
                render_info_box("No active cannibalization detected for this project.", "success")
            else:
                active_limit = st.session_state[limit_key]
                active_df = pd.DataFrame(active_cases[:active_limit])
                active_df = active_df[["query", "num_pages", "total_clicks", "total_impressions"]]
                active_df.columns = ["Query", "Pages", "Clicks", "Impressions"]
                st.dataframe(active_df, use_container_width=True, hide_index=True, height=320)
                st.caption(f"Showing {min(len(active_cases), active_limit)} of {len(active_cases)} active cases")

                for case in active_cases[:active_limit]:
                    pages = case.get("pages", [])
                    if not pages:
                        continue
                    pages_df = pd.DataFrame(pages)
                    pages_df["ctr"] = (pages_df["ctr"] * 100).round(2).astype(str) + "%"
                    pages_df["position"] = pages_df["position"].round(1)
                    pages_df.columns = ["Page", "Position", "Clicks", "Impressions", "CTR"]

                    with st.expander(
                        f"{case['query']} ({case['num_pages']} pages) - {case['total_clicks']} clicks, {case['total_impressions']:,} impressions"
                    ):
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("Pages Ranking", case["num_pages"])
                        with col2:
                            st.metric("Best Position", f"{case['best_position']:.1f}")
                        with col3:
                            st.metric("Worst Position", f"{case['worst_position']:.1f}")
                        st.dataframe(pages_df, use_container_width=True, hide_index=True)
                        st.info(
                            "Recommendation: consolidate content to the best-performing page and redirect competing pages."
                        )

                if active_limit < len(active_cases):
                    if st.button("Load more", key=f"load_more_active_{project_id}", use_container_width=True):
                        st.session_state[limit_key] = min(active_limit + 25, len(active_cases))
                        st.rerun()

        with section_panel("Resolved Cases", "", "Previously resolved cannibalization cases"):
            if not resolved_report:
                render_info_box("No resolved cases yet for this project.", "info")
            else:
                resolved_df = pd.DataFrame(resolved_report)
                resolved_df = resolved_df[["query", "num_pages", "total_clicks", "total_impressions"]]
                resolved_df.columns = ["Query", "Pages", "Clicks", "Impressions"]
                st.dataframe(resolved_df, use_container_width=True, hide_index=True, height=320)
                st.metric("Resolved Cases", len(resolved_report))

                for case in resolved_report:
                    resolution_info = next(
                        (r for r in resolved_cases if r["keyword"] == case["query"]),
                        None
                    )
                    pages = case.get("pages", [])
                    if not pages:
                        continue
                    pages_df = pd.DataFrame(pages)
                    pages_df["ctr"] = (pages_df["ctr"] * 100).round(2).astype(str) + "%"
                    pages_df["position"] = pages_df["position"].round(1)
                    pages_df.columns = ["Page", "Position", "Clicks", "Impressions", "CTR"]

                    resolved_label = resolution_info["resolved_date"] if resolution_info else "Unknown"
                    with st.expander(
                        f"{case['query']} ({case['num_pages']} pages) - Resolved on {resolved_label}"
                    ):
                        if resolution_info and resolution_info.get("notes"):
                            st.caption(f"Notes: {resolution_info['notes']}")
                        st.dataframe(pages_df, use_container_width=True, hide_index=True)

with tab_settings:
    with section_panel("Edit Project", "", "Update project settings and status"):
        with st.form("project_settings_form"):
            col1, col2, col3 = st.columns(3)

            with col1:
                new_name = st.text_input("Name", value=project["name"])
                new_url = st.text_input("URL", value=project["url"])

            with col2:
                new_location = st.text_input("Location", value=project["target_location"])
                new_frequency = st.selectbox(
                    "Frequency",
                    options=["daily", "weekly", "monthly"],
                    index=["daily", "weekly", "monthly"].index(project.get("update_frequency", "monthly")),
                )

            with col3:
                new_gsc_property = st.text_input(
                    "GSC Property",
                    value=project.get("gsc_property", "") or "",
                    placeholder="https://example.com",
                )
                new_active = st.checkbox("Active", value=project.get("is_active", True))

            col_a, col_b = st.columns(2)
            with col_a:
                submit = st.form_submit_button("Save", type="primary", use_container_width=True, disabled=not can_edit)
            with col_b:
                cancel = st.form_submit_button("Cancel", type="secondary", use_container_width=True)

            if submit:
                update_project(
                    project_id,
                    name=new_name,
                    url=new_url,
                    target_location=new_location,
                    update_frequency=new_frequency,
                    gsc_property=new_gsc_property if new_gsc_property else None,
                    is_active=new_active,
                )
                st.success("Project updated")
                st.rerun()

            if cancel:
                st.rerun()

render_app_footer()
