from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0017_remove_event_add_events_manytomany"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="event",
                    name="form_note",
                    field=models.TextField(blank=True, default=""),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE events_event "
                        "ADD COLUMN IF NOT EXISTS form_note LONGTEXT NULL"
                    ),
                    reverse_sql=(
                        "ALTER TABLE events_event "
                        "DROP COLUMN IF EXISTS form_note"
                    ),
                ),
                migrations.RunSQL(
                    sql="UPDATE events_event SET form_note = '' WHERE form_note IS NULL",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
    ]
