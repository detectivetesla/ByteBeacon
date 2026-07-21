import psycopg2
import urllib.request
import json
import ssl

def check_datahouse():
    # 1. Fetch API Key and URL from Database
    project_id = 'zlcdhksjnaglrlkcrujr'
    db_pass = 'UwxZD6pXiRuBEBeN'
    host = 'aws-1-us-east-1.pooler.supabase.com'
    user = f'postgres.{project_id}'
    port = '6543'
    name = 'postgres'
    
    conn_str = f"postgresql://{user}:{db_pass}@{host}:{port}/{name}?sslmode=require"
    
    api_key = None
    base_url = 'https://api.getmorepaylessdatahouse.net/api/v1'
    
    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # Get active api key
        cur.execute("SELECT api_key, base_url FROM sourcing_providers WHERE slug = 'datahouse'")
        row = cur.fetchone()
        if row:
            api_key = row[0]
            if row[1]:
                base_url = row[1]
        
        if not api_key:
            cur.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'datahouse_api_key'")
            row = cur.fetchone()
            if row:
                api_key = row[0]
                
        cur.close()
        conn.close()
    except Exception as e:
        print("Database error:", e)
        return

    print("Datahouse API Key:", api_key)
    print("Datahouse Base URL:", base_url)
    
    if not api_key:
        print("No API Key found!")
        return

    # Identifiers to test
    identifiers = [
        "74ab2c02-d0a7-48ae-bb56-f361fdea341a", # UUID
        "ord_01KWF9SVQVATHAHYVQH75QG95P",      # Public ID
        "TXN-6E9ABDA72C2E"                     # Reference Code
    ]
    
    # Disable SSL verification for test environment if needed
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    for identifier in identifiers:
        url = f"{base_url}/agent/orders/{identifier}"
        print(f"\nTesting request to: {url}")
        req = urllib.request.Request(
            url,
            headers={
                'x-api-key': api_key,
                'Accept': 'application/json'
            },
            method='GET'
        )
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                status = response.getcode()
                body = response.read().decode('utf-8')
                print(f"Response status: {status}")
                print(f"Response body: {body[:300]}...")
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == '__main__':
    check_datahouse()
