"""GSC Admin - Comprehensive Google Search Console Analytics"""
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
    create_gsc_query,
    clear_gsc_queries, get_gsc_queries
)
from services.search_console import (
    get_gsc_queries as fetch_gsc_queries,
    test_gsc_connection,
    list_gsc_properties
)
from services.gsc_analytics import (
    compare_query_periods,
    detect_cannibalization,
    group_related_queries,
    analyze_page_performance,
    find_opportunities,
    calculate_visibility_score
)


st.set_page_config(page_title="GSC Admin", page_icon="G", layout="wide", initial_sidebar_state="expanded")

require_authentication()

load_custom_css()

render_sidebar_projects(active_only=False)


def stop_with_footer(message: str = None, level: str = "info"):
    if message:
        if level == "error":
            st.error(message)
        elif level == "warning":
            st.warning(message)
        else:
            st.info(message)
    render_app_footer()
    st.stop()

current_user = get_current_user()
action = render_header_with_subtitle(
    "GSC Admin",
    "Comprehensive Google Search Console analytics and insights",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="gsc_admin"
)
handle_user_menu(action)

connection_status = test_gsc_connection()

if not connection_status['success']:
    st.error("Google Search Console not connected")
    st.info(connection_status['message'])
    stop_with_footer("Connect your Google account in Settings > Search Console", "info")

st.markdown(
    "<div class='notice-pill notice-pill--success'>Connected to Google Search Console</div>",
    unsafe_allow_html=True
)

with section_panel("Configuration", "", "Select a project and Search Console property"):
    projects = get_accessible_projects()

    if not projects:
        stop_with_footer("No projects found.", "warning")

    selected_project_id = st.session_state.pop("active_project_id", None)
    (
        project_groups,
        sorted_base_urls,
        default_base_url,
        default_variant_name,
        _
    ) = resolve_project_selection(projects, selected_project_id)

    config_col1, config_col2 = st.columns([1, 1], gap="medium")

    with config_col1:
        st.markdown("<div class='section-title'>Project Selection</div>", unsafe_allow_html=True)

        selected_base_url = st.selectbox(
            "Website",
            options=sorted_base_urls,
            index=sorted_base_urls.index(default_base_url) if default_base_url in sorted_base_urls else 0,
            help="Choose the main website/domain",
            label_visibility="visible"
        )

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

    with config_col2:
        st.markdown("<div class='section-title'>GSC Property</div>", unsafe_allow_html=True)

        try:
            properties = list_gsc_properties()

            if not properties:
                stop_with_footer("No verified properties found.", "warning")

            default_property = project.get('gsc_property')

            if not default_property:
                for prop in properties:
                    if selected_base_url in prop or prop in selected_base_url:
                        default_property = prop
                        break

            if not default_property:
                default_property = properties[0]

            selected_property = st.selectbox(
                "Property",
                options=properties,
                index=properties.index(default_property) if default_property in properties else 0,
                help="Select the Search Console property",
                label_visibility="visible"
            )

            manual_override = st.checkbox(
                "Manual Override",
                help="Enter custom property URL"
            )

            if manual_override:
                custom_property = st.text_input(
                    "Custom URL",
                    value=selected_property,
                    placeholder="https://example.com",
                    help="Enter exact property URL",
                    label_visibility="visible"
                )
                selected_property = custom_property

            st.caption(f"Using property: {selected_property}")

        except Exception as e:
            stop_with_footer(f"Error: {str(e)}", "error")

with section_panel("Analysis Configuration", "", "Choose timeframes and actions"):
    range_col1, range_col2 = st.columns(2, gap="large", vertical_alignment="top")

    with range_col1:
        st.markdown("<div class='section-title'>Current Period</div>", unsafe_allow_html=True)

        preset_options = {
            "7 days": 7,
            "14 days": 14,
            "28 days": 28,
            "3 months": 90,
            "6 months": 180,
            "12 months": 365,
            "16 months": 480
        }

        selected_preset = st.selectbox(
            "Timeframe",
            options=list(preset_options.keys()),
            index=2,
            label_visibility="visible"
        )

        current_days = preset_options[selected_preset]
        current_end = datetime.now() - timedelta(days=3)
        current_start = current_end - timedelta(days=current_days)

        st.caption(f"{current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')}")

    with range_col2:
        st.markdown("<div class='section-title'>Compare Period</div>", unsafe_allow_html=True)

        previous_end = current_start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=current_days)

        st.caption(f"{previous_start.strftime('%Y-%m-%d')} to {previous_end.strftime('%Y-%m-%d')}")
        st.caption("Auto-calculated for comparison")

    st.markdown("<div class='section-title' style='margin-top: 0.8rem;'>Actions</div>", unsafe_allow_html=True)
    action_col1, action_col2 = st.columns(2, gap="small", vertical_alignment="top")
    with action_col1:
        fetch_button = st.button(
            "Fetch & Analyze",
            type="primary",
            use_container_width=True,
            key="gsc_admin_fetch",
            disabled=not can_edit
        )
    with action_col2:
        reset_button = st.button(
            "Reset Data",
            type="secondary",
            use_container_width=True,
            key="gsc_admin_reset",
            disabled=not can_edit
        )

if reset_button:
    clear_gsc_queries(project_id)
    st.session_state['gsc_fetched'] = False
    st.success("GSC data cleared")
    st.rerun()

if fetch_button:
    with st.spinner("Fetching data from Google Search Console..."):
        try:
            current_data = fetch_gsc_queries(
                selected_property,
                current_start.strftime("%Y-%m-%d"),
                current_end.strftime("%Y-%m-%d"),
                include_page=True
            )

            previous_data = fetch_gsc_queries(
                selected_property,
                previous_start.strftime("%Y-%m-%d"),
                previous_end.strftime("%Y-%m-%d"),
                include_page=False
            )

            clear_gsc_queries(project_id)

            for query in current_data:
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

            st.session_state['current_gsc_data'] = current_data
            st.session_state['previous_gsc_data'] = previous_data
            st.session_state['gsc_fetched'] = True

            st.success(f"Fetched {len(current_data)} query-page combinations")
            st.rerun()

        except Exception as e:
            st.error(f"Error fetching data: {str(e)}")

st.divider()

if not st.session_state.get('gsc_fetched', False):
    render_info_box("Click 'Fetch & Analyze' to load analytics", "info")
    render_app_footer()
    st.stop()

current_data = st.session_state.get('current_gsc_data', [])
previous_data = st.session_state.get('previous_gsc_data', [])

if not current_data:
    stop_with_footer("No data available", "warning")

total_clicks = sum(q['clicks'] for q in current_data)
total_impressions = sum(q['impressions'] for q in current_data)
avg_ctr = total_clicks / total_impressions if total_impressions > 0 else 0
avg_position = sum(q['position'] * q['impressions'] for q in current_data) / total_impressions if total_impressions > 0 else 0
visibility_score = calculate_visibility_score(current_data)

with section_panel("Overview Metrics", "", "Search visibility summary"):
    col1, col2, col3, col4, col5 = st.columns(5)

    with col1:
        st.metric("Total Clicks", f"{total_clicks:,}")

    with col2:
        st.metric("Total Impressions", f"{total_impressions:,}")

    with col3:
        st.metric("Avg CTR", f"{avg_ctr*100:.2f}%")

    with col4:
        st.metric("Avg Position", f"{avg_position:.1f}")

    with col5:
        st.metric("Visibility Score", f"{visibility_score:.1f}/100")

st.divider()

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "New & Lost Queries",
    "Cannibalization",
    "Query Groups",
    "Page Analysis",
    "Opportunities",
    "All Queries"
])

with tab1:
    st.subheader("Query Changes Between Periods")

    comparison = compare_query_periods(current_data, previous_data)

    col1, col2 = st.columns(2)

    with col1:
        st.write("New Queries")
        st.caption("Queries ranking in current period but not in previous")

        new_queries = comparison['new_queries']

        if new_queries:
            df_new = pd.DataFrame(new_queries)
            df_new = df_new[['query', 'position', 'clicks', 'impressions', 'ctr']]
            df_new['ctr'] = (df_new['ctr'] * 100).round(2).astype(str) + '%'
            df_new['position'] = df_new['position'].round(1)
            df_new.columns = ['Query', 'Position', 'Clicks', 'Impressions', 'CTR']

            st.dataframe(df_new, use_container_width=True, hide_index=True)
            st.metric("New Queries", len(new_queries))
        else:
            st.info("No new queries found")

    with col2:
        st.write("Lost Queries")
        st.caption("Queries that disappeared from current period")

        lost_queries = comparison['lost_queries']

        if lost_queries:
            df_lost = pd.DataFrame(lost_queries)
            df_lost = df_lost[['query', 'position', 'clicks', 'impressions', 'ctr']]
            df_lost['ctr'] = (df_lost['ctr'] * 100).round(2).astype(str) + '%'
            df_lost['position'] = df_lost['position'].round(1)
            df_lost.columns = ['Query', 'Position', 'Clicks', 'Impressions', 'CTR']

            st.dataframe(df_lost, use_container_width=True, hide_index=True)
            st.metric("Lost Queries", len(lost_queries))
        else:
            st.info("No lost queries")

    st.divider()

    col1, col2 = st.columns(2)

    with col1:
        st.write("Most Improved")
        improved = comparison['improved_queries'][:20]

        if improved:
            df_improved = pd.DataFrame(improved)
            df_improved = df_improved[[
                'query', 'current_position', 'previous_position', 'position_change', 'current_clicks'
            ]]
            df_improved['position_change'] = df_improved['position_change'].round(1)
            df_improved.columns = ['Query', 'Current Pos', 'Previous Pos', 'Change', 'Clicks']

            st.dataframe(df_improved, use_container_width=True, hide_index=True)
        else:
            st.info("No significant improvements")

    with col2:
        st.write("Most Declined")
        declined = comparison['declined_queries'][:20]

        if declined:
            df_declined = pd.DataFrame(declined)
            df_declined = df_declined[[
                'query', 'current_position', 'previous_position', 'position_change', 'current_clicks'
            ]]
            df_declined['position_change'] = df_declined['position_change'].round(1)
            df_declined.columns = ['Query', 'Current Pos', 'Previous Pos', 'Change', 'Clicks']

            st.dataframe(df_declined, use_container_width=True, hide_index=True)
        else:
            st.info("No significant declines")

with tab2:
    st.subheader("Keyword Cannibalization Detection")
    st.caption("Multiple pages ranking for the same query")

    cannibalization = detect_cannibalization(current_data, threshold=2)

    if cannibalization:
        st.warning(f"Found {len(cannibalization)} queries with multiple ranking pages")

        for case in cannibalization[:50]:
            with st.expander(
                f"{case['query']} ({case['num_pages']} pages) - "
                f"{case['total_clicks']} clicks, {case['total_impressions']} impressions"
            ):
                st.write(f"Best Position: {case['best_position']:.1f}")
                st.write(f"Worst Position: {case['worst_position']:.1f}")
                st.write(f"Primary Page: {case['primary_page']}")

                df_pages = pd.DataFrame(case['pages'])
                df_pages['ctr'] = (df_pages['ctr'] * 100).round(2).astype(str) + '%'
                df_pages['position'] = df_pages['position'].round(1)
                df_pages.columns = ['Page', 'Position', 'Clicks', 'Impressions', 'CTR']

                st.dataframe(df_pages, use_container_width=True, hide_index=True)

                st.warning(
                    "Recommendation: consolidate content and redirect competing pages."
                )
    else:
        st.success("No significant cannibalization detected")

with tab3:
    st.subheader("Related Query Grouping")
    st.caption("Queries grouped by keyword similarity")

    query_groups = group_related_queries(current_data, similarity_threshold=0.5)

    st.info(f"Found {len(query_groups)} query groups")

    for group in query_groups[:30]:
        with st.expander(
            f"{group['primary_query']} ({group['query_count']} queries) - "
            f"{group['total_clicks']} clicks, {group['total_impressions']:,} impressions"
        ):
            col1, col2, col3 = st.columns(3)

            with col1:
                st.metric("Avg Position", f"{group['avg_position']:.1f}")

            with col2:
                st.metric("Avg CTR", f"{group['avg_ctr']*100:.2f}%")

            with col3:
                st.metric("Total Queries", group['query_count'])

            st.write("Keywords:", ", ".join(group['keywords']))

            df_group = pd.DataFrame(group['queries'])
            df_group = df_group[['query', 'position', 'clicks', 'impressions']]
            df_group['position'] = df_group['position'].round(1)
            df_group.columns = ['Query', 'Position', 'Clicks', 'Impressions']

            st.dataframe(df_group, use_container_width=True, hide_index=True, height=200)

with tab4:
    st.subheader("Page-wise Performance Analysis")
    st.caption("Which pages rank for which queries")

    page_analysis = analyze_page_performance(current_data)

    st.info(f"Analyzing {len(page_analysis)} pages")

    for page_data in page_analysis[:50]:
        with st.expander(
            f"{page_data['page']} - {page_data['query_count']} queries, "
            f"{page_data['total_clicks']} clicks"
        ):
            col1, col2, col3, col4 = st.columns(4)

            with col1:
                st.metric("Queries", page_data['query_count'])

            with col2:
                st.metric("Total Clicks", page_data['total_clicks'])

            with col3:
                st.metric("Avg Position", f"{page_data['avg_position']:.1f}")

            with col4:
                st.metric("Avg CTR", f"{page_data['avg_ctr']*100:.2f}%")

            df_queries = pd.DataFrame(page_data['top_queries'])
            df_queries = df_queries[['query', 'position', 'clicks', 'impressions', 'ctr']]
            df_queries['ctr'] = (df_queries['ctr'] * 100).round(2).astype(str) + '%'
            df_queries['position'] = df_queries['position'].round(1)
            df_queries.columns = ['Query', 'Position', 'Clicks', 'Impressions', 'CTR']

            st.dataframe(df_queries, use_container_width=True, hide_index=True)

with tab5:
    st.subheader("Optimization Opportunities")

    opportunities = find_opportunities(current_data)

    col1, col2 = st.columns(2)

    with col1:
        st.write("Quick Wins (Position 11-20)")
        st.caption("High impressions, just outside top 10")

        quick_wins = opportunities['quick_wins'][:20]

        if quick_wins:
            df_qw = pd.DataFrame(quick_wins)
            df_qw = df_qw[['query', 'position', 'impressions', 'clicks', 'ctr']]
            df_qw['ctr'] = (df_qw['ctr'] * 100).round(2).astype(str) + '%'
            df_qw['position'] = df_qw['position'].round(1)
            df_qw.columns = ['Query', 'Position', 'Impressions', 'Clicks', 'CTR']

            st.dataframe(df_qw, use_container_width=True, hide_index=True)
        else:
            st.info("No quick wins found")

    with col2:
        st.write("Low Hanging Fruit (Position 4-10)")
        st.caption("Already in top 10, optimize for top 3")

        low_hanging = opportunities['low_hanging_fruit'][:20]

        if low_hanging:
            df_lh = pd.DataFrame(low_hanging)
            df_lh = df_lh[['query', 'position', 'impressions', 'clicks', 'ctr']]
            df_lh['ctr'] = (df_lh['ctr'] * 100).round(2).astype(str) + '%'
            df_lh['position'] = df_lh['position'].round(1)
            df_lh.columns = ['Query', 'Position', 'Impressions', 'Clicks', 'CTR']

            st.dataframe(df_lh, use_container_width=True, hide_index=True)
        else:
            st.info("No low hanging fruit")

    st.divider()

    col1, col2 = st.columns(2)

    with col1:
        st.write("High Impressions, Low CTR")
        st.caption("Good visibility but poor click-through")

        low_ctr = opportunities['high_impressions_low_ctr'][:20]

        if low_ctr:
            df_ctr = pd.DataFrame(low_ctr)
            df_ctr = df_ctr[['query', 'position', 'impressions', 'clicks', 'ctr']]
            df_ctr['ctr'] = (df_ctr['ctr'] * 100).round(2).astype(str) + '%'
            df_ctr['position'] = df_ctr['position'].round(1)
            df_ctr.columns = ['Query', 'Position', 'Impressions', 'Clicks', 'CTR']

            st.dataframe(df_ctr, use_container_width=True, hide_index=True)

            st.info("Optimize title tags and meta descriptions")
        else:
            st.info("No low CTR issues")

    with col2:
        st.write("High Impressions, Poor Position")
        st.caption("Lots of views but ranking too low")

        poor_pos = opportunities['high_impressions_poor_position'][:20]

        if poor_pos:
            df_pos = pd.DataFrame(poor_pos)
            df_pos = df_pos[['query', 'position', 'impressions', 'clicks', 'ctr']]
            df_pos['ctr'] = (df_pos['ctr'] * 100).round(2).astype(str) + '%'
            df_pos['position'] = df_pos['position'].round(1)
            df_pos.columns = ['Query', 'Position', 'Impressions', 'Clicks', 'CTR']

            st.dataframe(df_pos, use_container_width=True, hide_index=True)

            st.info("Create better content or build more backlinks")
        else:
            st.info("No poor position issues")

with tab6:
    st.subheader("All Queries")
    st.caption("Complete query list with all metrics")

    query_aggregated = {}

    for item in current_data:
        query = item['query']

        if query not in query_aggregated:
            query_aggregated[query] = {
                'query': query,
                'clicks': 0,
                'impressions': 0,
                'positions': [],
                'pages': set()
            }

        query_aggregated[query]['clicks'] += item['clicks']
        query_aggregated[query]['impressions'] += item['impressions']
        query_aggregated[query]['positions'].append(item['position'])
        if item.get('page'):
            query_aggregated[query]['pages'].add(item.get('page'))

    all_queries_list = []
    for query, data in query_aggregated.items():
        avg_pos = sum(data['positions']) / len(data['positions'])
        ctr = data['clicks'] / data['impressions'] if data['impressions'] > 0 else 0

        all_queries_list.append({
            'Query': query,
            'Clicks': data['clicks'],
            'Impressions': data['impressions'],
            'CTR': f"{ctr*100:.2f}%",
            'Avg Position': round(avg_pos, 1),
            'Pages': len(data['pages'])
        })

    df_all = pd.DataFrame(all_queries_list)
    df_all = df_all.sort_values('Clicks', ascending=False)

    st.dataframe(df_all, use_container_width=True, hide_index=True, height=600)

    st.metric("Total Unique Queries", len(all_queries_list))

render_app_footer()
st.markdown("<!-- footer-spacer -->", unsafe_allow_html=True)
