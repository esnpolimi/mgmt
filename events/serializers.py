from rest_framework import serializers
from events.models import Event, EventTable, Subscription, EventOrganizer
from profiles.models import Profile


# Serializers for EventTable
class EventTableSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventTable
        fields = ['id', 'name', 'capacity', 'display_order']


# Serializers for Event
class EventListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'description', 'cost']


class EventOrganizerSerializer(serializers.ModelSerializer):
    profile_name = serializers.SerializerMethodField()

    class Meta:
        model = EventOrganizer
        fields = ['id', 'profile', 'profile_name', 'is_lead', 'role']

    @staticmethod
    def get_profile_name(obj):
        return f"{obj.profile.first_name} {obj.profile.last_name}"


class EventCreationSerializer(serializers.ModelSerializer):
    tables = EventTableSerializer(many=True, required=False)
    organizers = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.all(),
        many=True,
        required=False,
        write_only=True
    )
    lead_organizer = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.all(),
        required=False,
        write_only=True
    )

    class Meta:
        model = Event
        fields = ['name', 'date', 'description', 'cost', 'tables', 'organizers', 'lead_organizer']

    def create(self, validated_data):
        tables_data = validated_data.pop('tables', [])
        organizers = validated_data.pop('organizers', [])
        lead_organizer = validated_data.pop('lead_organizer', None)

        event = Event.objects.create(**validated_data)

        # Create tables
        for table_data in tables_data:
            EventTable.objects.create(event=event, **table_data)

        # Create organizers
        for profile in organizers:
            EventOrganizer.objects.create(
                event=event,
                profile=profile,
                is_lead=False
            )

        # Add lead organizer if specified
        if lead_organizer:
            EventOrganizer.objects.create(
                event=event,
                profile=lead_organizer,
                is_lead=True
            )

        return event


class EventDetailSerializer(serializers.ModelSerializer):
    tables = EventTableSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)

    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'description', 'cost', 'tables', 'organizers', 'created_at', 'updated_at']


# Serializers for Subscription
class SubscriptionSerializer(serializers.ModelSerializer):
    profile_name = serializers.SerializerMethodField()
    table_name = serializers.CharField(source='table.name', read_only=True)

    class Meta:
        model = Subscription
        fields = ['id', 'profile', 'profile_name', 'event', 'table', 'table_name',
                  'status', 'enable_refund', 'notes', 'created_by_form']

    @staticmethod
    def get_profile_name(obj):
        return f"{obj.profile.first_name} {obj.profile.last_name}"


class SubscriptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'table', 'notes']

    def validate(self, attrs):
        # Check if profile is already registered for this event
        profile = attrs.get('profile')
        event = attrs.get('event')

        if Subscription.objects.filter(profile=profile, event=event).exists():
            raise serializers.ValidationError("This profile is already registered for this event")

        return attrs


class SubscriptionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['table', 'status', 'enable_refund', 'notes']


class EventWithSubscriptionsSerializer(serializers.ModelSerializer):
    tables = EventTableSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)
    subscriptions = SubscriptionSerializer(many=True, read_only=True, source='subscription_set')

    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'description', 'cost', 'tables', 'organizers', 'subscriptions']
