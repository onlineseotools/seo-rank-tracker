"""Search Console page - GSC integration"""
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
    render_sidebar_projects, render_app_footer, resolve_project_selection
)
from database.models import (
    create_gsc_query,
    clear_gsc_queries, get_gsc_queries, get_new_gsc_discoveries,
    create_keywords_bulk
)
from services.search_console import (
    get_gsc_queries as fetch_gsc_queries,
    test_gsc_connection,
    list_gsc_properties
)
from components.charts import create_gsc_opportunities_chart


st.set_page_config(page_title="Search Console", page_icon="S", layout="wide", initial_sidebar_state="expanded")

require_authentication()

load_custom_css()

render_sidebar_projects(active_only=False)

current_user = get_current_user()
action = render_header_with_subtitle(
    "Google Search Console",
    "View GSC data and discover new keyword opportunities",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="search_console"
)
handle_user_menu(action)

connection_status = test_gsc_connection()

if not connection_status['success']:
    st.error("Google Search Console not connected")
    st.info(connection_status['message'])
    st.info("Connect your Google account in Settings > Search Console")
    st.stop()

st.markdown(
    "<div class='notice-pill notice-pill--success'>Connected to Google Search Console</div>",
    unsafe_allow_html=True
)

projects = get_accessible_projects()

if not projects:
    st.warning("No projects found. Please create a project first.")
    st.stop()

selected_project_id = st.session_state.pop("active_project_id", None)
(
    project_groups,
    sorted_base_urls,
    default_base_url,
    default_variant_name,
    _
) = resolve_project_selection(projects, selected_project_id)

with section_panel("Configuration", "", "Select a project and Search Console property"):
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
                st.warning("No verified properties found.")
                st.stop()

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
            st.error(f"Error: {str(e)}")
            st.stop()

with section_panel("Date Range & Actions", "", "Choose a timeframe and fetch data"):
    range_col1, range_col2, range_col3 = st.columns([1, 1, 1], gap="medium")

    with range_col1:
        st.markdown("<div class='section-title'>Timeframe</div>", unsafe_allow_html=True)

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
            "Period",
            options=list(preset_options.keys()),
            index=2,
            label_visibility="visible"
        )

        days = preset_options[selected_preset]
        end_date = datetime.now() - timedelta(days=3)
        start_date = end_date - timedelta(days=days)

        st.caption(f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

    with range_col2:
        st.markdown("<div class='section-title'>Selected</div>", unsafe_allow_html=True)
        st.markdown(f"<div class='card-title'>{project['name']}</div>", unsafe_allow_html=True)
        st.markdown(f"<div class='card-subtitle'>Location: {project['target_location']}</div>", unsafe_allow_html=True)
        st.markdown(f"<div class='card-subtitle'>Timeframe: {days} days</div>", unsafe_allow_html=True)

    with range_col3:
        st.markdown("<div class='section-title'>Actions</div>", unsafe_allow_html=True)
        action_col1, action_col2 = st.columns(2, gap="small", vertical_alignment="top")
        with action_col1:
            fetch_button = st.button("Fetch & Analyze", type="primary", use_container_width=True, disabled=not can_edit)
        with action_col2:
            reset_button = st.button("Reset Data", type="secondary", use_container_width=True, disabled=not can_edit)

if reset_button:
    clear_gsc_queries(project_id)
    st.success("GSC data cleared for this project")
    st.rerun()

if fetch_button:
    try:
        with st.spinner("Fetching data from Google Search Console..."):
            queries = fetch_gsc_queries(
                selected_property,
                start_date.strftime("%Y-%m-%d"),
                end_date.strftime("%Y-%m-%d")
            )

            clear_gsc_queries(project_id)

            for query in queries:
                create_gsc_query(
                    project_id=project_id,
                    query=query['query'],
                    clicks=query['clicks'],
                    impressions=query['impressions'],
                    ctr=query['ctr'],
                    position=query['position'],
                    date_range_start=start_date.date() if isinstance(start_date, datetime) else start_date,
                    date_range_end=end_date.date() if isinstance(end_date, datetime) else end_date
                )

            st.success(f"Fetched {len(queries)} queries from GSC")
            st.rerun()

    except Exception as e:
        st.error(f"Failed to fetch GSC data: {str(e)}")

st.divider()

tab1, tab2, tab3, tab4 = st.tabs([
    "All Queries",
    "New Discoveries",
    "Opportunities",
    "Top Performers"
])

gsc_queries = get_gsc_queries(project_id)

if not gsc_queries:
    with tab1:
        st.info("No GSC data available. Click 'Fetch & Analyze' to load queries from Google Search Console.")
else:
    df_gsc = pd.DataFrame(gsc_queries)

    with tab1:
        st.subheader("All Search Queries")

        display_df = df_gsc[[
            'query', 'clicks', 'impressions', 'ctr', 'position'
        ]].copy()

        display_df['ctr'] = (display_df['ctr'] * 100).round(2).astype(str) + '%'
        display_df['position'] = display_df['position'].round(1)

        display_df.columns = ['Query', 'Clicks', 'Impressions', 'CTR', 'Avg Position']

        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True,
            height=500
        )

        st.write(f"Total Queries: {len(gsc_queries)}")

    with tab2:
        st.subheader("New Discoveries")
        st.write("Queries getting traffic but NOT in your keyword list")

        new_discoveries = get_new_gsc_discoveries(project_id)

        if not new_discoveries:
            st.info("No new discoveries found. All GSC queries are already in your keyword list.")
        else:
            st.write(f"Found {len(new_discoveries)} new opportunities")

            df_discoveries = pd.DataFrame(new_discoveries)
            display_df = df_discoveries[[
                'query', 'clicks', 'impressions', 'ctr', 'position'
            ]].copy()

            display_df['ctr'] = (display_df['ctr'] * 100).round(2).astype(str) + '%'
            display_df['position'] = display_df['position'].round(1)

            display_df.columns = ['Query', 'Clicks', 'Impressions', 'CTR', 'Avg Position']

            st.dataframe(
                display_df,
                use_container_width=True,
                hide_index=True,
                height=400
            )

            st.divider()

            queries_to_add = st.multiselect(
                "Select queries to add to keyword list",
                options=[d['query'] for d in new_discoveries],
                default=[d['query'] for d in new_discoveries[:5]]
            )

            if queries_to_add:
                if st.button("Add Selected to Keywords", disabled=not can_edit):
                    count = create_keywords_bulk(project_id, queries_to_add)
                    st.success(f"Added {count} keywords to the project")
                    st.rerun()

    with tab3:
        st.subheader("Optimization Opportunities")
        st.write("Queries with high impressions but low CTR or poor position")

        df_opportunities = df_gsc[
            ((df_gsc['ctr'] < 0.02) & (df_gsc['impressions'] > 10)) |
            ((df_gsc['position'] > 10) & (df_gsc['impressions'] > 10))
        ].copy()

        if df_opportunities.empty:
            st.info("No major optimization opportunities found.")
        else:
            st.write(f"Found {len(df_opportunities)} opportunities")

            display_df = df_opportunities[[
                'query', 'clicks', 'impressions', 'ctr', 'position'
            ]].copy()

            display_df['ctr'] = (display_df['ctr'] * 100).round(2).astype(str) + '%'
            display_df['position'] = display_df['position'].round(1)

            display_df.columns = ['Query', 'Clicks', 'Impressions', 'CTR', 'Avg Position']

            st.dataframe(
                display_df,
                use_container_width=True,
                hide_index=True,
                height=400
            )

            if len(df_opportunities) > 0:
                fig = create_gsc_opportunities_chart(df_opportunities)
                st.plotly_chart(fig, use_container_width=True)

    with tab4:
        st.subheader("Top Performing Queries")

        df_top = df_gsc.nlargest(50, 'clicks').copy()

        display_df = df_top[[
            'query', 'clicks', 'impressions', 'ctr', 'position'
        ]].copy()

        display_df['ctr'] = (display_df['ctr'] * 100).round(2).astype(str) + '%'
        display_df['position'] = display_df['position'].round(1)

        display_df.columns = ['Query', 'Clicks', 'Impressions', 'CTR', 'Avg Position']

        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True,
            height=500
        )

        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric("Total Clicks", int(df_gsc['clicks'].sum()))

        with col2:
            st.metric("Total Impressions", int(df_gsc['impressions'].sum()))

        with col3:
            avg_ctr = (df_gsc['ctr'].mean() * 100)
            st.metric("Avg CTR", f"{avg_ctr:.2f}%")

render_app_footer()
