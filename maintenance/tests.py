import json
import os
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.test import SimpleTestCase

from maintenance import views


class NotificationStorageTests(SimpleTestCase):
    def test_reads_legacy_state_when_configured_volume_is_empty(self):
        notification = {
            "notification_id": "existing-notification",
            "message": "Maintenance is scheduled.",
            "triggered_at": "2026-11-02T15:00:00+00:00",
        }

        with TemporaryDirectory() as temp_dir:
            volume_file = os.path.join(
                temp_dir, "volume", "maintenance_notification.json"
            )
            legacy_file = os.path.join(temp_dir, "maintenance_notification.json")
            with open(legacy_file, "w", encoding="utf-8") as file:
                json.dump(notification, file)

            with (
                patch.object(views, "NOTIFICATION_FILE", volume_file),
                patch.object(views, "LEGACY_NOTIFICATION_FILE", legacy_file),
            ):
                self.assertEqual(views._read_notification(), notification)
