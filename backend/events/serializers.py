from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from events.models import Event, EventList, Subscription, EventOrganizer
from profiles.models import Profile
from treasury.models import Transaction
from treasury.serializers import TransactionViewSerializer
import os
import json

COUNTRY_CODES_PATH = os.path.join(os.path.dirname(__file__), '../utils/countryCodes.json')
with open(COUNTRY_CODES_PATH, encoding='utf-8') as f:
    COUNTRY_CODES = json.load(f)
CODE_TO_NAME = {entry['code']: entry['name'] for entry in COUNTRY_CODES}


# A reusable mixin that calls the model's clean()
class ModelCleanSerializerMixin:
    """
    After DRF does its own field-level & object-level validation,
    instantiate or update the model instance, call its clean(),
    and re-raise any ValidationError as serializers.ValidationError.
    """

    def validate(self, attrs):
        # Let django rest framework do its own validation first
        attrs = super().validate(attrs)

        # Get or build the model instance
        instance = getattr(self, 'instance', None) or self.Meta.model()

        # Exclude reverse relation fields to avoid "Direct assignment to reverse side" error
        reverse_relation_fields = ['lists', 'organizers']

        # Copy attrs to avoid modifying the input during iteration
        attrs_copy = attrs.copy()

        # Remove reverse relation fields from attrs_copy before setting attributes
        for field in reverse_relation_fields:
            if field in attrs_copy:
                attrs_copy.pop(field)

        # Populate instance with remaining attributes
        for attr, value in attrs_copy.items():
            setattr(instance, attr, value)

        # Call model.clean()
        try:
            instance.clean()
        except DjangoValidationError as exc:

            # field‐specific errors
            if hasattr(exc, 'error_dict'):
                raise serializers.ValidationError(exc.error_dict)
            # non‐field errors
            raise serializers.ValidationError({'non_field_errors': exc.messages})

        return attrs


# Serializers for EventList
class EventListSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventList
        fields = ['id', 'name', 'capacity', 'display_order', 'subscription_count']


# Serializers for Event
class EventsListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'name', 'date', 'cost', 'status', 'is_a_bando', 'is_allow_external']


class EventOrganizerSerializer(serializers.ModelSerializer):
    profile_name = serializers.SerializerMethodField()

    class Meta:
        model = EventOrganizer
        fields = ['id', 'profile', 'profile_name', 'is_lead', 'role']

    @staticmethod
    def get_profile_name(obj):
        return f"{obj.profile.name} {obj.profile.surname}"


class EventCreationSerializer(ModelCleanSerializerMixin, serializers.ModelSerializer):
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
    profile_fields = serializers.ListField(required=False, default=list)
    form_fields = serializers.ListField(required=False, default=list)
    additional_fields = serializers.ListField(required=False, default=list)
    enable_form = serializers.BooleanField(required=False, default=False)
    description = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Event
        fields = [
            'name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers', 'lead_organizer',
            'subscription_start_date', 'subscription_end_date', 'is_a_bando', 'is_allow_external',
            'profile_fields', 'form_fields', 'additional_fields', 'enable_form'
        ]

    def create(self, validated_data):
        # Pop related fields that need special handling
        lists_data = validated_data.pop('lists', [])
        organizers = validated_data.pop('organizers', [])
        lead_organizer = validated_data.pop('lead_organizer', None)

        # Create event with the remaining data
        event = Event.objects.create(**validated_data)

        # Create lists
        for list_data in lists_data:
            EventList.objects.create(event=event, **list_data)

        # Create organizers
        for profile in organizers:
            EventOrganizer.objects.create(event=event, profile=profile, is_lead=False)

        # Add lead organizer if specified
        if lead_organizer:
            EventOrganizer.objects.create(event=event, profile=lead_organizer, is_lead=True)

        return event

    def update(self, instance, validated_data):
        # Remove any relationship fields that need special handling
        lists_data = validated_data.pop('lists', None)
        organizers = validated_data.pop('organizers', None)
        lead_organizer = validated_data.pop('lead_organizer', None)

        # Update the instance with the remaining data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        # Handle lists separately
        if lists_data is not None:
            # Get existing lists
            existing_lists = {list_obj.id: list_obj for list_obj in instance.lists.all()}

            # Process each list in the request
            for list_data in lists_data:
                list_id = list_data.get('id')
                if list_id and list_id in existing_lists:
                    # Update existing list
                    list_obj = existing_lists[list_id]
                    for attr, value in list_data.items():
                        setattr(list_obj, attr, value)
                    list_obj.save()
                    del existing_lists[list_id]
                else:
                    # Create new list - remove empty id field
                    create_data = {k: v for k, v in list_data.items() if k != 'id' or v}
                    EventList.objects.create(event=instance, **create_data)

            # Delete lists not included in the update
            for remaining_list in existing_lists.values():
                remaining_list.delete()

        # Handle organizers
        if organizers is not None:
            instance.organizers.filter(is_lead=False).delete()
            for profile in organizers:
                EventOrganizer.objects.create(event=instance, profile=profile, is_lead=False)

        # Handle lead organizer
        if lead_organizer is not None:
            instance.organizers.filter(is_lead=True).delete()
            EventOrganizer.objects.create(event=instance, profile=lead_organizer, is_lead=True)

        return instance


class EventDetailSerializer(serializers.ModelSerializer):
    lists = EventListSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)
    profile_fields = serializers.ListField(read_only=True)
    form_fields = serializers.ListField(read_only=True)
    additional_fields = serializers.ListField(read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers',
            'subscription_start_date', 'subscription_end_date', 'created_at', 'updated_at', 'status',
            'is_a_bando', 'is_allow_external',
            'profile_fields', 'form_fields', 'additional_fields'
        ]


# Serializer to create subscription from form
class FormSubscriptionCreateSerializer(ModelCleanSerializerMixin, serializers.ModelSerializer):
    # look up Profile by email slug
    profile = serializers.SlugRelatedField(
        queryset=Profile.objects.all(),
        slug_field='email'
    )
    additional_data = serializers.DictField(required=False, default=dict)

    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'enable_refund', 'list', 'form_data', 'additional_data']

    def create(self, validated_data):
        validated_data['additional_data'] = validated_data.get('additional_data', {})
        return super().create(validated_data)


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
    external_name = serializers.CharField(read_only=True)
    is_external = serializers.SerializerMethodField()
    additional_data = serializers.DictField(read_only=True)

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
            'subscribed_at',
            'external_name',
            'is_external',
            'form_data',
            'additional_data'
        ]

    def create(self, validated_data):
        validated_data.setdefault('additional_data', {})
        return super().create(validated_data)

    @staticmethod
    def get_profile_name(obj):
        # Fix: handle None profile (external subscription)
        if obj.profile:
            return f"{obj.profile.name} {obj.profile.surname}"
        elif obj.external_name:
            return obj.external_name
        return ""

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
        tx = Transaction.objects.filter(subscription=obj, type=Transaction.TransactionType.CAUZIONE).order_by(
            '-id').first()
        return tx.id if tx else None

    @staticmethod
    def get_quota_reimbursement_transaction_id(obj):
        tx = Transaction.objects.filter(subscription=obj, type=Transaction.TransactionType.RIMBORSO_QUOTA).order_by(
            '-id').first()
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
            cauzione_tx = Transaction.objects.filter(subscription=obj,
                                                     type=Transaction.TransactionType.CAUZIONE).first()
            reimbursed = Transaction.objects.filter(subscription=obj,
                                                    type=Transaction.TransactionType.RIMBORSO_CAUZIONE).exists()
            if reimbursed:
                return 'reimbursed'
            elif cauzione_tx:
                return 'paid'
            else:
                return 'pending'
        return None

    @staticmethod
    def get_is_external(obj):
        return bool(obj.external_name)


class SubscriptionCreateSerializer(ModelCleanSerializerMixin, serializers.ModelSerializer):
    account_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    pay_deposit = serializers.BooleanField(write_only=True, required=False, default=True)
    status_quota = serializers.CharField(write_only=True, required=False, default='pending')
    status_cauzione = serializers.CharField(write_only=True, required=False, default='pending')
    external_name = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    additional_data = serializers.DictField(required=False, default=dict)

    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'list', 'notes', 'account_id', 'pay_deposit', 'status_quota', 'status_cauzione',
                  'external_name', 'additional_data']

    def validate(self, attrs):
        profile = attrs.get('profile')
        event = attrs.get('event')
        external_name = attrs.get('external_name', '').strip() if attrs.get('external_name') else ''

        if not profile and not external_name:
            if event and hasattr(event, 'is_allow_external') and event.is_allow_external:
                raise serializers.ValidationError("Devi inserire un nominativo esterno se non selezioni un profilo.")
            else:
                raise serializers.ValidationError("Seleziona un profilo per l'iscrizione.")

        if profile and Subscription.objects.filter(profile=profile, event=event).exists():
            raise serializers.ValidationError("This profile is already registered for this event")
        if external_name and Subscription.objects.filter(external_name=external_name, event=event).exists():
            raise serializers.ValidationError("Questo nominativo esterno è già registrato per questo evento")

        self.account = attrs.pop('account_id', None)
        self.pay_deposit = attrs.pop('pay_deposit', True)
        self.status_quota = attrs.pop('status_quota', 'pending')
        self.status_cauzione = attrs.pop('status_cauzione', 'pending')
        return attrs


class SubscriptionUpdateSerializer(ModelCleanSerializerMixin, serializers.ModelSerializer):
    account_id = serializers.IntegerField(write_only=True, required=False)
    status_quota = serializers.CharField(write_only=True, required=False, default='pending')
    status_cauzione = serializers.CharField(write_only=True, required=False, default='pending')
    external_name = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    additional_data = serializers.DictField(required=False, default=dict)

    class Meta:
        model = Subscription
        fields = ['list', 'enable_refund', 'notes', 'account_id', 'status_quota', 'status_cauzione', 'external_name',
                  'additional_data']

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
        fields = [
            'id', 'name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers', 'subscriptions',
            'subscription_start_date', 'subscription_end_date', 'is_a_bando', 'is_allow_external'
        ]


class LiberatoriaProfileSerializer(serializers.ModelSerializer):
    address = serializers.CharField(source='domicile')
    esncard_number = serializers.SerializerMethodField()
    document_number = serializers.SerializerMethodField()
    document_expiry = serializers.SerializerMethodField()
    date_of_birth = serializers.SerializerMethodField()
    place_of_birth = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    matricola = serializers.SerializerMethodField()
    codice_persona = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            'name', 'surname', 'address', 'esncard_number',
            'document_number', 'document_expiry', 'date_of_birth',
            'place_of_birth', 'phone', 'email', 'matricola', 'codice_persona'
        ]

    @staticmethod
    def get_esncard_number(obj):
        latest_card = getattr(obj, 'latest_esncard', None)
        return latest_card.number if latest_card else ''

    @staticmethod
    def get_document_number(obj):
        latest_doc = getattr(obj, 'latest_document', None)
        return latest_doc.number if latest_doc else ''

    @staticmethod
    def get_document_expiry(obj):
        latest_doc = getattr(obj, 'latest_document', None)
        if latest_doc and latest_doc.expiration:
            return latest_doc.expiration.strftime('%d/%m/%Y')
        return ''

    @staticmethod
    def get_date_of_birth(obj):
        if obj.birthdate:
            return obj.birthdate.strftime('%d/%m/%Y')
        return ''

    @staticmethod
    def get_place_of_birth(obj):
        code = obj.country or ''
        return CODE_TO_NAME.get(code, code)

    @staticmethod
    def get_phone(obj):
        # Prefer whatsapp, then phone, with prefix if present
        if obj.whatsapp_number:
            prefix = obj.whatsapp_prefix or ''
            return f"{prefix} {obj.whatsapp_number}"
        elif obj.phone_number:
            prefix = obj.phone_prefix or ''
            return f"{prefix} {obj.phone_number}"
        return ''

    @staticmethod
    def get_matricola(obj):
        return obj.matricola_number or ''

    @staticmethod
    def get_codice_persona(obj):
        return obj.person_code or ''


class PrintableLiberatoriaSerializer(serializers.ModelSerializer):
    profile_name = serializers.SerializerMethodField()
    account_name = serializers.SerializerMethodField()
    list_id = serializers.PrimaryKeyRelatedField(source='list', read_only=True)

    class Meta:
        model = Subscription
        fields = ['id', 'profile_name', 'account_name', 'list_id']

    @staticmethod
    def get_profile_name(obj):
        # Fix: handle None profile (external subscription)
        if obj.profile:
            return f"{obj.profile.name} {obj.profile.surname}"
        elif obj.external_name:
            return obj.external_name
        return ""

    @staticmethod
    def get_account_name(obj):
        # Get the account from the first subscription payment transaction
        transaction = Transaction.objects.filter(
            subscription=obj,
            type=Transaction.TransactionType.SUBSCRIPTION
        ).order_by('created_at').first()
        return transaction.account.name if transaction and transaction.account else None
