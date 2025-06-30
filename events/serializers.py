from rest_framework import serializers
from events.models import Event, EventList, Subscription, EventOrganizer
from profiles.models import Profile
from treasury.models import Transaction


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
        return f"{obj.profile.name} {obj.profile.surname}"


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
        data_to_update = validated_data.copy()
        # Remove any relationship fields if they exist in validated_data
        # These fields should be handled separately
        for field in ['lists', 'organizers', 'lead_organizer']:
            if field in data_to_update:
                data_to_update.pop(field)

        for attr, value in data_to_update.items():
            setattr(instance, attr, value)

        instance.save()

        lists_data = self.initial_data.get('lists', None)
        organizers = self.initial_data.get('organizers', None)
        lead_organizer = self.initial_data.get('lead_organizer', None)

        if lists_data is not None:
            existing_lists = {list_obj.id: list_obj for list_obj in instance.lists.all()}
            # Process each list in the request
            for list_data in lists_data:
                list_id = list_data.get('id')
                if list_id and list_id in existing_lists:
                    list_obj = existing_lists[list_id]
                    for attr, value in list_data.items():
                        setattr(list_obj, attr, value)
                    list_obj.save()
                    del existing_lists[list_id]
                else:
                    # Create new list - remove empty id field
                    create_data = {k: v for k, v in list_data.items() if k != 'id' or v}
                    EventList.objects.create(event=instance, **create_data)

            # Optional: if you want to delete lists not included in the update
            for remaining_list in existing_lists.values():
                remaining_list.delete()

        # Similar pattern for organizers
        if organizers is not None:
            instance.organizers.filter(is_lead=False).delete()
            for profile in organizers:
                EventOrganizer.objects.create(
                    event=instance,
                    profile=profile,
                    is_lead=False
                )

        # Only update lead organizer if provided
        if lead_organizer is not None:
            instance.organizers.filter(is_lead=True).delete()
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
    profile_id = serializers.PrimaryKeyRelatedField(source='profile', read_only=True)
    profile_name = serializers.SerializerMethodField()
    list_id = serializers.PrimaryKeyRelatedField(source='list', read_only=True)
    list_name = serializers.CharField(source='list.name', read_only=True)
    account_id = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = ['id', 'profile_id', 'profile_name', 'event', 'list_id', 'list_name',
                  'status', 'enable_refund', 'notes', 'created_by_form',
                  'account_id', 'account_name']

    @staticmethod
    def get_profile_name(obj):
        return f"{obj.profile.name} {obj.profile.surname}"

    @staticmethod
    def get_account_id(obj):
        transaction = Transaction.objects.filter(subscription=obj.id).order_by('-id').first()
        return transaction.account.id if transaction else None

    @staticmethod
    def get_account_name(obj):
        transaction = Transaction.objects.filter(subscription=obj.id).order_by('-id').first()
        return transaction.account.name if transaction else None


class SubscriptionCreateSerializer(serializers.ModelSerializer):
    account_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    status = serializers.CharField(default='pending')

    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'list', 'notes', 'status', 'account_id']

    def validate(self, attrs):
        # Check if profile is already registered for this event
        profile = attrs.get('profile')
        event = attrs.get('event')

        if Subscription.objects.filter(profile=profile, event=event).exists():
            raise serializers.ValidationError("This profile is already registered for this event")

        # Remove account id from validated_data as it's not a field in Subscription model
        self.account_id = attrs.pop('account_id', None)

        return attrs


class SubscriptionUpdateSerializer(serializers.ModelSerializer):
    account_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Subscription
        fields = ['list', 'status', 'enable_refund', 'notes', 'account_id']

    def validate(self, attrs):
        # Remove account_id from validated_data as it's not a field in Subscription model
        self.account_id = attrs.pop('account_id', None) if 'account_id' in attrs else None
        return attrs


class EventWithSubscriptionsSerializer(serializers.ModelSerializer):
    lists = EventListSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)
    subscriptions = SubscriptionSerializer(many=True, read_only=True, source='subscription_set')

    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'description', 'cost', 'lists', 'organizers', 'subscriptions',
                  'subscription_start_date', 'subscription_end_date']
