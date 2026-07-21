import os
import urllib.parse
# We will use pg8000 or similar if installed, but wait, we don't have psycopg2.
# Let's write a python script that tries to install psycopg2-binary, then run the query.
import subprocess
import sys

def install_and_run():
    print("Installing psycopg2-binary...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    
    import psycopg2
    
    projectId = 'zlcdhksjnaglrlkcrujr'
    dbPass = 'UwxZD6pXiRuBEBeN'
    host = 'aws-1-us-east-1.pooler.supabase.com'
    user = f'postgres.{projectId}'
    name = 'postgres'
    port = '6543'

    conn_str = f"postgresql://{user}:{dbPass}@{host}:{port}/{name}?sslmode=require"

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        cur.execute("SELECT * FROM system_settings;")
        rows = cur.fetchall()
        print("SYSTEM_SETTINGS rows:")
        for r in rows:
            print(f"{r[0]}: {r[1]}")
        cur.close()
        conn.close()
    except Exception as e:
        print("Error connecting to database:", e)

if __name__ == '__main__':
    install_and_run()
