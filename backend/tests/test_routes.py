"""Tests for API routes."""
import os
import tempfile
import unittest

from app import create_app


class HealthRouteTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_health_returns_200_and_ok(self):
        rv = self.client.get("/api/health")
        self.assertEqual(rv.status_code, 200)
        data = rv.get_json()
        self.assertEqual(data.get("status"), "ok")


class CompareRequiresFilesTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["UPLOAD_FOLDER"] = tempfile.mkdtemp()
        self.app.config["LOG_FOLDER"] = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.app.config["UPLOAD_FOLDER"], "mappings"), exist_ok=True)
        self.client = self.app.test_client()

    def test_compare2_without_files_returns_400(self):
        rv = self.client.post("/api/compare2")
        self.assertEqual(rv.status_code, 400)
        data = rv.get_json()
        self.assertIn("message", data)
        self.assertIn("BOM", data["message"])


class MappingsListTestCase(unittest.TestCase):
    """Test GET /api/mappings: empty folder gets 5 OOTB presets."""

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.upload = tempfile.mkdtemp()
        self.app.config["UPLOAD_FOLDER"] = self.upload
        self.app.config["LOG_FOLDER"] = tempfile.mkdtemp()
        self.client = self.app.test_client()

    def test_list_mappings_empty_folder_seeds_five_presets(self):
        mapping_dir = os.path.join(self.upload, "mappings")
        self.assertFalse(os.path.isdir(mapping_dir))  # not created yet
        rv = self.client.get("/api/mappings")
        self.assertEqual(rv.status_code, 200)
        data = rv.get_json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 5)
        names = [f["filename"] for f in data]
        self.assertIn("Default_Single_Key_Part_Material.json", names)
        self.assertIn("Default_2_Keys_Part_Plant.json", names)
        self.assertIn("Default_3_Keys_Part_Plant_Revision.json", names)
        self.assertIn("Default_4_Keys.json", names)
        self.assertIn("Default_5_Keys.json", names)
        active_count = sum(1 for f in data if f.get("active"))
        self.assertEqual(active_count, 1)

    def test_list_mappings_with_existing_files_does_not_reseed(self):
        mapping_dir = os.path.join(self.upload, "mappings")
        os.makedirs(mapping_dir, exist_ok=True)
        existing = os.path.join(mapping_dir, "custom_mapping.json")
        with open(existing, "w", encoding="utf-8") as f:
            f.write('{"mappings": [], "active": true}')
        rv = self.client.get("/api/mappings")
        self.assertEqual(rv.status_code, 200)
        data = rv.get_json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["filename"], "custom_mapping.json")


if __name__ == "__main__":
    unittest.main()
