"""Projects page - Project management with modern UI"""
import streamlit as st
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
    render_stat_card, render_info_box, render_sidebar_projects,
    render_app_footer, sub_panel
)
from database.models import (
    create_project, update_project,
    delete_project, get_keywords_by_project
)
from services.google_sheets import create_project_sheet


st.set_page_config(page_title="Projects", page_icon="Projects", layout="wide", initial_sidebar_state="expanded")

require_authentication()

load_custom_css()

render_sidebar_projects(active_only=False)

current_user = get_current_user()
action = render_header_with_subtitle(
    "Projects",
    "Manage your SEO projects and variants",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="projects"
)
handle_user_menu(action)

is_admin = current_user and current_user.get("role") == "admin"

# Tabs
tab_labels = ["All Projects"]
if is_admin:
    tab_labels.append("Create New Project")
tabs = st.tabs(tab_labels)
tab1 = tabs[0]
tab2 = tabs[1] if is_admin else None

# ========== ALL PROJECTS TAB ==========
with tab1:
    with section_panel("All Projects", "", "Projects organized by website with location variants"):
        projects = get_accessible_projects(active_only=False)

        if not projects:
            render_info_box(
                "No projects found. Create your first project in the 'Create New Project' tab.",
                "info"
            )
        else:
            sidebar_project_id = st.session_state.pop("sidebar_project_id", None)
            if sidebar_project_id:
                st.session_state.editing_project_id = sidebar_project_id

            project_hierarchy = defaultdict(list)
            for project in projects:
                base_url = project['url']
                project_hierarchy[base_url].append(project)

            total_projects = len(projects)
            total_websites = len(project_hierarchy)
            total_keywords = sum(len(get_keywords_by_project(p['id'])) for p in projects)

            col1, col2, col3, col4 = st.columns(4)

            with col1:
                render_stat_card("Total Websites", str(total_websites), "Unique domains")

            with col2:
                render_stat_card("Total Projects", str(total_projects), "Including all variants")

            with col3:
                render_stat_card("Total Keywords", str(total_keywords), "Across all projects")

            with col4:
                active_count = sum(1 for p in projects if p.get('is_active'))
                render_stat_card("Active Projects", str(active_count), f"{(active_count/total_projects*100):.0f}% active")

            def go_to(page_path: str, project_id: int):
                st.session_state.active_project_id = project_id
                st.switch_page(page_path)

            for base_url in sorted(project_hierarchy.keys()):
                variants = sorted(project_hierarchy[base_url], key=lambda x: x['name'])

                parent_keywords = sum(len(get_keywords_by_project(v['id'])) for v in variants)
                active_variants = sum(1 for p in variants if p.get("is_active"))
                subtitle = f"{len(variants)} variants • {parent_keywords} keywords • {active_variants} active"

                with sub_panel(base_url, subtitle):
                    grid_cols = st.columns(3, gap="medium")

                    for idx, project in enumerate(variants):
                        col = grid_cols[idx % 3]
                        with col:
                            keywords = get_keywords_by_project(project['id'])
                            keyword_count = len(keywords)
                            sheet_status = "Sheet linked" if project.get('google_sheet_id') else "No sheet"
                            gsc_status = "GSC linked" if project.get('gsc_property') else "No GSC"
                            active_label = "Active" if project.get('is_active') else "Inactive"

                            sheet_badge = "badge-info" if project.get('google_sheet_id') else "badge-muted"
                            gsc_badge = "badge-info" if project.get('gsc_property') else "badge-muted"
                            active_badge = "badge-success" if project.get('is_active') else "badge-danger"

                            st.markdown(f"""
                            <div class="modern-card project-tile">
                                <div class="card-title">{project['name'][:40]}</div>
                                <div class="card-subtitle">Location: {project['target_location']}</div>
                                <div class="project-meta">
                                    <span class="badge badge-success">{keyword_count} keywords</span>
                                    <span class="badge {sheet_badge}">{sheet_status}</span>
                                    <span class="badge {gsc_badge}">{gsc_status}</span>
                                    <span class="badge {active_badge}">{active_label}</span>
                                </div>
                            </div>
                            """, unsafe_allow_html=True)

                            action_row = st.columns(3, gap="small")
                            with action_row[0]:
                                if st.button("Dashboard", key=f"dash_{project['id']}", use_container_width=True):
                                    go_to("pages/_9_\U0001F4CC_Project_Dashboard.py", project['id'])
                            with action_row[1]:
                                if st.button("Edit", key=f"edit_{project['id']}", use_container_width=True, disabled=not user_can_edit_project(project["id"])):
                                    st.session_state.editing_project_id = project['id']
                            with action_row[2]:
                                if st.button("Delete", key=f"delete_{project['id']}", use_container_width=True, disabled=not is_admin):
                                    confirm_key = f"confirm_delete_{project['id']}"
                                    if st.session_state.get(confirm_key, False):
                                        delete_project(project['id'])
                                        st.session_state.pop(confirm_key, None)
                                        if st.session_state.get("editing_project_id") == project['id']:
                                            st.session_state.pop("editing_project_id", None)
                                        st.rerun()
                                    else:
                                        st.session_state[confirm_key] = True
                                        st.warning("Click delete again to confirm.")

                    edit_id = st.session_state.get("editing_project_id")
                    if edit_id and any(p['id'] == edit_id for p in variants):
                        project = next(p for p in variants if p['id'] == edit_id)
                        st.subheader("Edit Project")
                        if not user_can_edit_project(project["id"]):
                            render_info_box("You don't have edit access for this project.", "warning")
                            st.session_state.pop("editing_project_id", None)
                            st.stop()

                        with st.form(f"edit_form_{project['id']}"):
                            col1, col2, col3 = st.columns(3)

                            with col1:
                                new_name = st.text_input("Name", value=project['name'])
                                new_url = st.text_input("URL", value=project['url'])

                            with col2:
                                new_location = st.text_input("Location", value=project['target_location'])
                                new_frequency = st.selectbox(
                                    "Frequency",
                                    options=["daily", "weekly", "monthly"],
                                    index=["daily", "weekly", "monthly"].index(project.get('update_frequency', 'monthly'))
                                )

                            with col3:
                                new_gsc_property = st.text_input(
                                    "GSC Property",
                                    value=project.get('gsc_property', '') or '',
                                    placeholder="https://example.com"
                                )
                                new_active = st.checkbox("Active", value=project.get('is_active', True))

                            col1, col2 = st.columns(2)
                            with col1:
                                submit = st.form_submit_button("Save", type="primary", use_container_width=True)
                                if submit:
                                    update_project(
                                        project['id'],
                                        name=new_name,
                                        url=new_url,
                                        target_location=new_location,
                                        update_frequency=new_frequency,
                                        gsc_property=new_gsc_property if new_gsc_property else None,
                                        is_active=new_active
                                    )
                                    st.session_state.pop("editing_project_id", None)
                                    st.rerun()

                            with col2:
                                cancel = st.form_submit_button("Cancel", type="secondary", use_container_width=True)
                                if cancel:
                                    st.session_state.pop("editing_project_id", None)
                                    st.rerun()

# ========== CREATE NEW PROJECT TAB ==========
if tab2:
    with tab2:
        with section_panel("Create New Project", "", "Add a new website and location variant to track"):
            with st.form("create_project_form"):
                col1, col2 = st.columns(2)

                with col1:
                    project_name = st.text_input(
                        "Project Name*",
                        placeholder="Acme Corp - US"
                    )
                    project_url = st.text_input(
                        "Website URL*",
                        placeholder="example.com"
                    )
                    project_location = st.text_input(
                        "Target Location*",
                        placeholder="United States"
                    )

                with col2:
                    update_frequency = st.selectbox(
                        "Update Frequency",
                        options=["daily", "weekly", "monthly"],
                        index=2
                    )
                    gsc_property = st.text_input(
                        "GSC Property (optional)",
                        placeholder="https://example.com"
                    )

                create_sheet = st.checkbox(
                    "Create Google Sheet automatically",
                    value=True
                )

                col1, col2, col3 = st.columns([1, 1, 2])

                with col1:
                    submit = st.form_submit_button(
                        "Create Project",
                        type="primary",
                        use_container_width=True
                    )

                with col2:
                    clear = st.form_submit_button(
                        "Clear Form",
                        use_container_width=True
                    )

                if submit:
                    if not project_name or not project_url or not project_location:
                        st.error("Please fill in all required fields (marked with *).")
                    else:
                        try:
                            sheet_id = None
                            sheet_url = None

                            if create_sheet:
                                with st.spinner("Creating Google Sheet..."):
                                    try:
                                        sheet_id, sheet_url = create_project_sheet(project_name)
                                    except Exception as e:
                                        st.warning(f"Failed to create Google Sheet: {str(e)}")
                                        st.info("Project will be created without a sheet. You can create one later.")

                            project_id = create_project(
                                name=project_name,
                                url=project_url,
                                target_location=project_location,
                                google_sheet_id=sheet_id,
                                google_sheet_url=sheet_url,
                                gsc_property=gsc_property if gsc_property else None,
                                update_frequency=update_frequency
                            )

                            st.success(f"Project created successfully. ID: {project_id}")
                            st.rerun()

                        except Exception as e:
                            st.error(f"Failed to create project: {str(e)}")

                if clear:
                    st.rerun()

render_app_footer()
