import os
import django

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import connection
from django.contrib.auth.models import User

def main():
    print("--- 1. Testing Raw Neon Connection ---")
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database(), current_user, version();")
        db_name, db_user, version = cursor.fetchone()
        print(f"Connected Database: {db_name}")
        print(f"Connected DB User:  {db_user}")
        print(f"PostgreSQL Version: {version.split()[0]} {version.split()[1]}")

        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;")
        tables = [r[0] for r in cursor.fetchall()]
        print(f"\n--- 2. Verifying Migrated Public Tables ({len(tables)}) ---")
        for t in tables:
            print(f"  [table] {t}")

    print("\n--- 3. Testing Django ORM Operations (CRUD) ---")
    test_user, created = User.objects.get_or_create(
        username="neon_verification_user",
        defaults={"email": "neon_verify@marginwatch.internal", "first_name": "Neon", "last_name": "Verifier"}
    )
    print(f"ORM Create/Get: User ID={test_user.id}, Username={test_user.username}, Created={created}")

    fetched_user = User.objects.get(username="neon_verification_user")
    print(f"ORM Read: Successfully retrieved {fetched_user.email}")

    fetched_user.delete()
    print("ORM Delete: Verification user cleaned up successfully.")

    print("\n--- 4. End-to-End Status ---")
    print("SUCCESS: Neon PostgreSQL is fully wired, migrated, and functional with Django ORM!")

if __name__ == "__main__":
    main()
