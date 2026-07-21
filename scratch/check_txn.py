import psycopg2
import json

def check_txn():
    # Credentials from database.js
    project_id = 'zlcdhksjnaglrlkcrujr'
    db_pass = 'UwxZD6pXiRuBEBeN'
    host = 'aws-1-us-east-1.pooler.supabase.com'
    user = f'postgres.{project_id}'
    port = '6543'
    name = 'postgres'
    
    conn_str = f"postgresql://{user}:{db_pass}@{host}:{port}/{name}?sslmode=require"
    
    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # Search by reference, or query last 10 transactions to inspect format
        cur.execute("""
            SELECT id, recipient_phone, amount_ghc, status, created_at, updated_at, 
                   serial_id, balance_before, balance_after, source, paid, source_provider, 
                   api_response, failure_reason
            FROM transactions 
            WHERE id::text LIKE '%TXN-6E9ABDA72C2E%' 
               OR api_response::text LIKE '%TXN-6E9ABDA72C2E%' 
               OR failure_reason LIKE '%TXN-6E9ABDA72C2E%'
        """)
        
        rows = cur.fetchall()
        
        colnames = [desc[0] for desc in cur.description]
        results = []
        for r in rows:
            row_dict = {}
            for i, col in enumerate(colnames):
                val = r[i]
                if col == 'api_response' and isinstance(val, dict):
                    row_dict[col] = val
                elif col == 'api_response' and isinstance(val, str):
                    try:
                        row_dict[col] = json.loads(val)
                    except:
                        row_dict[col] = val
                elif hasattr(val, 'isoformat'):
                    row_dict[col] = val.isoformat()
                else:
                    row_dict[col] = val
            results.append(row_dict)
            
        print("--- FOUND TRANSACTIONS MATCHING TXN-6E9ABDA72C2E ---")
        print(json.dumps(results, indent=2, default=str))
        
        if not results:
            print("\nNo transaction matched. Fetching the last 5 transactions to inspect:")
            cur.execute("""
                SELECT id, recipient_phone, amount_ghc, status, created_at, source_provider, api_response
                FROM transactions 
                ORDER BY created_at DESC 
                LIMIT 5
            """)
            rows = cur.fetchall()
            colnames = [desc[0] for desc in cur.description]
            last_5 = []
            for r in rows:
                row_dict = {}
                for i, col in enumerate(colnames):
                    val = r[i]
                    if hasattr(val, 'isoformat'):
                        row_dict[col] = val.isoformat()
                    else:
                        row_dict[col] = val
                last_5.append(row_dict)
            print(json.dumps(last_5, indent=2, default=str))
            
        cur.close()
        conn.close()
    except Exception as e:
        print("Error connecting/querying:", e)

if __name__ == '__main__':
    check_txn()
