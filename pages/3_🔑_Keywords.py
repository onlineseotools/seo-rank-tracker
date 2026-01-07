"""Keywords page - Manage keywords"""
import streamlit as st
import pandas as pd
import io
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
    sub_panel, resolve_project_selection
)
from database.models import (
    get_keywords_by_project, create_keywords_bulk,
    delete_keywords_bulk, get_rankings_by_project, get_best_rank
)
from services.google_sheets import sync_rankings_to_sheet


st.set_page_config(page_title="Keywords", page_icon="Keywords", layout="wide", initial_sidebar_state="expanded")

require_authentication()

load_custom_css()

render_sidebar_projects(active_only=False)

current_user = get_current_user()
action = render_header_with_subtitle(
    "Keywords",
    "Manage and track your target keywords",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="keywords"
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

with section_panel("Project Selection", "", "Choose a website and variant"):
    col1, col2 = st.columns([1, 1], gap="medium")

    with col1:
        selected_base_url = st.selectbox(
            "Website",
            options=sorted_base_urls,
            index=sorted_base_urls.index(default_base_url) if default_base_url in sorted_base_urls else 0,
            label_visibility="visible",
            key="website_selector"
        )

    with col2:
        variants = project_groups[selected_base_url]
        variants_sorted = sorted(variants, key=lambda x: x['name'])
        variant_names = [p['name'] for p in variants_sorted]

        selected_variant_name = st.selectbox(
            "Variant",
            options=variant_names,
            index=variant_names.index(default_variant_name) if default_variant_name in variant_names else 0,
            label_visibility="visible",
            key="variant_selector"
        )

        variant_options = {p['name']: p for p in variants_sorted}
        project = variant_options[selected_variant_name]
        project_id = project['id']
        can_edit = user_can_edit_project(project_id)

# Tabs
tab1, tab2, tab3 = st.tabs(["View Keywords", "Add Keywords", "Import/Export"])

# ========== VIEW KEYWORDS TAB ==========
with tab1:
    with section_panel("Keywords & Rankings", "", "View and manage your tracked keywords"):
        rankings = get_rankings_by_project(project_id, latest_only=True)

        if not rankings:
            render_info_box("No keywords found. Add keywords in the 'Add Keywords' tab.", "info")
        else:
            table_data = []
            for r in rankings:
                best_rank = get_best_rank(r['id']) if r.get('id') else None

                change = None
                if r.get('position') and r.get('previous_position'):
                    change = r['previous_position'] - r['position']

                change_str = "-"
                if change is not None:
                    change_str = f"+{change}" if change > 0 else str(change)

                table_data.append({
                    "ID": r.get('id'),
                    "Keyword": r.get('keyword', ''),
                    "Current Rank": r.get('position') or "Not Ranked",
                    "Previous Rank": r.get('previous_position') or "-",
                    "Change": change_str,
                    "Best Rank": best_rank or "-",
                    "URL": r.get('url_found', '-')[:60] if r.get('url_found') else '-',
                    "Last Checked": r.get('checked_at', '-')
                })

            df = pd.DataFrame(table_data)

            st.dataframe(
                df.drop(columns=['ID']),
                use_container_width=True,
                hide_index=True,
                height=500
            )

            st.write(f"Total Keywords: {len(rankings)}")

    with section_panel("Bulk Actions", "", ""):
        col1, col2 = st.columns([1, 2], vertical_alignment="bottom")

        with col1:
            if st.button("Sync to Google Sheets", type="primary", use_container_width=True):
                if not project.get('google_sheet_id'):
                    st.error("No Google Sheet linked to this project.")
                elif not any(r.get("checked_at") for r in rankings):
                    st.warning("Run a rank check before syncing to Google Sheets.")
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

                            st.success("Synced to Google Sheets.")
                            if project.get('google_sheet_url'):
                                st.success(f"View Sheet: {project['google_sheet_url']}")

                    except Exception as e:
                        st.error(f"Sync failed: {str(e)}")

        with col2:
            keyword_ids_to_delete = st.multiselect(
                "Select keywords to delete",
                options=df['ID'].tolist(),
                format_func=lambda x: df[df['ID'] == x]['Keyword'].values[0]
            )

            if keyword_ids_to_delete:
                if st.button("Delete Selected", type="secondary", use_container_width=True, disabled=not can_edit):
                    if st.session_state.get('confirm_bulk_delete', False):
                        count = delete_keywords_bulk(keyword_ids_to_delete)
                        st.success(f"Deleted {count} keywords")
                        st.session_state['confirm_bulk_delete'] = False
                        st.rerun()
                    else:
                        st.session_state['confirm_bulk_delete'] = True
                        st.warning("Click delete again to confirm")

# ========== ADD KEYWORDS TAB ==========
with tab2:
    with section_panel("Add Keywords", "", "Add keywords individually or in bulk"):
        add_method = st.radio(
            "Add Method",
            options=["Single Keyword", "Bulk Paste"],
            horizontal=True
        )

        if add_method == "Single Keyword":
            with st.form("add_single_keyword"):
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
            with st.form("add_bulk_keywords"):
                st.write("Paste keywords below (one per line):")
                keywords_text = st.text_area(
                    "Keywords",
                    placeholder="keyword 1\nkeyword 2\nkeyword 3",
                    height=200
                )

                submit = st.form_submit_button("Add Keywords", disabled=not can_edit)

                if submit and keywords_text:
                    keywords_list = [kw.strip() for kw in keywords_text.split("\n") if kw.strip()]

                    if keywords_list:
                        count = create_keywords_bulk(project_id, keywords_list)
                        st.success(f"Added {count} out of {len(keywords_list)} keywords")

                        if count < len(keywords_list):
                            st.info(f"{len(keywords_list) - count} keywords were duplicates or failed")

                        st.rerun()

# ========== IMPORT/EXPORT TAB ==========
with tab3:
    with section_panel("Import/Export", "", "Import keywords from CSV or export your keywords"):
        col1, col2 = st.columns(2)

        with col1:
            with sub_panel("Import from CSV", "CSV should have a 'keyword' column"):
                uploaded_file = st.file_uploader("Choose CSV file", type=['csv'], disabled=not can_edit)

                if uploaded_file:
                    try:
                        df_import = pd.read_csv(uploaded_file)

                        if 'keyword' not in df_import.columns:
                            st.error("CSV must have a 'keyword' column")
                        else:
                            keywords_to_import = df_import['keyword'].dropna().tolist()

                            st.write(f"Found {len(keywords_to_import)} keywords")

                            if st.button("Import Keywords", disabled=not can_edit):
                                count = create_keywords_bulk(project_id, keywords_to_import)
                                st.success(f"Imported {count} keywords")
                                st.rerun()

                    except Exception as e:
                        st.error(f"Failed to read CSV: {str(e)}")

        with col2:
            with sub_panel("Export to CSV", "Download a CSV of keywords and rankings"):
                rankings = get_rankings_by_project(project_id, latest_only=True)

                if rankings:
                    export_data = []
                    for r in rankings:
                        export_data.append({
                            'keyword': r.get('keyword', ''),
                            'current_rank': r.get('position', ''),
                            'previous_rank': r.get('previous_position', ''),
                            'url_found': r.get('url_found', ''),
                            'last_checked': r.get('checked_at', '')
                        })

                    df_export = pd.DataFrame(export_data)
                    csv_buffer = io.StringIO()
                    df_export.to_csv(csv_buffer, index=False)
                    csv_data = csv_buffer.getvalue()

                    st.download_button(
                        label="Download CSV",
                        data=csv_data,
                        file_name=f"{project['name']}_keywords.csv",
                        mime="text/csv"
                    )
                else:
                    render_info_box("No keywords to export", "info")

render_app_footer()
