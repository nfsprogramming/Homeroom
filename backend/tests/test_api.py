import atexit
import os
from pathlib import Path
import tempfile
import unittest

os.environ.setdefault("CORS_ORIGINS", "http://testserver")
_database_dir = tempfile.TemporaryDirectory()
atexit.register(_database_dir.cleanup)
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_database_dir.name) / 'test.db'}"

from fastapi.testclient import TestClient

from backend.app.main import Base, app, engine

atexit.register(engine.dispose)


class AttendanceApiTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.client = TestClient(app)
        self.origin = {"Origin": "http://testserver"}

    def tearDown(self):
        self.client.close()

    def register(self, email: str, school: str):
        response = self.client.post(
            "/api/v1/auth/register",
            headers=self.origin,
            json={
                "school_name": school,
                "email": email,
                "password": "a-long-test-password-123",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()["csrf_token"]

    def create_class(self, csrf: str, name: str = "Math"):
        return self.client.post(
            "/api/v1/classes",
            headers={**self.origin, "X-CSRF-Token": csrf},
            json={"name": name, "grade": "8A", "room": "2"},
        )

    def test_school_data_is_private_and_attendance_persists(self):
        csrf = self.register("owner@example.com", "North School")
        classroom = self.create_class(csrf).json()
        student = self.client.post(
            f"/api/v1/classes/{classroom['id']}/students",
            headers={**self.origin, "X-CSRF-Token": csrf},
            json={"first_name": "Ari", "last_name": "Example"},
        ).json()
        response = self.client.put(
            "/api/v1/attendance",
            headers={**self.origin, "X-CSRF-Token": csrf},
            json={
                "date": "2026-10-27",
                "marks": [{"student_id": student["id"], "status": "present"}],
            },
        )
        self.assertEqual(response.status_code, 204)

        other_client = TestClient(app)
        other_user = other_client.post(
            "/api/v1/auth/register",
            headers=self.origin,
            json={
                "school_name": "South School",
                "email": "other@example.com",
                "password": "another-long-password-456",
            },
        )
        self.assertEqual(other_user.status_code, 201)
        other_csrf = other_user.json()["csrf_token"]
        private_snapshot = other_client.get("/api/v1/snapshot")
        self.assertEqual(private_snapshot.status_code, 200)
        self.assertEqual(private_snapshot.json(), {"classes": [], "students": [], "records": []})
        denied_delete = other_client.delete(
            f"/api/v1/classes/{classroom['id']}",
            headers={**self.origin, "X-CSRF-Token": other_csrf},
        )
        self.assertEqual(denied_delete.status_code, 404)

        saved = self.client.get("/api/v1/snapshot")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["records"][0]["status"], "present")
        other_client.close()

    def test_mutations_require_csrf(self):
        blocked_registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "school_name": "Untrusted School",
                "email": "untrusted@example.com",
                "password": "another-long-password-456",
            },
        )
        self.assertEqual(blocked_registration.status_code, 403)

        self.register("csrf@example.com", "Test School")
        response = self.client.post(
            "/api/v1/classes",
            headers=self.origin,
            json={"name": "Math", "grade": "8A"},
        )
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
