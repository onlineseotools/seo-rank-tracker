"""SERP API integrations for rank checking"""
import requests
from requests.auth import HTTPBasicAuth
from bs4 import BeautifulSoup
from urllib.parse import quote_plus, urlparse
from typing import Dict, Optional
import config


def extract_domain(url: str) -> str:
    """Extract domain from URL"""
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    return parsed.netloc.replace('www.', '')


def check_rank_serper(keyword: str, location: str, target_domain: str, api_key: str) -> Dict:
    """Check rank using Serper.dev API"""
    try:
        target_domain = extract_domain(target_domain)

        response = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": keyword, "location": location, "num": 100},
            timeout=30
        )

        if response.status_code != 200:
            return {"position": None, "url": None, "error": f"API error: {response.status_code}"}

        data = response.json()

        for idx, item in enumerate(data.get("organic", []), start=1):
            link = item.get("link", "")
            if target_domain in extract_domain(link):
                return {"position": idx, "url": link, "error": None}

        return {"position": None, "url": None, "error": None}  # Not in top 100

    except Exception as e:
        return {"position": None, "url": None, "error": str(e)}


def check_rank_dataforseo(keyword: str, location: str, target_domain: str,
                          username: str, password: str) -> Dict:
    """Check rank using DataForSEO API"""
    try:
        target_domain = extract_domain(target_domain)

        response = requests.post(
            "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
            auth=HTTPBasicAuth(username, password),
            json=[{
                "keyword": keyword,
                "location_name": location,
                "language_name": "English",
                "depth": 100
            }],
            timeout=90
        )

        if response.status_code != 200:
            error_msg = f"API error {response.status_code}"
            try:
                error_data = response.json()
                if 'status_message' in error_data:
                    error_msg += f": {error_data['status_message']}"
            except:
                pass
            return {"position": None, "url": None, "error": error_msg}

        data = response.json()

        tasks = data.get("tasks", [])
        if not tasks:
            return {"position": None, "url": None, "error": "No results from API"}

        items = tasks[0].get("result", [{}])[0].get("items", [])

        for item in items:
            if item.get("type") == "organic":
                url = item.get("url", "")
                if target_domain in extract_domain(url):
                    position = item.get("rank_absolute")
                    return {"position": position, "url": url, "error": None}

        return {"position": None, "url": None, "error": None}

    except Exception as e:
        return {"position": None, "url": None, "error": str(e)}


def check_rank_scrapingrobot(keyword: str, location: str, target_domain: str,
                             api_key: str) -> Dict:
    """Check rank using ScrapingRobot API"""
    try:
        target_domain = extract_domain(target_domain)

        # Map location to Google country code
        gl = config.LOCATION_CODES.get(location, "us")

        google_url = f"https://www.google.com/search?q={quote_plus(keyword)}&num=100&gl={gl}"

        response = requests.get(
            "https://api.scrapingrobot.com/",
            params={"token": api_key, "url": google_url, "render": "false"},
            timeout=30
        )

        if response.status_code != 200:
            return {"position": None, "url": None, "error": f"API error: {response.status_code}"}

        soup = BeautifulSoup(response.text, "html.parser")

        # Find all organic result links
        position = 1
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")

            # Filter out Google's own links
            if "/url?q=" in href:
                # Extract actual URL from Google redirect
                actual_url = href.split("/url?q=")[1].split("&")[0]

                if target_domain in extract_domain(actual_url):
                    return {"position": position, "url": actual_url, "error": None}

                position += 1

                if position > 100:
                    break

        return {"position": None, "url": None, "error": None}

    except Exception as e:
        return {"position": None, "url": None, "error": str(e)}


def test_api_connection(api_type: str, **credentials) -> Dict[str, any]:
    """Test API connection with a simple query"""
    try:
        test_keyword = "SEO"
        test_location = "United States"

        if api_type == "serper":
            result = check_rank_serper(
                test_keyword,
                test_location,
                "example.com",
                credentials.get("api_key")
            )
        elif api_type == "dataforseo":
            result = check_rank_dataforseo(
                test_keyword,
                test_location,
                "example.com",
                credentials.get("username"),
                credentials.get("password")
            )
        elif api_type == "scrapingrobot":
            result = check_rank_scrapingrobot(
                test_keyword,
                test_location,
                "example.com",
                credentials.get("api_key")
            )
        else:
            return {"success": False, "message": "Unknown API type"}

        if result.get("error"):
            return {"success": False, "message": result["error"]}

        return {"success": True, "message": "Connection successful"}

    except Exception as e:
        return {"success": False, "message": str(e)}
