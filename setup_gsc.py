"""
Google Search Console OAuth Setup Helper
Run this script once to authenticate with Google Search Console
"""
import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']
TOKEN_PATH = 'credentials/gsc_token.pickle'
CLIENT_SECRETS_PATH = 'credentials/client_secrets.json'

def setup_gsc_auth():
    """Interactive GSC authentication"""
    print("=" * 60)
    print("Google Search Console Authentication Setup")
    print("=" * 60)
    print()

    # Check if client_secrets.json exists
    if not os.path.exists(CLIENT_SECRETS_PATH):
        print("❌ ERROR: client_secrets.json not found!")
        print()
        print("You need to create OAuth credentials first.")
        print()
        print("STEP-BY-STEP GUIDE:")
        print()
        print("1. Go to: https://console.cloud.google.com")
        print()
        print("2. Select your project (or create new one)")
        print()
        print("3. Enable Google Search Console API:")
        print("   - Go to 'APIs & Services' > 'Library'")
        print("   - Search for 'Google Search Console API'")
        print("   - Click 'Enable'")
        print()
        print("4. Create OAuth Credentials:")
        print("   - Go to 'APIs & Services' > 'Credentials'")
        print("   - Click '+ CREATE CREDENTIALS'")
        print("   - Select 'OAuth client ID'")
        print("   - Application type: 'Desktop app'")
        print("   - Name: 'SEO Rank Tracker'")
        print("   - Click 'Create'")
        print()
        print("5. Download the JSON:")
        print("   - Click the download button (⬇)")
        print("   - Save as 'client_secrets.json'")
        print("   - Put it in the 'credentials' folder")
        print()
        print("6. Run this script again!")
        print()
        return False

    print("✅ Found client_secrets.json")
    print()

    # Check if already authenticated
    creds = None
    if os.path.exists(TOKEN_PATH):
        print("📁 Found existing authentication token")
        with open(TOKEN_PATH, 'rb') as token:
            creds = pickle.load(token)

    # Refresh or authenticate
    if creds and creds.valid:
        print("✅ Already authenticated and valid!")
        print()
        print("You're all set! Google Search Console is connected.")
        return True

    if creds and creds.expired and creds.refresh_token:
        print("🔄 Refreshing expired token...")
        try:
            creds.refresh(Request())
            print("✅ Token refreshed!")
        except Exception as e:
            print(f"❌ Failed to refresh: {e}")
            print("Will re-authenticate...")
            creds = None

    if not creds:
        print("🔐 Starting authentication flow...")
        print()
        print("WHAT WILL HAPPEN:")
        print("1. Your browser will open")
        print("2. Log in to your Google account")
        print("3. Grant access to Search Console")
        print("4. Return here when done")
        print()
        input("Press ENTER to continue...")
        print()

        try:
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRETS_PATH, SCOPES
            )
            creds = flow.run_local_server(port=0)

            print("✅ Authentication successful!")

        except Exception as e:
            print(f"❌ Authentication failed: {e}")
            return False

    # Save credentials
    os.makedirs('credentials', exist_ok=True)
    with open(TOKEN_PATH, 'wb') as token:
        pickle.dump(creds, token)

    print("💾 Credentials saved!")
    print()
    print("=" * 60)
    print("🎉 SETUP COMPLETE!")
    print("=" * 60)
    print()
    print("Google Search Console is now connected.")
    print("You can now use the GSC Admin features in the app.")
    print()
    return True


if __name__ == "__main__":
    success = setup_gsc_auth()

    if success:
        print("\n✅ Next steps:")
        print("1. Run the app: python -m streamlit run app.py")
        print("2. Go to 'GSC Admin' page")
        print("3. Select a project and fetch data")
        print()
    else:
        print("\n⚠️ Setup incomplete. Follow the instructions above.")
        print()
