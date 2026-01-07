"""Modern UI Components and Utilities"""
import streamlit as st
from pathlib import Path
from contextlib import contextmanager
from collections import defaultdict


def load_custom_css():
    """Load custom CSS for modern UI"""
    # Load the redesigned CSS
    css_file = Path(__file__).parent.parent / "assets" / "style_overhaul.css"

    if css_file.exists():
        with open(css_file) as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

    user_label = st.session_state.get("authenticated_user", "admin")
    st.markdown(
        f"""
        <div class="top-nav">
            <div class="top-nav__brand">SEO Rank Tracker</div>
            <div class="top-nav__right">
                <div class="top-nav__menu top-nav__menu--instructions">
                    <button class="top-nav__menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" onclick="event.stopPropagation(); this.parentElement.classList.toggle('is-open'); this.setAttribute('aria-expanded', this.parentElement.classList.contains('is-open'));">Instructions v</button>
                    <div class="top-nav__dropdown">
                        <a href="/Instructions_GSC">Get GSC API</a>
                        <a href="/Instructions_Sheets">Enable Sheets</a>
                        <a href="/Instructions_Serper">Serper.dev API</a>
                        <a href="/Instructions_DataForSEO">DataForSEO API</a>
                        <a href="/Instructions_ScrapingRobot">ScrapingRobot API</a>
                    </div>
                </div>
                <a class="top-nav__deploy" href="https://share.streamlit.io/" target="_blank" rel="noopener">Deploy</a>
                <div class="top-nav__user-menu">
                    <button class="top-nav__user-btn" type="button" aria-haspopup="menu" aria-expanded="false" onclick="event.stopPropagation(); this.parentElement.classList.toggle('is-open'); this.setAttribute('aria-expanded', this.parentElement.classList.contains('is-open'));">{user_label} v</button>
                    <div class="top-nav__dropdown">
                        <a href="?action=profile">Edit Profile</a>
                        <a href="?action=logout">Logout</a>
                    </div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    # Fix selectbox value color for dark theme
    st.markdown("""
    <script>
    (function() {
        document.body.classList.add('sidebar-ready');
        function forceStyle(el, prop, value) {
            if (!el || !el.style) {
                return;
            }
            el.style.setProperty(prop, value, "important");
        }

        function fixSelectboxNow() {
            const rootStyles = getComputedStyle(document.documentElement);
            const textColor = (rootStyles.getPropertyValue('--text-primary') || '#e5e7eb').trim();
            const bgColor = (rootStyles.getPropertyValue('--input-bg') || '#1f2531').trim();

            // Target ALL select elements
            document.querySelectorAll('[data-baseweb="select"]').forEach(select => {
                forceStyle(select, "color", textColor);
                const control = select.querySelector('[role="combobox"]') || select.querySelector('[role="button"]');
                if (control) {
                    forceStyle(control, "color", textColor);
                    forceStyle(control, "background", bgColor);
                    control.querySelectorAll('*').forEach(el => {
                        forceStyle(el, "color", textColor);
                        forceStyle(el, "opacity", "1");
                        forceStyle(el, "-webkit-text-fill-color", textColor);
                        forceStyle(el, "visibility", "visible");
                        if (el.getAttribute('style') &&
                            (el.style.color === 'transparent' || el.style.color.includes('rgba(0, 0, 0, 0)'))) {
                            forceStyle(el, "color", textColor);
                            forceStyle(el, "-webkit-text-fill-color", textColor);
                        }
                    });
                }

                select.querySelectorAll('[data-baseweb="value-container"], [data-baseweb="single-value"]').forEach(el => {
                    forceStyle(el, "color", textColor);
                    forceStyle(el, "-webkit-text-fill-color", textColor);
                    forceStyle(el, "opacity", "1");
                    forceStyle(el, "visibility", "visible");
                });

                select.querySelectorAll('div, span, input').forEach(el => {
                    if (el.tagName === 'INPUT') {
                        return;
                    }
                    forceStyle(el, "color", textColor);
                    forceStyle(el, "-webkit-text-fill-color", textColor);
                    forceStyle(el, "opacity", "1");
                    forceStyle(el, "visibility", "visible");
                });

                select.querySelectorAll('[data-baseweb="single-value"], [data-baseweb="value-container"], [class*="singleValue"], [class*="SingleValue"], [class*="valueContainer"], [class*="ValueContainer"]').forEach(el => {
                    forceStyle(el, "display", "block");
                });

                const listbox = select.querySelector('[role="listbox"]');
                if (listbox) {
                    forceStyle(listbox, "background", bgColor);
                    listbox.querySelectorAll('*').forEach(el => {
                        forceStyle(el, "color", textColor);
                        forceStyle(el, "opacity", "1");
                        forceStyle(el, "visibility", "visible");
                    });
                }

                const inputEl = select.querySelector('input');

                if (control) {
                    const tags = select.querySelectorAll('[data-baseweb="tag"]');
                    if (tags.length) {
                        control.setAttribute('data-show-fallback', 'false');
                        select.setAttribute('data-show-fallback', 'false');
                        return;
                    }

                const valueContainer = select.querySelector('[data-baseweb="value-container"]');
                const valueEl = select.querySelector('[data-baseweb="single-value"]')
                    || select.querySelector('[class*="singleValue"]')
                    || select.querySelector('[class*="SingleValue"]');

                    let label = '';
                    if (valueContainer && valueContainer.textContent) {
                        label = valueContainer.textContent.trim();
                    }
                    if (!label && valueEl && valueEl.textContent) {
                        label = valueEl.textContent.trim();
                    }
                    if (!label && inputEl && inputEl.value) {
                        label = inputEl.value.trim();
                    }
                    if (!label) {
                        const ariaLabel = control.getAttribute('aria-label') || '';
                        const titleLabel = control.getAttribute('title') || '';
                        label = ariaLabel.trim() || titleLabel.trim();
                    }

                    if (valueEl) {
                        forceStyle(valueEl, "display", "block");
                        forceStyle(valueEl, "opacity", "1");
                        forceStyle(valueEl, "visibility", "visible");
                    }

                    if (label) {
                        if (inputEl) {
                            inputEl.value = label;
                            inputEl.setAttribute('value', label);
                        }
                        control.setAttribute('data-show-fallback', 'false');
                        select.setAttribute('data-show-fallback', 'false');
                    } else {
                        control.setAttribute('data-show-fallback', 'false');
                        select.setAttribute('data-show-fallback', 'false');
                    }
                }
            });
        }

        function fixSidebarToggle() {
            const candidates = [
                '[data-testid="collapsedControl"]',
                '[data-testid="stSidebarCollapsedControl"]',
                '[data-testid="stSidebarCollapseButton"]'
            ];

            candidates.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.position = 'fixed';
                    el.style.top = '0.6rem';
                    el.style.left = '0.6rem';
                    el.style.zIndex = '10000';
                    el.style.display = 'flex';
                    el.style.visibility = 'visible';
                    el.style.pointerEvents = 'auto';

                    if (el.parentElement && el.parentElement !== document.body) {
                        document.body.appendChild(el);
                    }
                });
            });
        }

        function hideSidebarNavItems() {
            const nav = document.querySelector('[data-testid="stSidebarNav"]');
            if (!nav) {
                return;
            }
            nav.querySelectorAll('a').forEach(link => {
                const label = (link.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const href = (link.getAttribute('href') || '').toLowerCase();
                if (label.includes('project dashboard')
                    || href.includes('project_dashboard')) {
                    link.style.display = 'none';
                    link.style.visibility = 'hidden';
                }
            });
        }

        function renameSidebarAppLabel() {
            return;
        }

        function setupUserMenu() {
            const menu = document.querySelector('.top-nav__user-menu');
            if (!menu) {
                return;
            }
            const button = menu.querySelector('.top-nav__user-btn');
            if (!button || button.dataset.bound === 'true') {
                return;
            }
            button.dataset.bound = 'true';
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                menu.classList.toggle('is-open');
                const expanded = menu.classList.contains('is-open');
                button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            });
            button.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    menu.classList.toggle('is-open');
                    const expanded = menu.classList.contains('is-open');
                    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                }
            });
            if (!document.body.dataset.userMenuBound) {
                document.body.dataset.userMenuBound = 'true';
                document.addEventListener('click', (event) => {
                    document.querySelectorAll('.top-nav__menu, .top-nav__user-menu').forEach(activeMenu => {
                        if (!activeMenu.contains(event.target)) {
                            activeMenu.classList.remove('is-open');
                            const activeButton = activeMenu.querySelector('button');
                            if (activeButton) {
                                activeButton.setAttribute('aria-expanded', 'false');
                            }
                        }
                    });
                });
            }
        }

        function setupInstructionMenu() {
            document.querySelectorAll('.top-nav__menu--instructions .top-nav__menu-btn').forEach(button => {
                if (button.dataset.bound === 'true') {
                    return;
                }
                button.dataset.bound = 'true';
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const menu = button.closest('.top-nav__menu');
                    if (!menu) {
                        return;
                    }
                    menu.classList.toggle('is-open');
                    button.setAttribute('aria-expanded', menu.classList.contains('is-open') ? 'true' : 'false');
                });
            });
        }

        // Run immediately and repeatedly
        fixSelectboxNow();
        fixSidebarToggle();
        hideSidebarNavItems();
        renameSidebarAppLabel();
        setupUserMenu();
        setupInstructionMenu();
        setTimeout(fixSelectboxNow, 50);
        setTimeout(fixSelectboxNow, 100);
        setTimeout(fixSelectboxNow, 300);
        setTimeout(fixSelectboxNow, 500);
        setTimeout(fixSelectboxNow, 1000);
        setTimeout(fixSidebarToggle, 100);
        setTimeout(fixSidebarToggle, 500);
        setTimeout(fixSidebarToggle, 1000);
        setTimeout(hideSidebarNavItems, 200);
        setTimeout(hideSidebarNavItems, 800);
        setTimeout(renameSidebarAppLabel, 200);
        setTimeout(renameSidebarAppLabel, 800);
        setTimeout(setupUserMenu, 200);
        setTimeout(setupUserMenu, 800);
        setTimeout(setupInstructionMenu, 200);
        setTimeout(setupInstructionMenu, 800);

        // Run continuously
        setInterval(() => {
            fixSelectboxNow();
            fixSidebarToggle();
            hideSidebarNavItems();
            renameSidebarAppLabel();
            setupUserMenu();
            setupInstructionMenu();
        }, 200);

        // Watch for changes
        new MutationObserver(() => {
            fixSelectboxNow();
            fixSidebarToggle();
            hideSidebarNavItems();
            renameSidebarAppLabel();
            setupUserMenu();
            setupInstructionMenu();
        }).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    })();
    </script>
    """, unsafe_allow_html=True)

    st.markdown("""
    <script>
    (function() {
        function ensureScrollTopButton() {
            let button = document.querySelector('.scroll-top-button');
            if (!button) {
                button = document.createElement('button');
                button.className = 'scroll-top-button';
                button.type = 'button';
                button.innerHTML = '\u2191';
                button.setAttribute('aria-label', 'Scroll to top');
                button.setAttribute(
                    'style',
                    [
                        'position:fixed',
                        'right:1.2rem',
                        'bottom:1.2rem',
                        'width:42px',
                        'height:42px',
                        'border-radius:0',
                        'background:#3fdb74',
                        'border:1px solid #32c964',
                        'color:#0f172a',
                        'display:flex',
                        'align-items:center',
                        'justify-content:center',
                        'font-size:1.1rem',
                        'cursor:pointer',
                        'z-index:10010',
                        'box-shadow:0 6px 12px rgba(0,0,0,0.25)',
                        'opacity:1',
                        'pointer-events:auto'
                    ].join(';')
                );
                button.addEventListener('click', () => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                document.body.appendChild(button);
            }
            return button;
        }

        function toggleScrollTopButton() {
            const button = ensureScrollTopButton();
            button.classList.add('is-visible');
        }

        ensureScrollTopButton();
        toggleScrollTopButton();
        window.addEventListener('scroll', toggleScrollTopButton, { passive: true });
        window.addEventListener('resize', toggleScrollTopButton);
        setInterval(toggleScrollTopButton, 500);
    })();
    </script>
    """, unsafe_allow_html=True)

    st.markdown(
        '<div id="top"></div>'
        '<a id="scroll-top-anchor" class="scroll-top-button" href="#top" '
        'style="position:fixed;right:1.2rem;bottom:1.2rem;width:42px;height:42px;'
        'display:flex;align-items:center;justify-content:center;'
        'background:#3fdb74;border:1px solid #32c964;color:#0f172a;'
        'font-size:1.1rem;text-decoration:none;z-index:10010;'
        'box-shadow:0 6px 12px rgba(0,0,0,0.25);">↑</a>',
        unsafe_allow_html=True
    )


def render_app_footer():
    """Render the shared footer card used across pages."""
    st.markdown(
        """
        <div class="app-footer">
            <div class="app-footer-card">
                <div class="app-footer-title">SEO Rank Tracker</div>
                <div class="app-footer-subtitle">Built with Streamlit | Version 2.0 | Modern UI Edition</div>
            </div>
        </div>
        <div class="app-footer-spacer"></div>
        """,
        unsafe_allow_html=True
    )


def render_metric_card(label, value, delta=None, color="primary"):
    """Render a modern metric card with gradient background"""

    color_classes = {
        "primary": "",
        "success": "metric-success",
        "warning": "metric-warning",
        "danger": "metric-danger",
        "info": "metric-info"
    }

    color_class = color_classes.get(color, "")
    delta_html = ""

    if delta is not None:
        delta_color = "#10b981" if delta >= 0 else "#ef4444"
        delta_symbol = "+" if delta >= 0 else "-"
        delta_html = f'<div class="card-subtitle" style="color: {delta_color};">{delta_symbol}{abs(delta)}</div>'

    html = f"""
    <div class="metric-card {color_class}" style="margin-bottom: 0.75rem;">
        <div class="card-kicker">{label}</div>
        <div class="card-value">{value}</div>
        {delta_html}
    </div>
    """

    st.markdown(html, unsafe_allow_html=True)


def render_project_card(project_name, location, keyword_count, is_selected=False, icon="WEB"):
    """Render a modern project card"""

    selected_class = "selected" if is_selected else ""

    html = f"""
    <div class="project-card {selected_class}">
        <div class="project-card-header">
            <div class="project-icon">{icon}</div>
            <div>
                <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">{project_name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Location: {location}</div>
            </div>
        </div>
        <div style="display: flex; gap: 12px; margin-top: 8px;">
            <div class="badge badge-info">{keyword_count} Keywords</div>
        </div>
    </div>
    """

    return html


def render_stat_card(title, value, subtitle=None):
    """Render a stat card with modern design"""

    subtitle_html = f'<div class="card-subtitle">{subtitle}</div>' if subtitle else ""

    html = f"""
    <div class="stat-card">
        <div class="card-kicker">{title}</div>
        <div class="card-value">{value}</div>
        {subtitle_html}
    </div>
    """

    st.markdown(html, unsafe_allow_html=True)


def render_badge(text, type="info"):
    """Render a badge"""

    badge_class = f"badge badge-{type}"

    html = f'<span class="{badge_class}">{text}</span>'

    return html


def render_timeline_item(title, description, timestamp, is_success=True):
    """Render a timeline item"""

    icon = "OK" if is_success else "ERR"

    html = f"""
    <div class="timeline-item">
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 2px; font-size: 0.95rem;">{icon} {title}</div>
        <div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 2px;">{description}</div>
        <div style="color: var(--text-muted); font-size: 0.7rem;">{timestamp}</div>
    </div>
    """

    st.markdown(html, unsafe_allow_html=True)


def render_gradient_text(text):
    """Render gradient text"""

    html = f'<h1 class="gradient-text">{text}</h1>'

    st.markdown(html, unsafe_allow_html=True)


def render_glass_card(content):
    """Render a glassmorphism card"""

    html = f"""
    <div class="glass-card">
        {content}
    </div>
    """

    st.markdown(html, unsafe_allow_html=True)


def show_loading_animation(text="Loading..."):
    """Show a custom loading animation"""

    html = f"""
    <div style="display: flex; align-items: center; gap: 12px; padding: 20px;">
        <div class="shimmer" style="width: 100%; height: 60px; border-radius: 10px;"></div>
    </div>
    <div style="text-align: center; color: var(--text-muted); font-size: 0.875rem;">{text}</div>
    """

    return html


def render_header_with_subtitle(title, subtitle, icon="", user_label=None, menu_key="header"):
    """Render a modern page header."""

    icon_html = f"{icon} " if icon else ""
    left_html = f"""
    <div class="page-header">
        <div>
            <div class="page-title">{icon_html}{title}</div>
            <div class="page-subtitle">{subtitle}</div>
        </div>
    </div>
    """
    st.markdown(left_html, unsafe_allow_html=True)
    return None


def render_section_header(title, icon="", description=""):
    """Render a section header"""

    icon_html = f"{icon} " if icon else ""
    desc_html = f'<div class="section-subtitle">{description}</div>' if description else ""

    html = f"""
    <div class="section-header">
        <div class="section-title">{icon_html}{title}</div>
        {desc_html}
    </div>
    """

    st.markdown(html, unsafe_allow_html=True)


@contextmanager
def section_panel(title="", icon="", description=""):
    """Context manager for a section panel container."""
    with st.container():
        st.markdown("<div class='section-panel-marker'></div>", unsafe_allow_html=True)
        if title:
            render_section_header(title, icon, description)
        yield


@contextmanager
def sub_panel(title="", description=""):
    """Context manager for an inner card panel."""
    with st.container():
        st.markdown("<div class='sub-panel-marker'></div>", unsafe_allow_html=True)
        if title:
            st.markdown(f"<div class='sub-panel-title'>{title}</div>", unsafe_allow_html=True)
        if description:
            st.markdown(f"<div class='sub-panel-subtitle'>{description}</div>", unsafe_allow_html=True)
        yield


def render_info_box(content, type="info"):
    """Render an info box with icon"""

    box_class = f"info-box info-box--{type}"

    html = f"""
    <div class="{box_class}">
        <div class="info-box-content">{content}</div>
    </div>
    """

    st.markdown(html, unsafe_allow_html=True)


def render_progress_bar(percentage, label="", color="primary"):
    """Render a custom progress bar"""

    colors = {
        "primary": "linear-gradient(90deg, var(--accent), #7bd1ff)",
        "success": "linear-gradient(90deg, #34e06f, #1fd79a)",
        "warning": "linear-gradient(90deg, #fbbf24, #fde68a)",
        "danger": "linear-gradient(90deg, #ff5d6c, #ff9aa7)"
    }

    gradient = colors.get(color, colors["primary"])

    html = f"""
    <div style="margin: 0.75rem 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">{label}</span>
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--accent);">{percentage}%</span>
        </div>
        <div style="background: #1f2531; border-radius: 8px; height: 10px; overflow: hidden;">
            <div style="background: {gradient}; width: {percentage}%; height: 100%; border-radius: 8px; transition: width 0.5s ease;"></div>
        </div>
    </div>
    """

    st.markdown(html, unsafe_allow_html=True)


def render_sidebar_projects(active_only: bool = False):
    """Render project list in the sidebar for quick access."""
    return
    from collections import defaultdict
    from database.models import get_all_projects

    projects = get_all_projects(active_only=active_only)
    if not projects:
        return

    project_groups = defaultdict(list)
    for project in projects:
        project_groups[project["url"]].append(project)

    with st.sidebar:
        st.markdown("<div class='sidebar-title'>Projects</div>", unsafe_allow_html=True)

        for base_url in sorted(project_groups.keys()):
            variants = sorted(project_groups[base_url], key=lambda x: x["name"])
            with st.expander(base_url, expanded=False):
                for project in variants:
                    label = f"{project['name']} ({project['target_location']})"
                    if st.button(
                        label,
                        key=f"sidebar_project_{project['id']}",
                        use_container_width=True,
                        type="secondary"
                    ):
                        st.session_state.active_project_id = project["id"]
                        st.session_state.sidebar_project_id = project["id"]
                        st.switch_page("pages/_9_\U0001F4CC_Project_Dashboard.py")


def resolve_project_selection(projects, selected_project_id=None):
    """Return grouped projects and default selections for project pickers."""
    project_groups = defaultdict(list)
    for project in projects:
        project_groups[project["url"]].append(project)

    sorted_base_urls = sorted(project_groups.keys())
    default_base_url = sorted_base_urls[0] if sorted_base_urls else None
    default_variant_name = None
    selected_project = None

    if default_base_url:
        default_variant_name = sorted(
            project_groups[default_base_url], key=lambda x: x["name"]
        )[0]["name"]

    if selected_project_id:
        selected_project = next(
            (p for p in projects if p["id"] == selected_project_id), None
        )
        if selected_project:
            default_base_url = selected_project["url"]
            default_variant_name = selected_project["name"]

    return project_groups, sorted_base_urls, default_base_url, default_variant_name, selected_project
