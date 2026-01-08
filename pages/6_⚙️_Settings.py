"""Settings page - Configure API keys and app settings"""
import streamlit as st
import json
import uuid
from components.auth import require_admin, get_current_user, handle_user_menu, logout
from components.modern_ui import (
    load_custom_css, render_header_with_subtitle, section_panel,
    render_info_box, render_sidebar_projects, render_app_footer, sub_panel
)
from database.models import get_setting, set_setting, get_sync_logs, update_user, update_user_password
from services.serp_api import test_api_connection
from services.google_sheets import (
    test_sheets_connection,
    REQUIRED_SERVICE_ACCOUNT_FIELDS,
    initiate_sheets_oauth,
    get_oauth_credentials,
    get_sheets_auth_url,
    exchange_sheets_auth_code
)
from services.search_console import (
    test_gsc_connection,
    get_gsc_auth_url,
    exchange_gsc_auth_code
)
from components.tables import display_sync_log_table
import config


st.set_page_config(page_title="Settings", page_icon="Settings", layout="wide", initial_sidebar_state="expanded")

require_admin()

load_custom_css()

render_sidebar_projects(active_only=False)

current_user = get_current_user()


def _get_query_param(name: str):
    value = st.query_params.get(name)
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _clear_oauth_params():
    params = dict(st.query_params)
    for key in ("code", "state", "scope", "authuser", "prompt"):
        params.pop(key, None)
    st.query_params.clear()
    for key, value in params.items():
        st.query_params[key] = value


def _consume_oauth_code():
    code = _get_query_param("code")
    state = _get_query_param("state")
    error = _get_query_param("error")
    if error:
        st.error(f"OAuth error: {error}")
        _clear_oauth_params()
        st.session_state.pop("pending_oauth_provider", None)
        st.session_state.pop("pending_oauth_state", None)
        return

    if not code or not state:
        return

    pending = st.session_state.get("pending_oauth_provider")
    expected_state = st.session_state.get("pending_oauth_state")
    derived_provider = None
    if isinstance(state, str):
        if state.startswith("sheets|") or state.startswith("sheets:"):
            derived_provider = "sheets"
        elif state.startswith("gsc|") or state.startswith("gsc:"):
            derived_provider = "gsc"
    redirect_uri = config.OAUTH_REDIRECT_URI

    if pending and expected_state and state != expected_state:
        return

    if not pending:
        pending = derived_provider

    if not pending:
        return

    try:
        if pending == "sheets":
            exchange_sheets_auth_code(code, redirect_uri=redirect_uri)
            st.success("Google Sheets OAuth connected.")
        elif pending == "gsc":
            exchange_gsc_auth_code(code, redirect_uri=redirect_uri)
            st.success("Google Search Console OAuth connected.")
    except Exception as exc:
        st.error(str(exc))
    finally:
        st.session_state.pop("pending_oauth_provider", None)
        st.session_state.pop("pending_oauth_state", None)
        st.session_state.pop("pending_oauth_url", None)
        _clear_oauth_params()
        st.rerun()
action = render_header_with_subtitle(
    "Settings",
    "Configure API keys, integrations, and app preferences",
    "",
    user_label=current_user["username"] if current_user else None,
    menu_key="settings"
)
handle_user_menu(action)

_consume_oauth_code()

oauth_success = st.session_state.pop("oauth_success", None)
oauth_error = st.session_state.pop("oauth_error", None)
oauth_debug = st.session_state.pop("oauth_debug", None)
if oauth_success:
    st.success(oauth_success)
if oauth_error:
    st.error(oauth_error)
if oauth_debug:
    st.info(f"OAuth debug: {oauth_debug}")

# Tabs
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "SERP APIs",
    "Google Sheets",
    "Search Console",
    "App Settings",
    "Sync Log"
])

# ========== SERP APIs TAB ==========
with tab1:
    with section_panel("SERP API Configuration", "", "Configure your rank tracking API providers"):
        with st.expander("Serper.dev", expanded=True):
            col1, col2, col3 = st.columns([3, 1, 1], vertical_alignment="bottom")

            with col1:
                serper_key = st.text_input(
                    "API Key",
                    value=get_setting("serper_api_key") or "",
                    type="password",
                    key="serper_api_key"
                )

            with col2:
                if st.button("Save", key="save_serper", use_container_width=True):
                    set_setting("serper_api_key", serper_key)
                    st.success("Saved")

            with col3:
                if st.button("Test", key="test_serper", use_container_width=True):
                    if not serper_key:
                        st.error("Enter key first")
                    else:
                        with st.spinner("Testing..."):
                            result = test_api_connection("serper", api_key=serper_key)

                        if result['success']:
                            st.success(result['message'])
                        else:
                            st.error(result['message'])

        with st.expander("DataForSEO"):
            col1, col2, col3, col4 = st.columns([2, 2, 1, 1], vertical_alignment="bottom")

            with col1:
                dataforseo_user = st.text_input(
                    "Username",
                    value=get_setting("dataforseo_username") or "",
                    key="dataforseo_username"
                )

            with col2:
                dataforseo_pass = st.text_input(
                    "Password",
                    value=get_setting("dataforseo_password") or "",
                    type="password",
                    key="dataforseo_password"
                )

            with col3:
                if st.button("Save", key="save_dataforseo", use_container_width=True):
                    set_setting("dataforseo_username", dataforseo_user)
                    set_setting("dataforseo_password", dataforseo_pass)
                    st.success("Saved")

            with col4:
                if st.button("Test", key="test_dataforseo", use_container_width=True):
                    if not dataforseo_user or not dataforseo_pass:
                        st.error("Enter credentials")
                    else:
                        with st.spinner("Testing..."):
                            result = test_api_connection(
                                "dataforseo",
                                username=dataforseo_user,
                                password=dataforseo_pass
                            )

                        if result['success']:
                            st.success(result['message'])
                        else:
                            st.error(result['message'])

        with st.expander("ScrapingRobot"):
            col1, col2, col3 = st.columns([3, 1, 1], vertical_alignment="bottom")

            with col1:
                scrapingrobot_key = st.text_input(
                    "API Key",
                    value=get_setting("scrapingrobot_api_key") or "",
                    type="password",
                    key="scrapingrobot_api_key"
                )

            with col2:
                if st.button("Save", key="save_scrapingrobot", use_container_width=True):
                    set_setting("scrapingrobot_api_key", scrapingrobot_key)
                    st.success("Saved")

            with col3:
                if st.button("Test", key="test_scrapingrobot", use_container_width=True):
                    if not scrapingrobot_key:
                        st.error("Enter key first")
                    else:
                        with st.spinner("Testing..."):
                            result = test_api_connection("scrapingrobot", api_key=scrapingrobot_key)

                        if result['success']:
                            st.success(result['message'])
                        else:
                            st.error(result['message'])

    with section_panel("Default API", "", ""):
        col1, col2 = st.columns([3, 1], vertical_alignment="bottom")

        with col1:
            default_api = st.selectbox(
                "Select default SERP API",
                options=["serper", "dataforseo", "scrapingrobot"],
                index=["serper", "dataforseo", "scrapingrobot"].index(
                    get_setting("default_serp_api") or "serper"
                ),
                format_func=lambda x: {
                    "serper": "Serper.dev",
                    "dataforseo": "DataForSEO",
                    "scrapingrobot": "ScrapingRobot"
                }[x]
            )

        with col2:
            if st.button("Save", key="save_default_api", use_container_width=True):
                set_setting("default_serp_api", default_api)
                st.success("Saved")

# ========== GOOGLE SHEETS TAB ==========
with tab2:
    with section_panel("Google Sheets Configuration", "", "Set up Google Sheets integration for data export"):
        render_info_box(
            "Connect with Google OAuth (recommended) to create Sheets in your Drive. "
            "Service account JSON is also supported.",
            "info"
        )
        st.markdown(
            "[Open Google Credentials](https://console.cloud.google.com/apis/credentials)",
            unsafe_allow_html=True
        )

        with st.expander("OAuth (Recommended)", expanded=True):
            col1, col2 = st.columns([3, 1], vertical_alignment="bottom")

            with col1:
                oauth_uploaded_file = st.file_uploader(
                    "Upload OAuth Client Secrets JSON",
                    type=['json'],
                    key="google_oauth_upload"
                )

                if oauth_uploaded_file:
                    try:
                        payload = json.loads(oauth_uploaded_file.getvalue().decode("utf-8"))
                        if not isinstance(payload, dict):
                            raise ValueError("Invalid JSON format.")
                        if not ("installed" in payload or "web" in payload):
                            raise ValueError(
                                "OAuth client secrets JSON must include 'installed' or 'web'."
                            )

                        oauth_path = config.GOOGLE_OAUTH_CLIENT_PATH
                        oauth_path.parent.mkdir(exist_ok=True)
                        with open(oauth_path, 'wb') as f:
                            f.write(oauth_uploaded_file.getbuffer())

                        st.success("OAuth client secrets uploaded")
                    except ValueError as exc:
                        st.error(str(exc))

            with col2:
                if st.button("Connect with Google", key="connect_sheets_oauth", use_container_width=True):
                    try:
                        redirect_uri = config.OAUTH_REDIRECT_URI
                        if redirect_uri:
                            auth_token = st.session_state.get("auth_token") or _get_query_param("auth")
                            state_token = f"sheets|{auth_token}|{uuid.uuid4().hex}" if auth_token else f"sheets|{uuid.uuid4().hex}"
                            auth_url, state = get_sheets_auth_url(
                                redirect_uri=redirect_uri,
                                state=state_token
                            )
                            st.session_state["pending_oauth_provider"] = "sheets"
                            st.session_state["pending_oauth_state"] = state
                            st.session_state["pending_oauth_url"] = auth_url
                            st.info("Open the authorization link to finish OAuth.")
                        else:
                            with st.spinner("Opening browser for authorization..."):
                                initiate_sheets_oauth(str(config.GOOGLE_OAUTH_CLIENT_PATH))
                            st.success("OAuth connected")
                    except Exception as exc:
                        st.error(str(exc))

            pending_url = st.session_state.get("pending_oauth_url")
            if st.session_state.get("pending_oauth_provider") == "sheets" and pending_url:
                st.link_button("Authorize Google", pending_url, use_container_width=True)
                if config.OAUTH_REDIRECT_URI:
                    st.caption(f"Redirect URI: {config.OAUTH_REDIRECT_URI}")
                else:
                    st.caption("Set OAUTH_REDIRECT_URI to enable cloud OAuth.")

            oauth_creds = get_oauth_credentials()
            if oauth_creds:
                st.success("OAuth token is active. Sheets will be created in your Drive.")
            elif config.GOOGLE_OAUTH_TOKEN_PATH.exists():
                st.error("OAuth token is invalid or expired. Click Connect with Google again.")
            with st.expander("OAuth Diagnostics", expanded=False):
                st.write(f"Redirect URI: {config.OAUTH_REDIRECT_URI or 'not set'}")
                st.write(f"Client secrets file: {'found' if config.GOOGLE_OAUTH_CLIENT_PATH.exists() else 'missing'}")
                st.write(f"Sheets token file: {'found' if config.GOOGLE_OAUTH_TOKEN_PATH.exists() else 'missing'}")
                if st.button("Clear Sheets OAuth Token", key="clear_sheets_oauth"):
                    try:
                        config.GOOGLE_OAUTH_TOKEN_PATH.unlink(missing_ok=True)
                        st.success("Sheets OAuth token cleared.")
                    except Exception as exc:
                        st.error(str(exc))

        with st.expander("Service Account (Optional)"):
            col1, col2 = st.columns([3, 1], vertical_alignment="bottom")

            with col1:
                uploaded_file = st.file_uploader(
                    "Upload Service Account JSON",
                    type=['json'],
                    key="google_sa_upload"
                )

                if uploaded_file:
                    try:
                        payload = json.loads(uploaded_file.getvalue().decode("utf-8"))
                        if not isinstance(payload, dict):
                            raise ValueError("Invalid JSON format.")
                        if "installed" in payload or "web" in payload:
                            raise ValueError(
                                "OAuth client secrets detected. Upload a service account JSON "
                                "that includes client_email and token_uri."
                            )
                        missing = REQUIRED_SERVICE_ACCOUNT_FIELDS.difference(payload.keys())
                        if missing:
                            missing_list = ", ".join(sorted(missing))
                            raise ValueError(
                                f"Missing required fields: {missing_list}. "
                                "Upload a valid service account JSON."
                            )

                        credentials_path = config.GOOGLE_CREDENTIALS_PATH
                        credentials_path.parent.mkdir(exist_ok=True)

                        with open(credentials_path, 'wb') as f:
                            f.write(uploaded_file.getbuffer())

                        st.success("Service account credentials uploaded")
                    except ValueError as exc:
                        st.error(str(exc))

            with col2:
                if st.button("Test Connection", key="test_sheets", use_container_width=True):
                    with st.spinner("Testing..."):
                        result = test_sheets_connection()

                    if result['success']:
                        st.success(result['message'])
                    else:
                        st.error(result['message'])

        if config.GOOGLE_CREDENTIALS_PATH.exists():
            try:
                payload = json.loads(config.GOOGLE_CREDENTIALS_PATH.read_text(encoding="utf-8"))
                if "installed" in payload or "web" in payload:
                    raise ValueError("Stored file is OAuth client secrets, not a service account.")
                missing = REQUIRED_SERVICE_ACCOUNT_FIELDS.difference(payload.keys())
                if missing:
                    raise ValueError("Stored credentials are missing required fields.")
                st.success("Service account credentials file exists")
            except Exception as exc:
                st.warning(f"Service account credentials invalid (only needed if you want service account mode): {exc}")
        else:
            st.info("No service account credentials file found.")

# ========== SEARCH CONSOLE TAB ==========
with tab3:
    with section_panel("Google Search Console Configuration", "", "Connect to Google Search Console for organic search data"):
        render_info_box(
            "Search Console requires OAuth authentication. Upload OAuth client secrets and connect your account.",
            "info"
        )

        if config.GOOGLE_OAUTH_CLIENT_PATH.exists():
            st.success("OAuth client secrets file found.")
        else:
            st.warning("Upload OAuth client secrets in the Google Sheets tab.")

        left_col, right_col = st.columns([2, 1], gap="large")

        with left_col:
            with sub_panel("Connect to Google Search Console for organic search data"):
                st.write("Connect your Google account for Search Console access.")

                if st.button("Connect Search Console", key="connect_gsc_oauth", type="primary", use_container_width=True):
                    try:
                        redirect_uri = config.OAUTH_REDIRECT_URI
                        if redirect_uri:
                            auth_token = st.session_state.get("auth_token") or _get_query_param("auth")
                            state_token = f"gsc|{auth_token}|{uuid.uuid4().hex}" if auth_token else f"gsc|{uuid.uuid4().hex}"
                            auth_url, state = get_gsc_auth_url(
                                redirect_uri=redirect_uri,
                                state=state_token
                            )
                            st.session_state["pending_oauth_provider"] = "gsc"
                            st.session_state["pending_oauth_state"] = state
                            st.session_state["pending_oauth_url"] = auth_url
                            st.info("Open the authorization link to finish OAuth.")
                        else:
                            with st.spinner("Opening browser for authorization..."):
                                from services.search_console import initiate_gsc_auth
                                initiate_gsc_auth(str(config.GOOGLE_OAUTH_CLIENT_PATH))
                            st.success("OAuth connected")
                    except Exception as exc:
                        st.error(str(exc))

                pending_url = st.session_state.get("pending_oauth_url")
                if st.session_state.get("pending_oauth_provider") == "gsc" and pending_url:
                    st.link_button("Authorize Google", pending_url, use_container_width=True)
                    if config.OAUTH_REDIRECT_URI:
                        st.caption(f"Redirect URI: {config.OAUTH_REDIRECT_URI}")
                    else:
                        st.caption("Set OAUTH_REDIRECT_URI to enable cloud OAuth.")

        with right_col:
            with sub_panel("Test your GSC OAuth connection"):
                result = st.session_state.get("gsc_test_result")
                if st.button("Test Connection", key="test_gsc", type="secondary", use_container_width=True):
                    with st.spinner("Testing..."):
                        result = test_gsc_connection()
                        st.session_state["gsc_test_result"] = result

                if result:
                    if result['success']:
                        st.success(result['message'])
                    else:
                        st.warning(result['message'])

        with st.expander("OAuth Diagnostics", expanded=False):
            st.write(f"Redirect URI: {config.OAUTH_REDIRECT_URI or 'not set'}")
            st.write(f"Client secrets file: {'found' if config.GOOGLE_OAUTH_CLIENT_PATH.exists() else 'missing'}")
            st.write(f"GSC token file: {'found' if config.GSC_TOKEN_PATH.exists() else 'missing'}")
            if st.button("Clear GSC OAuth Token", key="clear_gsc_oauth"):
                try:
                    config.GSC_TOKEN_PATH.unlink(missing_ok=True)
                    st.success("GSC OAuth token cleared.")
                except Exception as exc:
                    st.error(str(exc))

# ========== APP SETTINGS TAB ==========
with tab4:
    with section_panel("Application Settings", "", "Manage admin account settings"):
        if not current_user:
            render_info_box("No user session found.", "warning")
        else:
            with st.form("update_credentials_form"):
                col1, col2 = st.columns(2)

                with col1:
                    new_username = st.text_input("Username", value=current_user["username"])
                with col2:
                    new_password = st.text_input("New Password", type="password")

                col3, col4 = st.columns(2)
                with col3:
                    confirm_password = st.text_input("Confirm New Password", type="password")
                with col4:
                    st.text_input("Role", value=current_user.get("role", "user"), disabled=True)

                submit = st.form_submit_button("Update Account", use_container_width=True)

                if submit:
                    errors = []
                    if not new_username.strip():
                        errors.append("Username cannot be empty")
                    if new_password or confirm_password:
                        if new_password != confirm_password:
                            errors.append("New passwords do not match")
                        elif len(new_password) < 6:
                            errors.append("Password must be at least 6 characters")

                    if errors:
                        for message in errors:
                            st.error(message)
                    else:
                        if not update_user(current_user["id"], username=new_username.strip()):
                            st.error("Username already exists.")
                        else:
                            if new_password:
                                update_user_password(current_user["id"], new_password)
                            st.success("Account updated. Re-login if you changed your password.")

        col1, col2 = st.columns([1, 2])

        with col1:
            if st.button("Logout", type="secondary", use_container_width=True):
                logout()

        with col2:
            st.markdown(f"Database: `{config.DATABASE_PATH}`")

# ========== SYNC LOG TAB ==========
with tab5:
    with section_panel("Sync & Activity Log", "", "View system activity and sync history"):
        col1, col2 = st.columns([3, 1])

        with col1:
            log_type = st.selectbox(
                "Filter by type",
                options=["All", "rank_check", "rankings_export", "gsc_export"],
                format_func=lambda x: {
                    "All": "All Types",
                    "rank_check": "Rank Checks",
                    "rankings_export": "Ranking Exports",
                    "gsc_export": "GSC Exports"
                }.get(x, x)
            )

        with col2:
            if st.button("Clear Logs", key="clear_logs_btn", type="secondary", use_container_width=True):
                if st.session_state.get('confirm_clear_logs', False):
                    from database.db import get_connection
                    conn = get_connection()
                    cursor = conn.cursor()
                    cursor.execute("DELETE FROM sync_log")
                    conn.commit()
                    conn.close()

                    st.success("Logs cleared")
                    st.session_state['confirm_clear_logs'] = False
                    st.rerun()
                else:
                    st.session_state['confirm_clear_logs'] = True
                    st.warning("Click again")

        logs = get_sync_logs(limit=200)

        if log_type != "All":
            logs = [log for log in logs if log.get('sync_type') == log_type]

        if logs:
            display_sync_log_table(logs)
        else:
            render_info_box("No logs found", "info")

render_app_footer()
