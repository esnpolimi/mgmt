import json
import os

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from events.models import Event, EventList, Subscription, EventOrganizer
from profiles.models import Profile
from treasury.models import Transaction

COUNTRY_CODES_PATH = os.path.join(os.path.dirname(__file__), '../utils/countryCodes.json')
with open(COUNTRY_CODES_PATH, encoding='utf-8') as f:
    COUNTRY_CODES = json.load(f)

CODE_TO_NAME = {entry['code']: entry['name'] for entry in COUNTRY_CODES}

# Canonical order for profile fields (same as frontend)
CANONICAL_PROFILE_ORDER = [
    'name', 'surname', 'birthdate', 'email', 'latest_esncard', 'country', 'domicile',
    'phone_prefix', 'phone_number', 'whatsapp_prefix', 'whatsapp_number',
    'latest_document', 'course', 'matricola_expiration', 'person_code', 'matricola_number'
]


def order_profile_fields(fields):
    """Order profile fields according to canonical order, preserving only those present."""
    return [f for f in CANONICAL_PROFILE_ORDER if f in fields]


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
    id = serializers.IntegerField(required=False, allow_null=True)  # Accept null for new lists
    is_main_list = serializers.BooleanField(required=False, default=False)
    is_waiting_list = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = EventList
        fields = ['id', 'name', 'capacity', 'display_order', 'subscription_count', 'is_main_list', 'is_waiting_list']


# Serializers for Event
class EventsListSerializer(serializers.ModelSerializer):
    lists_capacity = serializers.SerializerMethodField()
    enable_form = serializers.BooleanField(read_only=True)
    form_programmed_open_time = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'date', 'cost', 'deposit', 'status',
            'is_a_bando', 'is_allow_external',
            'lists_capacity', 'enable_form', 'form_programmed_open_time',
            'is_refa_done',
        ]

    @staticmethod
    def get_lists_capacity(obj):
        qs = obj.lists.all().order_by('display_order', 'id')
        return EventListSerializer(qs, many=True).data


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

    # Accept organizers as flexible JSON list:
    # - New format: [{ "profile": <id>, "is_lead": true/false, "role": "..." }, ...]
    # - Legacy format: [<id>, <id>, ...]
    organizers = serializers.ListField(
        child=serializers.JSONField(),
        required=False,
        write_only=True
    )
    # Keep legacy single lead_organizer for backward-compat
    lead_organizer = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.all(),
        required=False,
        write_only=True
    )
    profile_fields = serializers.ListField(required=False, default=list)
    fields = serializers.ListField(required=False, default=list)  # Unified fields
    enable_form = serializers.BooleanField(required=False, default=False)
    description = serializers.CharField(required=False, allow_blank=True)
    allow_online_payment = serializers.BooleanField(required=False, default=False)
    form_programmed_open_time = serializers.DateTimeField(required=False, allow_null=True)
    is_refa_done = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = Event
        fields = [
            'name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers', 'lead_organizer',
            'subscription_start_date', 'subscription_end_date', 'is_a_bando', 'is_allow_external',
            'profile_fields', 'fields', 'enable_form',
            'allow_online_payment', 'form_programmed_open_time', 'is_refa_done'
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # Ensure global ordering of profile_fields
        if 'profile_fields' in attrs:
            attrs['profile_fields'] = order_profile_fields(attrs['profile_fields'])
        # Validate lists constraints early so the frontend gets a 400 with details
        lists_data = attrs.get('lists', None)
        if lists_data is not None:
            main_lists = [l for l in lists_data if l.get('is_main_list')]
            waiting_lists = [l for l in lists_data if l.get('is_waiting_list')]
            if len(main_lists) > 1:
                raise serializers.ValidationError({'lists': "Only one Main List is allowed per event."})
            if len(waiting_lists) > 1:
                raise serializers.ValidationError({'lists': "Only one Waiting List is allowed per event."})
            if len(main_lists) != 1:
                raise serializers.ValidationError({'lists': "An event must have exactly one Main List."})
        # If form not enabled, nullify programmed open time to avoid date constraints
        if not attrs.get('enable_form', False):
            attrs['form_programmed_open_time'] = None
        return attrs

    @staticmethod
    def _parse_organizers_input(organizers_data, lead_organizer):
        """
        Returns a list of dicts: [{ 'profile': Profile instance, 'is_lead': bool, 'role': str|None }, ...]
        Accepts both new (dicts) and legacy (ints) formats. Also merges legacy lead_organizer if provided.
        """
        parsed = []
        seen = set()

        def add_item(profile_id, is_lead=False, role=None):
            if profile_id in seen:
                # if already present and is_lead True, upgrade to lead
                for item in parsed:
                    if item['profile'].id == profile_id and is_lead and not item['is_lead']:
                        item['is_lead'] = True
                return
            try:
                prof = Profile.objects.get(pk=profile_id)
            except Profile.DoesNotExist:
                raise serializers.ValidationError({'organizers': f'Invalid profile id {profile_id}'})
            parsed.append({'profile': prof, 'is_lead': bool(is_lead), 'role': role})
            seen.add(profile_id)

        for entry in organizers_data or []:
            if isinstance(entry, int):
                add_item(entry, is_lead=False)
            elif isinstance(entry, dict):
                pid = entry.get('profile')
                if pid is None:
                    raise serializers.ValidationError({'organizers': 'Organizer entry missing "profile" id'})
                add_item(pid, is_lead=entry.get('is_lead', False), role=entry.get('role'))
            else:
                raise serializers.ValidationError({'organizers': 'Invalid organizer entry type'})

        if lead_organizer:
            add_item(lead_organizer.id, is_lead=True)

        return parsed

    def create(self, validated_data):
        # Pop related fields that need special handling
        lists_data = validated_data.pop('lists', [])
        organizers_data = validated_data.pop('organizers', [])
        lead_organizer = validated_data.pop('lead_organizer', None)
        event = Event.objects.create(**validated_data)

        # Create provided lists
        created_lists = []
        for list_data in lists_data:
            created_lists.append(EventList.objects.create(event=event, **list_data))

        # Auto-create form list if form enabled
        if event.enable_form:
            has_form_list = event.lists.filter(name='Form List').exists()
            if not has_form_list:
                # Sum capacities of ML + WL
                ml_cap = sum(l.capacity for l in event.lists.filter(is_main_list=True))
                wl_cap = sum(l.capacity for l in event.lists.filter(is_waiting_list=True))
                default_cap = ml_cap + wl_cap
                EventList.objects.create(
                    event=event,
                    name='Form List',
                    capacity=default_cap,
                    display_order=event.lists.count(),
                    is_main_list=False,
                    is_waiting_list=False
                )

        # Create organizers (supports multiple leaders)
        parsed_orgs = self._parse_organizers_input(organizers_data, lead_organizer)
        for item in parsed_orgs:
            EventOrganizer.objects.create(
                event=event,
                profile=item['profile'],
                is_lead=item['is_lead'],
                role=item.get('role')
            )

        return event

    def _user_can_edit(self, event):
        """
        Allow edits to:
        - superusers
        - members of Board-like groups
        - event organizers
        - otherwise, users with events.change_event permission
        """
        user = self.context.get('user')
        if not user:
            return False

        try:
            if getattr(user, 'is_superuser', False):
                return True

            # Flexible group name match
            if user.groups.filter(name__in=['Board', 'Board Members', 'BoardMember']).exists():
                return True

            profile = getattr(user, 'profile', None)
            profile_id = getattr(profile, 'id', None)
            if profile_id and event.organizers.filter(profile_id=profile_id).exists():
                return True

            # Fallback: explicit permission
            return user.has_perm('events.change_event')
        except Exception:
            # Any unexpected error in checks => deny gracefully instead of 500
            return False

    def update(self, instance, validated_data):
        # Authorization check
        if not self._user_can_edit(instance):
            raise serializers.ValidationError("Non sei autorizzato a modificare questo evento")

        # Remove relationship fields that need special handling
        lists_data = validated_data.pop('lists', None)
        organizers_data = validated_data.pop('organizers', None)
        lead_organizer = validated_data.pop('lead_organizer', None)

        # Check if event has subscriptions for validation
        has_subscriptions = instance.pk and instance.subscription_set.exists()

        # Prevent editing certain fields if there are subscriptions
        if has_subscriptions:
            # Only restrict form-related fields (enable_form)
            restricted_fields = ['enable_form']
            for field in restricted_fields:
                if field in validated_data:
                    validated_data.pop(field)

            # For unified fields, preserve form fields and existing additional fields,
            # but allow new additional fields to be added
            if 'fields' in validated_data:
                new_fields = validated_data['fields']
                existing_form_fields = [f for f in instance.fields if f.get('field_type') == 'form']
                existing_additional_fields = [f for f in instance.fields if f.get('field_type') == 'additional']
                new_additional_fields = [f for f in new_fields if f.get('field_type') == 'additional']

                # Only keep truly new additional fields (not existing ones being modified)
                existing_additional_names = {f.get('name') for f in existing_additional_fields}
                truly_new_additional = []
                for new_field in new_additional_fields:
                    if new_field.get('name') not in existing_additional_names:
                        truly_new_additional.append(new_field)

                # Do not allow editing/removing existing additional fields
                validated_data['fields'] = existing_form_fields + existing_additional_fields + truly_new_additional

        # Validate subscription start date hasn't changed
        if 'subscription_start_date' in validated_data:
            new_start = validated_data['subscription_start_date']
            if new_start != instance.subscription_start_date:
                raise serializers.ValidationError({
                    'subscription_start_date': "Non è possibile modificare la data d'inizio iscrizione se l'evento ha delle iscrizioni"
                })

        # Validate cost hasn't changed
        if 'cost' in validated_data:
            new_cost = validated_data['cost']
            if new_cost != instance.cost:
                raise serializers.ValidationError({
                    'cost': "Non è possibile modificare il costo se l'evento ha delle iscrizioni"
                })

        # Validate deposit hasn't changed
        if 'deposit' in validated_data:
            new_deposit = validated_data['deposit']
            if new_deposit != instance.deposit:
                raise serializers.ValidationError({
                    'deposit': "Non è possibile modificare la cauzione se l'evento ha delle iscrizioni"
                })

        # Validate subscription end date
        if 'subscription_end_date' in validated_data:
            from django.utils import timezone
            end_date = validated_data['subscription_end_date']
            now = timezone.now()

            # Only validate against past dates if the date is actually being changed
            if end_date != instance.subscription_end_date and end_date < now:
                raise serializers.ValidationError({
                    'subscription_end_date': "Non è possibile impostare una data fine iscrizioni nel passato"
                })

            start_date = validated_data.get('subscription_start_date', instance.subscription_start_date)
            if start_date and end_date <= start_date:
                raise serializers.ValidationError({
                    'subscription_end_date': "Non è possibile impostare una data fine iscrizioni minore di quella di inizio iscrizioni"
                })

        # Handle list capacity validation if there are subscriptions
        if has_subscriptions and lists_data is not None:
            from events.models import Subscription
            for list_data in lists_data:
                list_id = list_data.get('id')
                new_capacity = list_data.get('capacity', 0)

                # Skip validation for new lists (no ID)
                if not list_id:
                    continue

                # Get current subscription count for this list
                subscription_count = Subscription.objects.filter(event=instance, list_id=list_id).count()
                if subscription_count > new_capacity > 0:
                    raise serializers.ValidationError({
                        'lists': f"Non è possibile impostare una capacità lista minore del numero di iscrizioni presenti ({subscription_count})"
                    })

        # Update the instance with the remaining data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lists_data is not None:
            existing_lists = {lst.id: lst for lst in instance.lists.all()}
            provided_list_ids = set()
            for list_data in lists_data:
                list_id = list_data.get('id')
                list_name = (list_data.get('name') or '').strip()
                if list_id:
                    list_id = int(list_id)
                    if list_id in existing_lists:
                        el = existing_lists[list_id]
                        provided_list_ids.add(list_id)
                        if el.name == 'Form List':
                        # Protect form list name
                            el.capacity = list_data.get('capacity', el.capacity)
                            # Allow capacity & flags update except name
                            el.display_order = list_data.get('display_order', el.display_order)
                            el.is_main_list = False
                            # Force non-main/non-waiting
                            el.is_waiting_list = False
                            el.save()
                        else:
                            el.name = list_name
                            el.capacity = list_data.get('capacity', el.capacity)
                            el.display_order = list_data.get('display_order', el.display_order)
                            el.is_main_list = list_data.get('is_main_list', el.is_main_list)
                            el.is_waiting_list = list_data.get('is_waiting_list', el.is_waiting_list)
                            el.save()
                else:
                    if list_name and list_name != 'Form List':
                    # New list; ignore attempts to manually create another form list
                        EventList.objects.create(
                            event=instance,
                            name=list_name,
                            capacity=list_data.get('capacity', 0),
                            display_order=list_data.get('display_order', 0),
                            is_main_list=list_data.get('is_main_list', False),
                            is_waiting_list=list_data.get('is_waiting_list', False)
                        )

            # Remove unprovided lists (except form list) if no subscriptions
            removable = set(existing_lists.keys()) - provided_list_ids
            for rid in removable:
                lst = existing_lists[rid]
                if lst.name == 'Form List':
                    continue
                if not lst.subscriptions.exists():
                    lst.delete()

        # Ensure form list exists if form enabled
        if instance.enable_form and not instance.lists.filter(name='Form List').exists():
            ml_cap = sum(l.capacity for l in instance.lists.filter(is_main_list=True))
            wl_cap = sum(l.capacity for l in instance.lists.filter(is_waiting_list=True))
            default_cap = ml_cap + wl_cap
            EventList.objects.create(
                event=instance,
                name='Form List',
                capacity=default_cap,
                display_order=instance.lists.count(),
                is_main_list=False,
                is_waiting_list=False
            )

        # Handle organizers
        if organizers_data is not None:
            # Full replace with provided list (supports multiple leaders)
            instance.organizers.all().delete()
            parsed_orgs = self._parse_organizers_input(organizers_data, None)
            for item in parsed_orgs:
                EventOrganizer.objects.create(
                    event=instance,
                    profile=item['profile'],
                    is_lead=item['is_lead'],
                    role=item.get('role')
                )
        elif lead_organizer is not None:
            # Legacy behavior: set provided one as leader, keep others
            # ensure relation exists
            org, _ = EventOrganizer.objects.get_or_create(event=instance, profile=lead_organizer)
            org.is_lead = True
            org.save()

        return instance


class EventDetailSerializer(serializers.ModelSerializer):
    lists = EventListSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)
    profile_fields = serializers.ListField(read_only=True)
    fields = serializers.ListField(read_only=True)
    available_profile_fields = serializers.SerializerMethodField(read_only=True)
    allow_online_payment = serializers.BooleanField(read_only=True)
    form_programmed_open_time = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers',
            'subscription_start_date', 'subscription_end_date', 'created_at', 'updated_at', 'status',
            'is_a_bando', 'is_allow_external',
            'profile_fields', 'fields',
            'allow_online_payment', 'form_programmed_open_time',
            'is_refa_done'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Ensure global ordering of profile_fields in output
        if 'profile_fields' in data:
            data['profile_fields'] = order_profile_fields(data['profile_fields'])
        return data


# Serializer to create subscription from form
class FormSubscriptionCreateSerializer(ModelCleanSerializerMixin, serializers.ModelSerializer):
    # look up Profile by email slug
    profile = serializers.SlugRelatedField(
        queryset=Profile.objects.all(),
        slug_field='email',
        required=False,
        allow_null=True
    )
    additional_data = serializers.DictField(required=False, default=dict)
    external_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    form_notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'enable_refund', 'list', 'form_data', 'additional_data', 'external_name', 'form_notes']

    def create(self, validated_data):
        validated_data['additional_data'] = validated_data.get('additional_data', {})
        return super().create(validated_data)


# Inline profile serializer exposing only the allowed profile fields (safe, read-only)
class SubscriptionProfileInlineSerializer(serializers.ModelSerializer):
    # Combine prefix + number and expose as the number fields
    phone_number = serializers.SerializerMethodField()
    whatsapp_number = serializers.SerializerMethodField()
    # Ensure non-primitive properties are serialized safely
    latest_esncard = serializers.SerializerMethodField()
    latest_document = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            'name', 'surname', 'email', 'phone_prefix', 'phone_number', 'whatsapp_prefix',
            'whatsapp_number', 'country', 'birthdate', 'matricola_number', 'matricola_expiration',
            'course', 'person_code', 'domicile', 'latest_esncard', 'latest_document'
        ]

    @staticmethod
    def _combine(prefix, number):
        number = (number or '').strip()
        prefix = (prefix or '').strip()
        if not number:
            return ''
        if prefix and not number.startswith(prefix):
            return f"{prefix} {number}"
        return number

    def get_phone_number(self, obj):
        return self._combine(obj.phone_prefix, obj.phone_number)

    def get_whatsapp_number(self, obj):
        return self._combine(obj.whatsapp_prefix, obj.whatsapp_number)

    @staticmethod
    def get_latest_esncard(obj):
        card = getattr(obj, 'latest_esncard', None)
        try:
            return card.number if card else ''
        except Exception:
            return ''

    @staticmethod
    def get_latest_document(obj):
        doc = getattr(obj, 'latest_document', None)
        try:
            return doc.number if doc else ''
        except Exception:
            return ''


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
    form_data = serializers.DictField(read_only=True)
    additional_data = serializers.DictField(read_only=True)
    form_notes = serializers.CharField(read_only=True)
    profile = SubscriptionProfileInlineSerializer(read_only=True)  # NEW inline data for columns
    sumup_checkout_id = serializers.CharField(read_only=True)
    sumup_transaction_id = serializers.CharField(read_only=True)

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
            'additional_data',
            'form_notes',
            'profile',
            'sumup_checkout_id',
            'sumup_transaction_id',
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
    form_data = serializers.DictField(required=False, default=dict)
    additional_data = serializers.DictField(required=False, default=dict)

    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'list', 'notes', 'account_id', 'pay_deposit', 'status_quota', 'status_cauzione',
                  'external_name', 'form_data', 'additional_data']

    def validate(self, attrs):
        event = attrs.get('event')
        email = self.initial_data.get('email', '').strip()
        profile = attrs.get('profile', None)
        external_name = attrs.get('external_name', '').strip() if attrs.get('external_name') else ''

        # If profile not found and event allows externals, use email as external_name
        if not profile and event and getattr(event, 'is_allow_external', False):
            if email:
                attrs['external_name'] = email
            else:
                raise serializers.ValidationError("Email is required for external subscription.")
        elif not profile:
            raise serializers.ValidationError("Profile not found for this email and event does not allow externals.")

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
    form_data = serializers.DictField(required=False, default=dict)
    additional_data = serializers.DictField(required=False, default=dict)

    class Meta:
        model = Subscription
        fields = ['list', 'enable_refund', 'notes', 'account_id', 'status_quota', 'status_cauzione', 'external_name',
                  'form_data', 'additional_data']

    def validate(self, attrs):
        self.account_id = attrs.get('account_id', self.instance and getattr(self.instance, 'account_id', None))
        self.status_quota = attrs.pop('status_quota', 'pending')
        self.status_cauzione = attrs.pop('status_cauzione', 'pending')
        attrs.pop('account_id', None)
        return attrs

    def update(self, instance, validated_data):

        return super().update(instance, validated_data)


class EventWithSubscriptionsSerializer(serializers.ModelSerializer):
    lists = EventListSerializer(many=True, read_only=True)
    organizers = EventOrganizerSerializer(many=True, read_only=True)
    subscriptions = serializers.SerializerMethodField(read_only=True)
    profile_fields = serializers.ListField(read_only=True)
    fields = serializers.ListField(read_only=True)
    enable_form = serializers.BooleanField(read_only=True)
    allow_online_payment = serializers.BooleanField(read_only=True)
    form_programmed_open_time = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Event
        fields = [
            'id', 'name', 'date', 'description', 'cost', 'deposit', 'lists', 'organizers', 'subscriptions',
            'subscription_start_date', 'subscription_end_date', 'is_a_bando', 'is_allow_external',
            'profile_fields', 'fields', 'enable_form',
            'allow_online_payment', 'form_programmed_open_time',
            'is_refa_done'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Ensure global ordering of profile_fields in output
        if 'profile_fields' in data:
            data['profile_fields'] = order_profile_fields(data['profile_fields'])
        return data

    @staticmethod
    def get_subscriptions(obj):
        qs = obj.subscription_set.all().order_by('-created_at')
        return SubscriptionSerializer(qs, many=True).data

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


class OrganizedEventSerializer(serializers.Serializer):
    event_id = serializers.IntegerField()
    event_name = serializers.CharField()
    event_date = serializers.DateField()
    is_lead = serializers.BooleanField()
