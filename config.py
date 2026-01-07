"""Configuration settings for SEO Rank Tracker application"""
import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).parent

# Database
DATABASE_PATH = BASE_DIR / "data" / "seo_tracker.db"

# Google credentials
RUNTIME_DIR = Path(
    os.getenv(
        "SEO_TRACKER_RUNTIME_DIR",
        Path.home() / ".streamlit" / "seo-rank-tracker"
    )
)
GOOGLE_CREDENTIALS_PATH = RUNTIME_DIR / "google_service_account.json"
GOOGLE_OAUTH_CLIENT_PATH = RUNTIME_DIR / "google_oauth_client.json"
GOOGLE_OAUTH_TOKEN_PATH = RUNTIME_DIR / "google_oauth_token.json"
GSC_TOKEN_PATH = RUNTIME_DIR / "gsc_token.pickle"
OAUTH_REDIRECT_URI = os.getenv("OAUTH_REDIRECT_URI")

# OAuth scopes (union of Sheets + Drive + Search Console)
GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.metadata",
    "https://www.googleapis.com/auth/webmasters.readonly",
]

# Legacy credential locations (pre-cloud)
LEGACY_CREDENTIALS_DIR = BASE_DIR / "credentials"
LEGACY_GOOGLE_CREDENTIALS_PATH = LEGACY_CREDENTIALS_DIR / "google_service_account.json"
LEGACY_GOOGLE_OAUTH_CLIENT_PATH = LEGACY_CREDENTIALS_DIR / "google_oauth_client.json"

# Default app password (should be changed in settings)
DEFAULT_APP_PASSWORD = "admin123"
DEFAULT_APP_USERNAME = "admin"

# API rate limits
SERP_API_DELAY = 1.5  # seconds between API calls

# Location codes mapping
LOCATION_CODES = {
    "India": "in",
    "USA": "us",
    "Global / US": "us",
    "Argentina": "ar",
    "Brasil": "br",
    "Brazil": "br",
    "Canada": "ca",
    "France": "fr",
    "Germany": "de",
    "Kenya": "ke",
    "Nigeria": "ng",
    "Switzerland": "ch",
    "Italia": "it",
    "Italy": "it",
    "Bangladesh": "bd",
    "Belgium": "be",
    "Denmark": "dk",
    "Greece": "gr",
    "Malaysia": "my",
    "Netherlands": "nl",
    "Oman": "om",
    "Spain": "es",
    "Taiwan": "tw",
    "UAE": "ae",
}

# Initial projects seed data
INITIAL_PROJECTS = [
    {"name": "Hardcastle Petrofer", "url": "hawcoindia.com", "location": "India"},
    {"name": "Jekson - Argentina", "url": "jeksonvision.com", "location": "Argentina"},
    {"name": "Jekson - Brazil", "url": "jeksonvision.com", "location": "Brasil"},
    {"name": "Jekson - Canada", "url": "jeksonvision.com", "location": "Canada"},
    {"name": "Jekson - France", "url": "jeksonvision.com", "location": "France"},
    {"name": "Jekson - Germany", "url": "jeksonvision.com", "location": "Germany"},
    {"name": "Jekson - Kenya", "url": "jeksonvision.com", "location": "Kenya"},
    {"name": "Jekson - Nigeria", "url": "jeksonvision.com", "location": "Nigeria"},
    {"name": "Jekson - Switzerland", "url": "jeksonvision.com", "location": "Switzerland"},
    {"name": "Jekson Vision", "url": "jeksonvision.com", "location": "Global / US"},
    {"name": "Jekson Vision - India", "url": "jeksonvision.com", "location": "India"},
    {"name": "Jekson Vision - Italy 1", "url": "jeksonvision.com", "location": "Italia"},
    {"name": "Organica - India", "url": "organicabiotech.com", "location": "India"},
    {"name": "Organica - New Keywords", "url": "organicabiotech.com", "location": "India"},
    {"name": "Organica Biotech - Wastewater Treatment", "url": "organicabiotech.com", "location": "India"},
    {"name": "Veeda Lifesciences", "url": "veedalifesciences.com", "location": "India"},
    {"name": "Veeda Lifesciences - Bangladesh", "url": "veedalifesciences.com", "location": "Bangladesh"},
    {"name": "Veeda Lifesciences - Belgium", "url": "veedalifesciences.com", "location": "Belgium"},
    {"name": "Veeda Lifesciences - China", "url": "veedalifesciences.com", "location": "Global / US"},
    {"name": "Veeda Lifesciences - Denmark", "url": "veedalifesciences.com", "location": "Denmark"},
    {"name": "Veeda Lifesciences - France", "url": "veedalifesciences.com", "location": "France"},
    {"name": "Veeda Lifesciences - Germany", "url": "veedalifesciences.com", "location": "Germany"},
    {"name": "Veeda Lifesciences - Greece", "url": "veedalifesciences.com", "location": "Greece"},
    {"name": "Veeda Lifesciences - Italy", "url": "veedalifesciences.com", "location": "Italia"},
    {"name": "Veeda Lifesciences - Malaysia", "url": "veedalifesciences.com", "location": "Malaysia"},
    {"name": "Veeda Lifesciences - Netherland", "url": "veedalifesciences.com", "location": "Netherlands"},
    {"name": "Veeda Lifesciences - Oman", "url": "veedalifesciences.com", "location": "Oman"},
    {"name": "Veeda Lifesciences - Spain", "url": "veedalifesciences.com", "location": "Spain"},
    {"name": "Veeda Lifesciences - Switzerland", "url": "veedalifesciences.com", "location": "Switzerland"},
    {"name": "Veeda Lifesciences - Taiwan", "url": "veedalifesciences.com", "location": "Taiwan"},
    {"name": "Veeda Lifesciences - UAE", "url": "veedalifesciences.com", "location": "UAE"},
    {"name": "Veeda Lifesciences - USA", "url": "veedalifesciences.com", "location": "Global / US"},
    {"name": "Vertex", "url": "vertexcs.com", "location": "Global / US"},
    {"name": "Vertex - New Keywords - USA", "url": "vertexcs.com", "location": "Global / US"},
    {"name": "Zydus", "url": "zyduslife.com", "location": "India", "update_frequency": "weekly"},
]
