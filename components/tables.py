"""Table display components"""
import streamlit as st
import pandas as pd
from typing import List, Dict


def format_rank_change(current: int, previous: int) -> str:
    """Format rank change with color indicator"""
    if current is None or previous is None:
        return "-"

    change = previous - current  # Positive = improved

    if change > 0:
        return f"+{change}"
    elif change < 0:
        return str(change)
    else:
        return "0"


def get_rank_change_color(current: int, previous: int) -> str:
    """Get color for rank change"""
    if current is None or previous is None:
        return "gray"

    change = previous - current

    if change > 0:
        return "green"
    elif change < 0:
        return "red"
    else:
        return "gray"


def display_keywords_table(rankings: List[Dict], show_checkboxes: bool = False) -> List[int]:
    """
    Display keywords table with rankings

    Args:
        rankings: List of ranking dicts
        show_checkboxes: Whether to show selection checkboxes

    Returns:
        List of selected keyword IDs (if show_checkboxes=True)
    """
    if not rankings:
        st.info("No keywords found")
        return []

    # Prepare data for display
    table_data = []
    for r in rankings:
        change = None
        if r.get('position') and r.get('previous_position'):
            change = r['previous_position'] - r['position']

        table_data.append({
            "ID": r.get('id'),
            "Keyword": r.get('keyword', ''),
            "Current Rank": r.get('position') or "Not Ranked",
            "Previous Rank": r.get('previous_position') or "-",
            "Change": format_rank_change(r.get('position'), r.get('previous_position')),
            "URL": r.get('url_found', '-')[:50] if r.get('url_found') else '-',
            "Last Checked": r.get('checked_at', '-')
        })

    df = pd.DataFrame(table_data)

    if show_checkboxes:
        # Use data_editor for selection
        edited_df = st.data_editor(
            df,
            column_config={
                "ID": st.column_config.NumberColumn("ID", disabled=True),
                "Change": st.column_config.TextColumn("Change"),
            },
            hide_index=True,
            use_container_width=True
        )
        return []
    else:
        # Just display
        st.dataframe(
            df.drop(columns=['ID']),
            use_container_width=True,
            hide_index=True
        )
        return []


def display_projects_table(projects: List[Dict]):
    """Display projects table with quick actions"""
    if not projects:
        st.info("No projects found")
        return

    # Prepare data
    table_data = []
    for p in projects:
        table_data.append({
            "Name": p['name'],
            "URL": p['url'],
            "Location": p['target_location'],
            "Frequency": p.get('update_frequency', 'monthly'),
            "Created": p.get('created_at', '')[:10],
            "ID": p['id']
        })

    df = pd.DataFrame(table_data)

    st.dataframe(
        df.drop(columns=['ID']),
        use_container_width=True,
        hide_index=True
    )


def display_gsc_queries_table(queries: List[Dict], show_add_button: bool = False):
    """
    Display GSC queries table

    Args:
        queries: List of query dicts
        show_add_button: Whether to show "Add to Keywords" button
    """
    if not queries:
        st.info("No queries found")
        return

    # Prepare data
    table_data = []
    for q in queries:
        table_data.append({
            "Query": q['query'],
            "Clicks": q.get('clicks', 0),
            "Impressions": q.get('impressions', 0),
            "CTR": f"{q.get('ctr', 0) * 100:.2f}%",
            "Position": round(q.get('position', 0), 1)
        })

    df = pd.DataFrame(table_data)

    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True
    )


def display_sync_log_table(logs: List[Dict]):
    """Display sync log table"""
    if not logs:
        st.info("No sync logs found")
        return

    # Prepare data
    table_data = []
    for log in logs:
        # Status indicator
        status_icon = {
            "success": "OK",
            "error": "ERR",
            "warning": "WARN"
        }.get(log.get('status', ''), "INFO")

        table_data.append({
            "Time": log.get('created_at', '')[:19],
            "Type": log.get('sync_type', ''),
            "Status": f"{status_icon} {log.get('status', '')}",
            "Message": log.get('message', '')
        })

    df = pd.DataFrame(table_data)

    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        height=400
    )


def display_top_movers_table(movers: List[Dict]):
    """Display top movers table"""
    if not movers:
        st.info("No ranking changes found")
        return

    # Prepare data
    table_data = []
    for m in movers:
        change = m.get('change', 0)
        change_icon = "UP" if change > 0 else "DOWN" if change < 0 else "-"

        table_data.append({
            "": change_icon,
            "Keyword": m['keyword'],
            "Current": m.get('position', '-'),
            "Previous": m.get('previous_position', '-'),
            "Change": f"+{change}" if change > 0 else str(change)
        })

    df = pd.DataFrame(table_data)

    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True
    )
