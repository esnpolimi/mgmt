from rest_framework import serializers
from events.models import Event, EventList, Subscription, EventOrganizer
from profiles.models import Profile
from treasury.models import Transaction


# Serializers for EventList
class EventListSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventList
        fields = ['id', 'name', 'capacity', 'display_order', 'subscription_count']


# Serializers for Event
class EventsListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'cost', 'status']


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
        fields = ['name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers', 'lead_organizer',
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
        fields = ['id', 'name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers',
                  'subscription_start_date', 'subscription_end_date', 'created_at', 'updated_at', 'status']


# Serializers for Subscription
class SubscriptionSerializer(serializers.ModelSerializer):
    profile_id = serializers.PrimaryKeyRelatedField(source='profile', read_only=True)
    profile_name = serializers.SerializerMethodField()
    list_id = serializers.PrimaryKeyRelatedField(source='list', read_only=True)
    list_name = serializers.CharField(source='list.name', read_only=True)
    account_id = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    deposit_reimbursement_transaction_id = serializers.SerializerMethodField()
    quota_reimbursement_transaction_id = serializers.SerializerMethodField()
    status_quota = serializers.SerializerMethodField()
    status_cauzione = serializers.SerializerMethodField()
    subscribed_at = serializers.DateTimeField(source='created_at', read_only=True)
    event_name = serializers.CharField(source='event.name', read_only=True)
    event_id = serializers.IntegerField(source='event.id', read_only=True)
    event_date = serializers.DateField(source='event.date', read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id', 'profile_id', 'profile_name', 'event', 'event_id', 'event_name', 'event_date',
            'list_id', 'list_name',
            'enable_refund', 'notes', 'created_by_form',
            'account_id', 'account_name',
            'deposit_reimbursement_transaction_id',
            'quota_reimbursement_transaction_id',
            'status_quota', 'status_cauzione',
            'subscribed_at'
        ]

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

    @staticmethod
    def get_deposit_reimbursement_transaction_id(obj):
        tx = Transaction.objects.filter(subscription=obj, type=Transaction.TransactionType.CAUZIONE).order_by('-id').first()
        return tx.id if tx else None

    @staticmethod
    def get_quota_reimbursement_transaction_id(obj):
        tx = Transaction.objects.filter(subscription=obj, type=Transaction.TransactionType.RIMBORSO_QUOTA).order_by('-id').first()
        return tx.id if tx else None

    @staticmethod
    def get_status_quota(obj):
        # Only return if event has quota (cost > 0)
        if obj.event and obj.event.cost and float(obj.event.cost) > 0:
            if Transaction.objects.filter(subscription=obj, type=Transaction.TransactionType.RIMBORSO_QUOTA).exists():
                return 'reimbursed'
            elif Transaction.objects.filter(subscription=obj, type=Transaction.TransactionType.SUBSCRIPTION).exists():
                return 'paid'
            else:
                return 'pending'
        return None

    @staticmethod
    def get_status_cauzione(obj):
        # Only return if event has deposit (deposit > 0)
        if obj.event and obj.event.deposit and float(obj.event.deposit) > 0:
            cauzione_tx = Transaction.objects.filter(subscription=obj, type=Transaction.TransactionType.CAUZIONE).first()
            reimbursed = Transaction.objects.filter(subscription=obj, type=Transaction.TransactionType.RIMBORSO_CAUZIONE).exists()
            if reimbursed:
                return 'reimbursed'
            elif cauzione_tx:
                return 'paid'
            else:
                return 'pending'
        return None


class SubscriptionCreateSerializer(serializers.ModelSerializer):
    account_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    pay_deposit = serializers.BooleanField(write_only=True, required=False, default=True)
    status_quota = serializers.CharField(write_only=True, required=False, default='pending')
    status_cauzione = serializers.CharField(write_only=True, required=False, default='pending')

    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'list', 'notes', 'account_id', 'pay_deposit', 'status_quota', 'status_cauzione']

    def validate(self, attrs):
        # Check if profile is already registered for this event
        profile = attrs.get('profile')
        event = attrs.get('event')

        if Subscription.objects.filter(profile=profile, event=event).exists():
            raise serializers.ValidationError("This profile is already registered for this event")

        # Remove account id from validated_data as it's not a field in Subscription model
        self.account = attrs.pop('account_id', None)
        self.pay_deposit = attrs.pop('pay_deposit', True)
        self.status_quota = attrs.pop('status_quota', 'pending')
        self.status_cauzione = attrs.pop('status_cauzione', 'pending')
        return attrs


class SubscriptionUpdateSerializer(serializers.ModelSerializer):
    account_id = serializers.IntegerField(write_only=True, required=False)
    status_quota = serializers.CharField(write_only=True, required=False, default='pending')
    status_cauzione = serializers.CharField(write_only=True, required=False, default='pending')

    class Meta:
        model = Subscription
        fields = ['list', 'enable_refund', 'notes', 'account_id', 'status_quota', 'status_cauzione']

    def validate(self, attrs):
        self.account_id = attrs.get('account_id', self.instance and getattr(self.instance, 'account_id', None))
        self.status_quota = attrs.pop('status_quota', 'pending')
        self.status_cauzione = attrs.pop('status_cauzione', 'pending')
        attrs.pop('account_id', None)
        return attrs


class EventWithSubscriptionsSerializer(serializers.ModelSerializer):
    lists = EventListSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)
    subscriptions = SubscriptionSerializer(many=True, read_only=True, source='subscription_set')

    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers', 'subscriptions',
                  'subscription_start_date', 'subscription_end_date']
