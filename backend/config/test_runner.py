from django.test.runner import DiscoverRunner
from django.db import connections


class NeonTestRunner(DiscoverRunner):
    """
    Custom test runner for Neon PostgreSQL.
    Terminates lingering pooled/idle connections to the test database
    before dropping it during teardown, preventing PostgreSQL ObjectInUse errors.
    """

    def teardown_databases(self, old_config, **kwargs):
        if not self.keepdb:
            for alias in connections:
                connection = connections[alias]
                if connection.vendor == "postgresql":
                    try:
                        test_db_name = connection.creation._get_test_db_name()
                        with connection._nodb_cursor() as cursor:
                            cursor.execute(
                                """
                                SELECT pg_terminate_backend(pid)
                                FROM pg_stat_activity
                                WHERE datname = %s AND pid <> pg_backend_pid();
                                """,
                                [test_db_name],
                            )
                    except Exception:
                        pass
        super().teardown_databases(old_config, **kwargs)
