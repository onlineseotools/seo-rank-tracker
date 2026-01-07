"""Dashboard page - Overview metrics and charts"""
import streamlit as st
import pandas as pd
from collections import defaultdict
from components.auth import require_authentication, get_current_user, handle_user_menu, get_accessible_projects
from components.modern_ui import (
    load_custom_css, render_header_with_subtitle, section_panel,
    render_stat_card, render_metric_card, render_info_box,
    render_sidebar_projects, render_app_footer, resolve_project_selection
)
from database.models import (
    get_project_stats, get_rankings_by_project,
    get_top_movers
)
from components.charts import (
    create_ranking_distribution_chart, create_trend_line_chart
)
from components.tables import display_top_movers_table


st.set_page_config(page_title="Dashboard", page_icon="D", layout="wide", initial_sidebar_state="expanded")

require_authentication()

load_custom_css()

render_sidebar_projects(active_only=False)

current_user = get_current_user()
action = render_header_with_subtitle(
    "Dashboard",
    "Overview of your SEO performance and ranking trends",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="dashboard"
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
            help="Choose the main website/domain",
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
            help="Choose the specific location or variant",
            label_visibility="visible"
        )

        project = variant_options[selected_variant_name]
        project_id = project['id']

    st.markdown(
        f"<span class='badge badge-success'>{project['name']} - {project['target_location']}</span>",
        unsafe_allow_html=True
    )

stats = get_project_stats(project_id)
rankings = get_rankings_by_project(project_id, latest_only=True)

with section_panel("Overview", "", "Snapshot of your current ranking performance"):
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        render_stat_card(
            "Total Keywords",
            str(stats.get('total_keywords', 0)),
            "Active keywords"
        )

    with col2:
        avg_pos = stats.get('average_position')
        render_stat_card(
            "Avg Position",
            f"{avg_pos:.1f}" if avg_pos else "N/A",
            "Across all keywords"
        )

    with col3:
        top_10_count = stats.get('top_10_count', 0)
        render_stat_card(
            "Top 10 Rankings",
            str(top_10_count),
            f"{(top_10_count/stats.get('total_keywords', 1)*100):.0f}% of keywords" if stats.get('total_keywords', 0) > 0 else "0%"
        )

    with col4:
        improved = stats.get('improved_count', 0)
        declined = stats.get('declined_count', 0)
        render_stat_card(
            "Movers",
            f"+{improved} / -{declined}",
            "Since last check"
        )

with section_panel("Performance Charts", "", "Visual analysis of your ranking data"):
    if not rankings:
        render_info_box(
            "No ranking data available yet. Use the Rank Checker to start tracking your keywords!",
            "info"
        )
    else:
        col_left, col_right = st.columns(2)

        with col_left:
            st.markdown("<div class='card-title'>Ranking Distribution</div>", unsafe_allow_html=True)
            fig_dist = create_ranking_distribution_chart(rankings)
            st.plotly_chart(fig_dist, use_container_width=True)

        with col_right:
            st.markdown("<div class='card-title'>Position Trend</div>", unsafe_allow_html=True)
            all_rankings = get_rankings_by_project(project_id, latest_only=False)
            df_rankings = pd.DataFrame([
                {
                    'checked_at': r['checked_at'],
                    'position': r['position']
                }
                for r in all_rankings if r.get('checked_at') and r.get('position')
            ])

            if not df_rankings.empty:
                fig_trend = create_trend_line_chart(df_rankings)
                st.plotly_chart(fig_trend, use_container_width=True)
            else:
                render_info_box("No trend data available yet", "info")

with section_panel("Top Movers", "", "Keywords with the biggest ranking changes"):
    top_movers = get_top_movers(project_id, limit=15)

    if top_movers:
        improved = [m for m in top_movers if m.get('change', 0) > 0]
        declined = [m for m in top_movers if m.get('change', 0) < 0]

        col1, col2, col3 = st.columns(3)

        with col1:
            render_metric_card(
                "Total Changes",
                str(len(top_movers)),
                color="info"
            )

        with col2:
            render_metric_card(
                "Improved",
                str(len(improved)),
                color="success"
            )

        with col3:
            render_metric_card(
                "Declined",
                str(len(declined)),
                color="danger"
            )

        tab1, tab2, tab3 = st.tabs(["All Changes", "Improved", "Declined"])

        with tab1:
            display_top_movers_table(top_movers)

        with tab2:
            if improved:
                display_top_movers_table(improved)
            else:
                render_info_box("No improved rankings in this period", "info")

        with tab3:
            if declined:
                display_top_movers_table(declined)
            else:
                render_info_box("No declined rankings in this period", "info")
    else:
        render_info_box(
            "No ranking changes found yet. Rankings need at least two checks to show movement.",
            "info"
        )

render_app_footer()
