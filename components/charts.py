"""Plotly chart components for visualization"""
import plotly.graph_objects as go
import plotly.express as px
from typing import List, Dict
import pandas as pd


def create_ranking_distribution_chart(rankings: List[Dict]) -> go.Figure:
    """
    Create bar chart showing distribution of rankings across position ranges

    Args:
        rankings: List of ranking dicts with 'position' key

    Returns:
        Plotly figure
    """
    # Define position ranges
    ranges = {
        "1-3": 0,
        "4-10": 0,
        "11-20": 0,
        "21-50": 0,
        "51-100": 0,
        "Not Ranked": 0
    }

    # Count rankings in each range
    for ranking in rankings:
        pos = ranking.get('position')

        if pos is None:
            ranges["Not Ranked"] += 1
        elif pos <= 3:
            ranges["1-3"] += 1
        elif pos <= 10:
            ranges["4-10"] += 1
        elif pos <= 20:
            ranges["11-20"] += 1
        elif pos <= 50:
            ranges["21-50"] += 1
        else:
            ranges["51-100"] += 1

    # Create bar chart
    fig = go.Figure(data=[
        go.Bar(
            x=list(ranges.keys()),
            y=list(ranges.values()),
            marker_color=['#3fdb74', '#6be59a', '#fbbf24', '#f97316', '#ff5d6c', '#94a3b8'],
            text=list(ranges.values()),
            textposition='auto'
        )
    ])

    fig.update_layout(
        title="Ranking Distribution",
        xaxis_title="Position Range",
        yaxis_title="Number of Keywords",
        template="plotly_dark",
        height=400,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font_color="#e5e7eb"
    )

    return fig


def create_trend_line_chart(ranking_history: pd.DataFrame) -> go.Figure:
    """
    Create line chart showing average position trend over time

    Args:
        ranking_history: DataFrame with 'checked_at' and 'position' columns

    Returns:
        Plotly figure
    """
    if ranking_history.empty:
        # Return empty chart
        fig = go.Figure()
        fig.update_layout(
            title="Average Position Trend",
            xaxis_title="Date",
            yaxis_title="Average Position",
            template="plotly_dark",
            height=400,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font_color="#e5e7eb",
            annotations=[{
                "text": "No ranking history available",
                "xref": "paper",
                "yref": "paper",
                "showarrow": False,
                "font": {"size": 16, "color": "gray"}
            }]
        )
        return fig

    # Group by date and calculate average position
    daily_avg = ranking_history.groupby('checked_at')['position'].mean().reset_index()
    daily_avg = daily_avg.sort_values('checked_at')

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=daily_avg['checked_at'],
        y=daily_avg['position'],
        mode='lines+markers',
        name='Average Position',
        line=dict(color='#25c1f5', width=2),
        marker=dict(size=6)
    ))

    fig.update_layout(
        title="Average Position Trend",
        xaxis_title="Date",
        yaxis_title="Average Position",
        yaxis=dict(autorange="reversed"),  # Lower position is better
        template="plotly_dark",
        height=400,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font_color="#e5e7eb",
        hovermode='x unified'
    )

    return fig


def create_keyword_trend_chart(keyword_history: List[Dict], keyword: str) -> go.Figure:
    """
    Create line chart showing position history for a single keyword

    Args:
        keyword_history: List of ranking dicts with 'checked_at' and 'position'
        keyword: Keyword name for title

    Returns:
        Plotly figure
    """
    if not keyword_history:
        fig = go.Figure()
        fig.update_layout(
            title=f"Position History: {keyword}",
            annotations=[{
                "text": "No ranking history available",
                "xref": "paper",
                "yref": "paper",
                "showarrow": False,
                "font": {"size": 16, "color": "gray"}
            }]
        )
        return fig

    dates = [r['checked_at'] for r in keyword_history]
    positions = [r['position'] if r['position'] else 101 for r in keyword_history]

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=dates,
        y=positions,
        mode='lines+markers',
        name='Position',
        line=dict(color='#25c1f5', width=2),
        marker=dict(size=8)
    ))

    fig.update_layout(
        title=f"Position History: {keyword}",
        xaxis_title="Date",
        yaxis_title="Position",
        yaxis=dict(autorange="reversed"),
        template="plotly_dark",
        height=400,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font_color="#e5e7eb",
        hovermode='x'
    )

    return fig


def create_gsc_opportunities_chart(gsc_data: pd.DataFrame) -> go.Figure:
    """
    Create scatter plot showing CTR vs Position for GSC queries

    Args:
        gsc_data: DataFrame with 'position', 'ctr', 'impressions', and 'query' columns

    Returns:
        Plotly figure
    """
    if gsc_data.empty:
        fig = go.Figure()
        fig.update_layout(
            title="CTR vs Position Analysis",
            annotations=[{
                "text": "No GSC data available",
                "xref": "paper",
                "yref": "paper",
                "showarrow": False,
                "font": {"size": 16, "color": "gray"}
            }]
        )
        return fig

    fig = px.scatter(
        gsc_data,
        x='position',
        y='ctr',
        size='impressions',
        hover_data=['query', 'clicks'],
        color='ctr',
        color_continuous_scale='RdYlGn',
        title="CTR vs Position Analysis"
    )

    fig.update_layout(
        xaxis_title="Average Position",
        yaxis_title="CTR",
        template="plotly_dark",
        height=500,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font_color="#e5e7eb"
    )

    return fig


def create_top_movers_chart(movers: List[Dict], direction: str = "both") -> go.Figure:
    """
    Create horizontal bar chart for top movers

    Args:
        movers: List of dicts with 'keyword', 'change' (positive = improvement)
        direction: "improved", "declined", or "both"

    Returns:
        Plotly figure
    """
    if not movers:
        fig = go.Figure()
        fig.update_layout(
            title="Top Movers",
            annotations=[{
                "text": "No ranking changes available",
                "xref": "paper",
                "yref": "paper",
                "showarrow": False,
                "font": {"size": 16, "color": "gray"}
            }]
        )
        return fig

    # Filter based on direction
    if direction == "improved":
        filtered = [m for m in movers if m.get('change', 0) > 0]
        title = "Top Improved Keywords"
    elif direction == "declined":
        filtered = [m for m in movers if m.get('change', 0) < 0]
        title = "Top Declined Keywords"
    else:
        filtered = movers
        title = "Top Movers"

    if not filtered:
        fig = go.Figure()
        fig.update_layout(
            title=title,
            annotations=[{
                "text": "No data available",
                "xref": "paper",
                "yref": "paper",
                "showarrow": False,
                "font": {"size": 16, "color": "gray"}
            }]
        )
        return fig

    # Sort by absolute change
    filtered = sorted(filtered, key=lambda x: abs(x.get('change', 0)), reverse=True)[:15]

    keywords = [m['keyword'] for m in filtered]
    changes = [m.get('change', 0) for m in filtered]
    colors = ['#3fdb74' if c > 0 else '#ff5d6c' for c in changes]

    fig = go.Figure(data=[
        go.Bar(
            y=keywords,
            x=changes,
            orientation='h',
            marker_color=colors,
            text=[f"+{c}" if c > 0 else str(c) for c in changes],
            textposition='auto'
        )
    ])

    fig.update_layout(
        title=title,
        xaxis_title="Position Change (+ = Improved)",
        yaxis_title="Keyword",
        template="plotly_dark",
        height=max(400, len(filtered) * 30),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font_color="#e5e7eb",
        yaxis=dict(autorange="reversed")
    )

    return fig
