from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0017_remove_event_add_events_manytomany"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="form_note",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
    ]
