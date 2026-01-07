"""Rank checking orchestration"""
import time
from datetime import date
from typing import List, Dict, Callable, Optional
from database.models import (
    get_project_by_id, get_keywords_by_project, create_ranking,
    get_latest_ranking, add_sync_log
)
from services.serp_api import (
    check_rank_serper, check_rank_dataforseo, check_rank_scrapingrobot
)
import config


def check_project_rankings(
    project_id: int,
    api_type: str,
    api_credentials: Dict,
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> Dict[str, any]:
    """
    Check rankings for all keywords in a project

    Args:
        project_id: Project ID
        api_type: API to use ('serper', 'dataforseo', 'scrapingrobot')
        api_credentials: API credentials dict
        progress_callback: Optional callback(current, total, keyword) for progress updates

    Returns:
        Dict with results summary
    """
    try:
        # Get project details
        project = get_project_by_id(project_id)
        if not project:
            return {"success": False, "error": "Project not found"}

        # Get keywords
        keywords = get_keywords_by_project(project_id)
        if not keywords:
            return {"success": False, "error": "No keywords found for this project"}

        total_keywords = len(keywords)
        checked_count = 0
        success_count = 0
        error_count = 0
        errors = []

        target_domain = project['url']
        location = project['target_location']
        checked_date = date.today()

        # Select API function
        if api_type == 'serper':
            check_func = lambda kw: check_rank_serper(
                kw, location, target_domain, api_credentials.get('api_key')
            )
        elif api_type == 'dataforseo':
            check_func = lambda kw: check_rank_dataforseo(
                kw, location, target_domain,
                api_credentials.get('username'),
                api_credentials.get('password')
            )
        elif api_type == 'scrapingrobot':
            check_func = lambda kw: check_rank_scrapingrobot(
                kw, location, target_domain, api_credentials.get('api_key')
            )
        else:
            return {"success": False, "error": f"Unknown API type: {api_type}"}

        # Check each keyword
        for idx, keyword_row in enumerate(keywords):
            keyword_id = keyword_row['id']
            keyword_text = keyword_row['keyword']

            # Update progress
            if progress_callback:
                progress_callback(idx + 1, total_keywords, keyword_text)

            try:
                # Get previous ranking
                previous_ranking = get_latest_ranking(keyword_id)
                previous_position = previous_ranking['position'] if previous_ranking else None

                # Check rank via API
                result = check_func(keyword_text)

                if result.get('error'):
                    errors.append(f"{keyword_text}: {result['error']}")
                    error_count += 1
                else:
                    # Save ranking to database
                    create_ranking(
                        keyword_id=keyword_id,
                        position=result.get('position'),
                        url_found=result.get('url'),
                        checked_at=checked_date,
                        api_used=api_type,
                        previous_position=previous_position
                    )
                    success_count += 1

                checked_count += 1

                # Delay between API calls to avoid rate limiting
                if idx < total_keywords - 1:  # Don't delay after last keyword
                    time.sleep(config.SERP_API_DELAY)

            except Exception as e:
                errors.append(f"{keyword_text}: {str(e)}")
                error_count += 1

        # Log results
        if success_count > 0:
            add_sync_log(
                project_id, "rank_check", "success",
                f"Checked {success_count}/{total_keywords} keywords using {api_type}"
            )

        if error_count > 0:
            add_sync_log(
                project_id, "rank_check", "warning",
                f"Failed to check {error_count} keywords"
            )

        return {
            "success": True,
            "total": total_keywords,
            "checked": checked_count,
            "success": success_count,
            "errors": error_count,
            "error_details": errors[:10]  # Limit error details to first 10
        }

    except Exception as e:
        add_sync_log(
            project_id, "rank_check", "error",
            f"Rank check failed: {str(e)}"
        )
        return {"success": False, "error": str(e)}


def estimate_check_cost(keyword_count: int, api_type: str) -> Dict[str, any]:
    """
    Estimate cost and time for rank checking

    Args:
        keyword_count: Number of keywords to check
        api_type: API type

    Returns:
        Dict with cost and time estimates
    """
    # API costs (approximate, per search)
    costs = {
        'serper': 0.001,  # $1 per 1000 searches
        'dataforseo': 0.0025,  # ~$2.5 per 1000 searches
        'scrapingrobot': 0.0018  # ~$1.8 per 1000 searches
    }

    cost_per_search = costs.get(api_type, 0)
    total_cost = keyword_count * cost_per_search

    # Time estimate (includes API delay)
    time_per_keyword = config.SERP_API_DELAY + 0.5  # API delay + processing time
    total_time_seconds = keyword_count * time_per_keyword
    total_time_minutes = total_time_seconds / 60

    return {
        "total_cost": round(total_cost, 2),
        "cost_currency": "USD",
        "estimated_time_minutes": round(total_time_minutes, 1),
        "estimated_time_formatted": format_duration(total_time_seconds)
    }


def format_duration(seconds: float) -> str:
    """Format duration in seconds to human-readable format"""
    if seconds < 60:
        return f"{int(seconds)} seconds"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
    else:
        hours = int(seconds / 3600)
        minutes = int((seconds % 3600) / 60)
        return f"{hours}h {minutes}m"


def get_api_credentials(api_type: str) -> Dict[str, str]:
    """
    Get API credentials from settings

    Args:
        api_type: API type ('serper', 'dataforseo', 'scrapingrobot')

    Returns:
        Dict with credentials
    """
    from database.models import get_setting

    if api_type == 'serper':
        return {"api_key": get_setting("serper_api_key") or ""}
    elif api_type == 'dataforseo':
        return {
            "username": get_setting("dataforseo_username") or "",
            "password": get_setting("dataforseo_password") or ""
        }
    elif api_type == 'scrapingrobot':
        return {"api_key": get_setting("scrapingrobot_api_key") or ""}
    else:
        return {}
