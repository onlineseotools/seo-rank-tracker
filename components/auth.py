"""Authentication component for password protection"""
import hashlib
from datetime import datetime
import streamlit as st
from database.models import (
    get_setting,
    list_users,
    get_user_by_username,
    get_user_by_id,
    verify_user_password,
    update_user,
    get_projects_for_user,
    user_can_edit_project as _user_can_edit_project,
)
from components.modern_ui import load_custom_css, render_app_footer
from database.db import init_database, seed_initial_data
from services.google_sheets import exchange_sheets_auth_code
from services.search_console import exchange_gsc_auth_code
import config


def _ensure_db_ready():
    """Initialize database once per session."""
    if st.session_state.get("db_ready"):
        return
    init_database()
    seed_initial_data()
    st.session_state["db_ready"] = True


def _build_auth_token(user_id: int, password_hash: str) -> str:
    """Create a stable auth token from user id and password hash."""
    payload = f"{user_id}:{password_hash}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _get_auth_query_token() -> str | None:
    """Read auth token from query params if present."""
    try:
        params = st.query_params
    except Exception:
        return None
    token = params.get("auth")
    if isinstance(token, list):
        return token[0] if token else None
    return token


def _get_auth_token_from_state() -> str | None:
    """Extract auth token embedded in OAuth state."""
    try:
        params = st.query_params
    except Exception:
        return None
    state = params.get("state")
    if isinstance(state, list):
        state = state[0] if state else None
    if not state or "|" not in state:
        return None
    parts = state.split("|")
    if len(parts) < 3:
        return None
    if parts[0] not in ("sheets", "gsc"):
        return None
    token = parts[1].strip()
    return token or None


def _consume_oauth_callback():
    """Handle OAuth redirects when the app lands outside Settings."""
    try:
        params = st.query_params
    except Exception:
        return

    code = params.get("code")
    state = params.get("state")
    if isinstance(code, list):
        code = code[0] if code else None
    if isinstance(state, list):
        state = state[0] if state else None

    if not code or not state:
        return

    provider = None
    if state.startswith("sheets|") or state.startswith("sheets:"):
        provider = "sheets"
    elif state.startswith("gsc|") or state.startswith("gsc:"):
        provider = "gsc"

    if not provider:
        return

    redirect_uri = config.OAUTH_REDIRECT_URI
    try:
        if provider == "sheets":
            exchange_sheets_auth_code(code, redirect_uri=redirect_uri)
            st.session_state["oauth_success"] = "Google Sheets OAuth connected."
        else:
            exchange_gsc_auth_code(code, redirect_uri=redirect_uri)
            st.session_state["oauth_success"] = "Google Search Console OAuth connected."
    except Exception as exc:
        st.session_state["oauth_error"] = str(exc)
    finally:
        # Remove OAuth params while keeping any others.
        cleaned = dict(params)
        for key in ("code", "state", "scope", "authuser", "prompt"):
            cleaned.pop(key, None)
        params.clear()
        for key, value in cleaned.items():
            params[key] = value


def check_authentication() -> bool:
    """Check if user is authenticated"""
    _ensure_db_ready()
    users = list_users(include_inactive=False, include_password_hash=True)
    token = _get_auth_query_token() or _get_auth_token_from_state()

    if st.session_state.get("authenticated", False) and st.session_state.get("user_id"):
        user = get_user_by_id(st.session_state.get("user_id"))
        if user and user.get("is_active"):
            expected_token = _build_auth_token(user["id"], user["password_hash"])
            st.session_state["auth_token"] = expected_token
            if token != expected_token:
                try:
                    st.query_params["auth"] = expected_token
                except Exception:
                    pass
            _consume_oauth_callback()
            return True
        st.session_state.authenticated = False

    if token:
        for user in users:
            expected_token = _build_auth_token(user["id"], user["password_hash"])
            if token == expected_token:
                st.session_state.authenticated = True
                st.session_state.authenticated_user = user["username"]
                st.session_state.user_id = user["id"]
                st.session_state.user_role = user["role"]
                st.session_state["auth_token"] = expected_token
                try:
                    st.query_params["auth"] = expected_token
                except Exception:
                    pass
                _consume_oauth_callback()
                return True
    # Fallback to legacy settings-based auth when no users exist
    if not users:
        stored_username = get_setting("app_username") or config.DEFAULT_APP_USERNAME
        stored_password = get_setting("app_password") or config.DEFAULT_APP_PASSWORD
        expected_token = _build_auth_token(0, hashlib.sha256(f"{stored_username}:{stored_password}".encode("utf-8")).hexdigest())
        if token and token == expected_token:
            st.session_state.authenticated = True
            st.session_state.authenticated_user = stored_username
            st.session_state.user_id = 0
            st.session_state.user_role = "admin"
            st.session_state["auth_token"] = expected_token
            try:
                st.query_params["auth"] = expected_token
            except Exception:
                pass
            _consume_oauth_callback()
            return True

    _consume_oauth_callback()
    return False


def login_form():
    """Display login form"""
    load_custom_css()
    oauth_success = st.session_state.pop("oauth_success", None)
    oauth_error = st.session_state.pop("oauth_error", None)
    if oauth_success:
        st.success(oauth_success)
    if oauth_error:
        st.error(oauth_error)
    st.markdown(
        """
        <style>
            .top-nav { display: none !important; }
            [data-testid="stSidebar"] { display: none !important; }
            [data-testid="collapsedControl"],
            [data-testid="stSidebarCollapseButton"],
            [data-testid="stSidebarCollapsedControl"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
            header { display: none !important; }
            .login-screen-marker,
            .login-card-marker {
                display: none;
            }
            body:has(.login-screen-marker) {
                overflow: hidden;
            }
            body:has(.login-screen-marker) [data-testid="stAppViewContainer"],
            body:has(.login-screen-marker) .main {
                height: 100vh;
            }
            body:has(.login-screen-marker) .block-container {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                height: 100vh;
                padding: 0 !important;
                margin: 0 !important;
                gap: 0;
            }
            body:has(.login-screen-marker) .block-container > div {
                width: 100%;
                display: flex;
                justify-content: center;
                margin: 0 !important;
            }
            body:has(.login-screen-marker) div[data-testid="stVerticalBlock"] {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
            }
            div[data-testid="stVerticalBlock"]:has(.login-card-marker) {
                width: 40%;
                min-width: 360px;
                max-width: 520px;
                margin: 0 auto;
                transform: translateY(-6vh);
                padding: 1.5rem;
                background: var(--bg-elev);
                border: 1px solid var(--border);
                box-shadow: 0 18px 40px rgba(0,0,0,0.35);
            }
            body:has(.login-screen-marker) div[data-testid="stForm"] {
                background: transparent !important;
                border: none !important;
                padding: 0 !important;
            }
            body:has(.login-screen-marker) .scroll-top-button,
            body:has(.login-screen-marker) #scroll-top-anchor {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
            div[data-testid="stVerticalBlock"]:has(.login-card-marker) > div,
            div[data-testid="stVerticalBlock"]:has(.login-card-marker) form,
            div[data-testid="stVerticalBlock"]:has(.login-card-marker) [data-baseweb="input"],
            div[data-testid="stVerticalBlock"]:has(.login-card-marker) input {
                width: 100% !important;
            }
            div[data-testid="stVerticalBlock"]:has(.login-card-marker) [data-baseweb="input"] > div {
                width: 100%;
            }
            div[data-testid="stVerticalBlock"]:has(.login-card-marker) [data-baseweb="input"] button {
                width: auto !important;
                margin-left: auto;
            }
            .login-title {
                font-size: 1.6rem;
                font-weight: 700;
                color: var(--text-primary);
                text-align: center;
                margin-bottom: 0.25rem;
            }
            .login-subtitle {
                text-align: center;
                color: var(--text-muted);
                font-size: 0.9rem;
                margin-bottom: 1rem;
            }
            div[data-testid="stVerticalBlock"]:has(.login-card-marker) label {
                text-transform: uppercase;
                letter-spacing: 0.12em;
                font-size: 0.75rem;
            }
        </style>
        """,
        unsafe_allow_html=True
    )
    st.markdown("<div class='login-screen-marker'></div>", unsafe_allow_html=True)

    login_container = st.container()
    with login_container:
        st.markdown("<div class='login-card-marker'></div>", unsafe_allow_html=True)
        st.markdown("<div class='login-title'>SEO Rank Tracker</div>", unsafe_allow_html=True)
        st.markdown("<div class='login-subtitle'>Sign in to continue</div>", unsafe_allow_html=True)

        with st.form("login_form"):
            stored_username = get_setting("app_username") or config.DEFAULT_APP_USERNAME
            username = st.text_input("Username", value=stored_username)
            password = st.text_input("Password", type="password")
            submit = st.form_submit_button("Login", use_container_width=True)

            if submit:
                users = list_users(include_inactive=False)
                user = get_user_by_username(username)
                if user and verify_user_password(user, password):
                    st.session_state.authenticated = True
                    st.session_state.authenticated_user = user["username"]
                    st.session_state.user_id = user["id"]
                    st.session_state.user_role = user["role"]
                    update_user(user["id"], last_login=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                    try:
                        st.query_params["auth"] = _build_auth_token(user["id"], user["password_hash"])
                    except Exception:
                        pass
                    st.rerun()
                elif not users:
                    stored_password = get_setting("app_password") or config.DEFAULT_APP_PASSWORD
                    if username == stored_username and password == stored_password:
                        st.session_state.authenticated = True
                        st.session_state.authenticated_user = username
                        st.session_state.user_id = 0
                        st.session_state.user_role = "admin"
                        try:
                            legacy_hash = hashlib.sha256(f"{stored_username}:{stored_password}".encode("utf-8")).hexdigest()
                            st.query_params["auth"] = _build_auth_token(0, legacy_hash)
                        except Exception:
                            pass
                        st.rerun()
                    else:
                        st.error("Incorrect username or password")
                else:
                    st.error("Incorrect username or password")


def require_authentication():
    """Decorator/wrapper to require authentication on pages"""
    load_custom_css()
    if not check_authentication():
        login_form()
        st.stop()
    _consume_auth_action()


def require_admin():
    """Require admin role."""
    load_custom_css()
    if not check_authentication():
        login_form()
        st.stop()
    if st.session_state.get("user_role") != "admin":
        render_app_footer()
        st.error("Admin access required.")
        st.stop()
    _consume_auth_action()


def _consume_auth_action():
    """Handle header menu actions via query params."""
    try:
        params = st.query_params
    except Exception:
        return

    action = params.get("action")
    if isinstance(action, list):
        action = action[0] if action else None

    if not action:
        return

    try:
        params.pop("action", None)
    except Exception:
        pass

    if action == "logout":
        logout()
    elif action == "profile":
        st.session_state["open_profile_tab"] = True
        st.switch_page("pages/9_\U0001F465_Users.py")


def get_current_user():
    """Get current authenticated user dict."""
    user_id = st.session_state.get("user_id")
    if not user_id:
        return None
    return get_user_by_id(user_id)


def get_accessible_projects(active_only: bool = True):
    """Return projects accessible to the current user."""
    user = get_current_user()
    if not user:
        return []
    return get_projects_for_user(
        user["id"],
        user.get("role") == "admin",
        active_only=active_only
    )


def user_can_edit_project(project_id: int) -> bool:
    """Check if current user can edit a project."""
    user = get_current_user()
    if not user:
        return False
    if user.get("role") == "admin":
        return True
    return _user_can_edit_project(user["id"], project_id)


def handle_user_menu(action: str):
    """Handle user menu actions from header."""
    if action == "Edit Profile":
        st.session_state["open_profile_tab"] = True
        st.switch_page("pages/9_\U0001F465_Users.py")
    elif action == "Logout":
        logout()


def logout():
    """Logout user"""
    st.session_state.authenticated = False
    st.session_state.pop("authenticated_user", None)
    st.session_state.pop("user_id", None)
    st.session_state.pop("user_role", None)
    try:
        st.query_params.pop("auth", None)
    except Exception:
        pass
    st.rerun()
