"""Google Search Console Analytics - Advanced analysis functions"""
from typing import List, Dict, Set, Tuple
from collections import defaultdict
from datetime import datetime, timedelta
import re


def compare_query_periods(current_queries: List[Dict], previous_queries: List[Dict]) -> Dict:
    """
    Compare two periods of GSC data to find new and lost queries

    Args:
        current_queries: List of query dicts from current period
        previous_queries: List of query dicts from previous period

    Returns:
        Dict with 'new', 'lost', 'improved', 'declined' queries
    """
    current_set = {q['query'] for q in current_queries}
    previous_set = {q['query'] for q in previous_queries}

    # Build maps for position comparison
    current_map = {q['query']: q for q in current_queries}
    previous_map = {q['query']: q for q in previous_queries}

    # New queries (in current, not in previous)
    new_queries = []
    for query in current_set - previous_set:
        new_queries.append(current_map[query])

    # Lost queries (in previous, not in current)
    lost_queries = []
    for query in previous_set - current_set:
        lost_queries.append(previous_map[query])

    # Improved/declined (in both periods)
    improved = []
    declined = []
    stable = []

    for query in current_set & previous_set:
        curr = current_map[query]
        prev = previous_map[query]

        position_change = prev['position'] - curr['position']  # Positive = improved

        comparison = {
            'query': query,
            'current_position': curr['position'],
            'previous_position': prev['position'],
            'position_change': position_change,
            'current_clicks': curr['clicks'],
            'previous_clicks': prev['clicks'],
            'current_impressions': curr['impressions'],
            'previous_impressions': prev['impressions'],
            'clicks_change': curr['clicks'] - prev['clicks'],
            'impressions_change': curr['impressions'] - prev['impressions']
        }

        if position_change > 1:  # Improved by more than 1 position
            improved.append(comparison)
        elif position_change < -1:  # Declined by more than 1 position
            declined.append(comparison)
        else:
            stable.append(comparison)

    # Sort by magnitude of change
    improved.sort(key=lambda x: x['position_change'], reverse=True)
    declined.sort(key=lambda x: x['position_change'])

    return {
        'new_queries': sorted(new_queries, key=lambda x: x['impressions'], reverse=True),
        'lost_queries': sorted(lost_queries, key=lambda x: x['impressions'], reverse=True),
        'improved_queries': improved,
        'declined_queries': declined,
        'stable_queries': stable
    }


def detect_cannibalization(queries_with_pages: List[Dict], threshold: int = 2) -> List[Dict]:
    """
    Detect keyword cannibalization (multiple pages ranking for same query)

    Args:
        queries_with_pages: List of query dicts with 'query' and 'page' fields
        threshold: Minimum number of pages for same query to flag

    Returns:
        List of cannibalization cases
    """
    query_pages = defaultdict(list)

    # Group pages by query
    for item in queries_with_pages:
        query = item['query']
        page = item.get('page')

        if page:
            query_pages[query].append({
                'page': page,
                'position': item['position'],
                'clicks': item['clicks'],
                'impressions': item['impressions'],
                'ctr': item['ctr']
            })

    # Find queries with multiple pages
    cannibalization_cases = []

    for query, pages in query_pages.items():
        if len(pages) >= threshold:
            # Calculate total metrics
            total_clicks = sum(p['clicks'] for p in pages)
            total_impressions = sum(p['impressions'] for p in pages)

            # Sort pages by position (best first)
            sorted_pages = sorted(pages, key=lambda x: x['position'])

            cannibalization_cases.append({
                'query': query,
                'num_pages': len(pages),
                'pages': sorted_pages,
                'best_position': sorted_pages[0]['position'],
                'worst_position': sorted_pages[-1]['position'],
                'total_clicks': total_clicks,
                'total_impressions': total_impressions,
                'primary_page': sorted_pages[0]['page'],
                'competing_pages': [p['page'] for p in sorted_pages[1:]]
            })

    # Sort by number of pages (most problematic first)
    return sorted(cannibalization_cases, key=lambda x: x['num_pages'], reverse=True)


def group_related_queries(queries: List[Dict], similarity_threshold: float = 0.6) -> List[Dict]:
    """
    Group related queries together based on keyword overlap

    Args:
        queries: List of query dicts
        similarity_threshold: Minimum similarity score (0-1) to group

    Returns:
        List of query groups with aggregated metrics
    """
    def get_keywords(query: str) -> Set[str]:
        """Extract keywords from query"""
        # Remove common words
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
                    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                    'could', 'should', 'may', 'might', 'can', 'what', 'when', 'where',
                    'who', 'why', 'how'}

        words = re.findall(r'\b\w+\b', query.lower())
        return set(w for w in words if w not in stopwords)

    def jaccard_similarity(set1: Set, set2: Set) -> float:
        """Calculate Jaccard similarity between two sets"""
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0

    # Extract keywords for each query
    query_keywords = {q['query']: get_keywords(q['query']) for q in queries}

    # Group similar queries
    groups = []
    used_queries = set()

    for query_dict in sorted(queries, key=lambda x: x['impressions'], reverse=True):
        query = query_dict['query']

        if query in used_queries:
            continue

        # Start new group
        group_queries = [query_dict]
        used_queries.add(query)
        base_keywords = query_keywords[query]

        # Find similar queries
        for other_dict in queries:
            other_query = other_dict['query']

            if other_query in used_queries:
                continue

            other_keywords = query_keywords[other_query]
            similarity = jaccard_similarity(base_keywords, other_keywords)

            if similarity >= similarity_threshold:
                group_queries.append(other_dict)
                used_queries.add(other_query)

        # Calculate group metrics
        if group_queries:
            total_clicks = sum(q['clicks'] for q in group_queries)
            total_impressions = sum(q['impressions'] for q in group_queries)
            avg_position = sum(q['position'] * q['impressions'] for q in group_queries) / total_impressions if total_impressions > 0 else 0
            avg_ctr = total_clicks / total_impressions if total_impressions > 0 else 0

            groups.append({
                'primary_query': query,
                'query_count': len(group_queries),
                'queries': group_queries,
                'total_clicks': total_clicks,
                'total_impressions': total_impressions,
                'avg_position': round(avg_position, 1),
                'avg_ctr': avg_ctr,
                'keywords': list(base_keywords)
            })

    return sorted(groups, key=lambda x: x['total_impressions'], reverse=True)


def analyze_page_performance(queries_with_pages: List[Dict]) -> List[Dict]:
    """
    Analyze performance by page URL

    Args:
        queries_with_pages: List of query dicts with 'page' field

    Returns:
        List of page analytics
    """
    page_data = defaultdict(lambda: {
        'queries': [],
        'total_clicks': 0,
        'total_impressions': 0,
        'avg_position': 0,
        'avg_ctr': 0
    })

    # Group by page
    for item in queries_with_pages:
        page = item.get('page')
        if not page:
            continue

        page_data[page]['queries'].append(item)
        page_data[page]['total_clicks'] += item['clicks']
        page_data[page]['total_impressions'] += item['impressions']

    # Calculate averages and create result
    results = []

    for page, data in page_data.items():
        total_impr = data['total_impressions']

        # Weighted average position
        avg_pos = sum(q['position'] * q['impressions'] for q in data['queries']) / total_impr if total_impr > 0 else 0

        # Overall CTR
        avg_ctr = data['total_clicks'] / total_impr if total_impr > 0 else 0

        # Top queries for this page
        top_queries = sorted(data['queries'], key=lambda x: x['clicks'], reverse=True)[:10]

        results.append({
            'page': page,
            'query_count': len(data['queries']),
            'total_clicks': data['total_clicks'],
            'total_impressions': total_impr,
            'avg_position': round(avg_pos, 1),
            'avg_ctr': avg_ctr,
            'top_queries': top_queries
        })

    return sorted(results, key=lambda x: x['total_clicks'], reverse=True)


def find_opportunities(queries: List[Dict]) -> Dict:
    """
    Find optimization opportunities from GSC data

    Args:
        queries: List of query dicts

    Returns:
        Dict with different opportunity types
    """
    opportunities = {
        'high_impressions_low_ctr': [],
        'high_impressions_poor_position': [],
        'quick_wins': [],  # High impressions, position 11-20
        'low_hanging_fruit': []  # Position 4-10 with good impressions
    }

    for query_dict in queries:
        query = query_dict['query']
        position = query_dict['position']
        ctr = query_dict['ctr']
        impressions = query_dict['impressions']
        clicks = query_dict['clicks']

        # High impressions but low CTR (< 2%)
        if impressions > 100 and ctr < 0.02:
            opportunities['high_impressions_low_ctr'].append(query_dict)

        # High impressions but poor position (> 10)
        if impressions > 100 and position > 10:
            opportunities['high_impressions_poor_position'].append(query_dict)

        # Quick wins: Position 11-20 with good impressions
        if 11 <= position <= 20 and impressions > 500:
            opportunities['quick_wins'].append(query_dict)

        # Low hanging fruit: Position 4-10 with good impressions
        if 4 <= position <= 10 and impressions > 200:
            opportunities['low_hanging_fruit'].append(query_dict)

    # Sort each category
    for key in opportunities:
        opportunities[key] = sorted(opportunities[key], key=lambda x: x['impressions'], reverse=True)

    return opportunities


def calculate_visibility_score(queries: List[Dict]) -> float:
    """
    Calculate overall visibility score based on positions and impressions

    Args:
        queries: List of query dicts

    Returns:
        Visibility score (0-100)
    """
    if not queries:
        return 0.0

    # Weight positions (1-3 = highest value, diminishing returns after)
    position_weights = {
        1: 100, 2: 85, 3: 70, 4: 55, 5: 45, 6: 38, 7: 32, 8: 27, 9: 23, 10: 20
    }

    total_weighted_score = 0
    total_impressions = sum(q['impressions'] for q in queries)

    for query_dict in queries:
        position = query_dict['position']
        impressions = query_dict['impressions']

        # Get weight for this position
        if position <= 10:
            weight = position_weights.get(int(position), 0)
        elif position <= 20:
            weight = 15
        elif position <= 30:
            weight = 10
        elif position <= 50:
            weight = 5
        else:
            weight = 1

        # Weight by impressions
        contribution = weight * (impressions / total_impressions) if total_impressions > 0 else 0
        total_weighted_score += contribution

    return round(total_weighted_score, 2)
