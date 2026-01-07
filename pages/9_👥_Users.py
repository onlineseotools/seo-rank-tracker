"""Users page - Manage users and access"""
import streamlit as st

from components.auth import (
    require_authentication,
    get_current_user,
    handle_user_menu,
)
from components.modern_ui import (
    load_custom_css,
    render_header_with_subtitle,
    section_panel,
    render_info_box,
    render_app_footer,
)
from database.models import (
    list_users,
    create_user,
    update_user,
    update_user_password,
    delete_user,
    get_all_projects,
    set_user_project_access,
    get_user_project_access,
)


st.set_page_config(page_title="Users", page_icon="Users", layout="wide", initial_sidebar_state="expanded")

require_authentication()

load_custom_css()

current_user = get_current_user()
action = render_header_with_subtitle(
    "Users",
    "Manage user accounts, access, and profile settings",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="users"
)
handle_user_menu(action)

is_admin = current_user and current_user.get("role") == "admin"

tabs = ["My Profile"]
if is_admin:
    tabs += ["User Management", "Access Control"]

tab_list = st.tabs(tabs)
tab_profile = tab_list[0]
tab_users = tab_list[1] if is_admin else None
tab_access = tab_list[2] if is_admin else None


with tab_profile:
    with section_panel("My Profile", "", "Update your account details"):
        if not current_user:
            render_info_box("No user found in session.", "warning")
        else:
            with st.form("update_profile_form"):
                col1, col2 = st.columns(2)

                with col1:
                    new_username = st.text_input("Username", value=current_user["username"])

                with col2:
                    current_role = current_user.get("role", "user")
                    st.text_input("Role", value=current_role, disabled=True)

                col3, col4 = st.columns(2)
                with col3:
                    new_password = st.text_input("New Password", type="password")
                with col4:
                    confirm_password = st.text_input("Confirm Password", type="password")

                submit = st.form_submit_button("Update Profile", use_container_width=True)

                if submit:
                    errors = []
                    if not new_username.strip():
                        errors.append("Username cannot be empty.")
                    if new_password or confirm_password:
                        if new_password != confirm_password:
                            errors.append("Passwords do not match.")
                        elif len(new_password) < 6:
                            errors.append("Password must be at least 6 characters.")

                    if errors:
                        for err in errors:
                            st.error(err)
                    else:
                        if not update_user(current_user["id"], username=new_username.strip()):
                            st.error("Username already exists.")
                        else:
                            if new_password:
                                update_user_password(current_user["id"], new_password)
                            st.success("Profile updated. Please log in again if you changed your password.")


if tab_users:
    with tab_users:
        with section_panel("User Management", "", "Create and manage user accounts"):
            users = list_users(include_inactive=True)

            if users:
                st.dataframe(users, use_container_width=True, hide_index=True, height=300)
            else:
                render_info_box("No users found.", "info")

            st.markdown("---")

            with st.form("create_user_form"):
                col1, col2, col3 = st.columns(3)
                with col1:
                    username = st.text_input("Username")
                with col2:
                    password = st.text_input("Password", type="password")
                with col3:
                    role = st.selectbox("Role", options=["user", "admin"], index=0)

                create_submit = st.form_submit_button("Create User", use_container_width=True)

                if create_submit:
                    if not username or not password:
                        st.error("Username and password are required.")
                    else:
                        user_id = create_user(username, password, role=role, is_active=True)
                        if user_id:
                            st.success("User created.")
                            st.rerun()
                        else:
                            st.error("Username already exists.")

        with section_panel("Update User", "", "Edit role or deactivate users"):
            users = list_users(include_inactive=True)
            user_map = {u["username"]: u for u in users}

            selected_username = st.selectbox(
                "Select User",
                options=list(user_map.keys()) if user_map else [],
                index=0 if user_map else None,
            )

            if selected_username:
                user = user_map[selected_username]
                if user["id"] == current_user["id"]:
                    render_info_box("Use the My Profile tab to edit your own account.", "info")
                else:
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        new_role = st.selectbox("Role", options=["user", "admin"], index=0 if user["role"] == "user" else 1)
                    with col2:
                        is_active = st.checkbox("Active", value=bool(user["is_active"]))
                    with col3:
                        reset_password = st.text_input("Reset Password", type="password")

                    col_a, col_b = st.columns(2)
                    with col_a:
                        if st.button("Save Changes", use_container_width=True):
                            if not update_user(user["id"], role=new_role, is_active=int(is_active)):
                                st.error("Failed to update user.")
                            else:
                                if reset_password:
                                    update_user_password(user["id"], reset_password)
                                st.success("User updated.")
                            st.rerun()
                    with col_b:
                        if st.button("Delete User", use_container_width=True):
                            delete_user(user["id"])
                            st.success("User deleted.")
                            st.rerun()


if tab_access:
    with tab_access:
        with section_panel("Access Control", "", "Assign project access to users"):
            users = list_users(include_inactive=False)
            user_options = [u for u in users if u["role"] != "admin"]
            if not user_options:
                render_info_box("No non-admin users available.", "info")
            else:
                user_map = {u["username"]: u for u in user_options}
                selected_username = st.selectbox(
                    "User",
                    options=list(user_map.keys()),
                    index=0
                )
                user = user_map[selected_username]

                projects = get_all_projects(active_only=False)
                project_map = {f"{p['name']} ({p['target_location']})": p for p in projects}
                project_labels = list(project_map.keys())

                existing_access = get_user_project_access(user["id"])
                existing_ids = {a["project_id"] for a in existing_access}
                existing_labels = [
                    label for label, proj in project_map.items()
                    if proj["id"] in existing_ids
                ]

                assigned_projects = st.multiselect(
                    "Assigned Projects",
                    options=project_labels,
                    default=existing_labels
                )

                access_level = st.selectbox(
                    "Access Level",
                    options=["View Only", "Edit"],
                    index=0
                )

                if st.button("Save Access", use_container_width=True):
                    project_ids = [project_map[label]["id"] for label in assigned_projects]
                    set_user_project_access(user["id"], project_ids, can_edit=(access_level == "Edit"))
                    st.success("Access updated.")

render_app_footer()
