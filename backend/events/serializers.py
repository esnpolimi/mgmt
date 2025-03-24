from rest_framework import serializers
from events.models import Event, EventList, Subscription, EventOrganizer
from profiles.models import Profile


# Serializers for EventList
class EventListSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventList
        fields = ['id', 'name', 'capacity', 'display_order']


# Serializers for Event
class EventsListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'description', 'cost',
                  'subscription_start_date', 'subscription_end_date']


class EventOrganizerSerializer(serializers.ModelSerializer):
    profile_name = serializers.SerializerMethodField()

    class Meta:
        model = EventOrganizer
        fields = ['id', 'profile', 'profile_name', 'is_lead', 'role']

    @staticmethod
    def get_profile_name(obj):
        return f"{obj.profile.first_name} {obj.profile.last_name}"


class EventCreationSerializer(serializers.ModelSerializer):
    lists = EventListSerializer(many=True, required=False)
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
        fields = ['name', 'date', 'description', 'cost', 'lists', 'organizers', 'lead_organizer',
                  'subscription_start_date', 'subscription_end_date']

    def create(self, validated_data):
        lists_data = validated_data.pop('lists', [])
        organizers = validated_data.pop('organizers', [])
        lead_organizer = validated_data.pop('lead_organizer', None)

        event = Event.objects.create(**validated_data)

        # Create lists
        for list_data in lists_data:
            EventList.objects.create(event=event, **list_data)

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

    def update(self, instance, validated_data):
        lists_data = validated_data.pop('lists', [])
        organizers = validated_data.pop('organizers', [])
        lead_organizer = validated_data.pop('lead_organizer', None)

        # Update event fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update lists
        instance.lists.all().delete()
        for list_data in lists_data:
            EventList.objects.create(event=instance, **list_data)

        # Update organizers
        instance.organizers.all().delete()
        for profile in organizers:
            EventOrganizer.objects.create(
                event=instance,
                profile=profile,
                is_lead=False
            )

        # Update lead organizer
        if lead_organizer:
            EventOrganizer.objects.create(
                event=instance,
                profile=lead_organizer,
                is_lead=True
            )

        return instance


class EventDetailSerializer(serializers.ModelSerializer):
    lists = EventListSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)

    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'description', 'cost', 'lists', 'organizers',
                  'subscription_start_date', 'subscription_end_date', 'created_at', 'updated_at']


# Serializers for Subscription
class SubscriptionSerializer(serializers.ModelSerializer):
    profile_name = serializers.SerializerMethodField()
    list_name = serializers.CharField(source='list.name', read_only=True)

    class Meta:
        model = Subscription
        fields = ['id', 'profile', 'profile_name', 'event', 'list', 'list_name',
                  'status', 'enable_refund', 'notes', 'created_by_form']

    @staticmethod
    def get_profile_name(obj):
        return f"{obj.profile.first_name} {obj.profile.last_name}"


class SubscriptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'list', 'notes']

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
        fields = ['list', 'status', 'enable_refund', 'notes']


class EventWithSubscriptionsSerializer(serializers.ModelSerializer):
    lists = EventListSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)
    subscriptions = SubscriptionSerializer(many=True, read_only=True, source='subscription_set')

    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'description', 'cost', 'lists', 'organizers', 'subscriptions',
                  'subscription_start_date', 'subscription_end_date']
