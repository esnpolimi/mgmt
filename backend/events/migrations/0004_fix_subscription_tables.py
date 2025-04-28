from django.db import migrations, models


def create_tables_and_link_subscriptions(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    EventTable = apps.get_model('events', 'EventTable')
    Subscription = apps.get_model('events', 'Subscription')

    # Create a default table for each event
    for event in Event.objects.all():
        # Check if the event already has a table
        if not EventTable.objects.filter(event=event).exists():
            table = EventTable.objects.create(
                event=event,
                name="Default Table",
                capacity=0  # Unlimited capacity
            )
        else:
            table = EventTable.objects.filter(event=event).first()

        # Link all subscriptions that have null table values
        Subscription.objects.filter(event=event, table__isnull=True).update(table=table)

class Migration(migrations.Migration):
    dependencies = [
        ('events', '0003_remove_event_additional_fields_and_more'),  # Update this to your previous migration
    ]

    operations = [
        migrations.RunPython(create_tables_and_link_subscriptions),
        # After data is fixed, modify the field to be non-nullable
        migrations.AlterField(
            model_name='subscription',
            name='table',
            field=models.ForeignKey(
                null=False,
                on_delete=models.CASCADE,
                related_name='subscriptions',
                to='events.eventtable',
            ),
        ),
    ]