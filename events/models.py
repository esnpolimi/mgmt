from jsonschema import validate

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from profiles.models import Profile, BaseEntity

# In the database, the form fields, profile fields and additional fields are stored using json
# for convenience and for not complicating the model too much. ( Perhaps some may think that using json
# schema is more complicated. Maybe yes :) )
# Because of this, the json that is stored in the database must follow a specific format. Json schemas are used
# to verify that the json that is being sent by the frontend, e.g. when creating an event, complies with the
# schemas and therefore correctly describes the lists of an event, or the fields / questions of the form, etc.


# Schema of json representing the profile fields required for the participants of the event.
# This data is obtained from the database and then populates the tables of the event.
# Example: ['name','surname','email',...]
profile_fields_schema = {
    "type": "array",
    "items": {"enum": [
        'name', 'surname', 'email', 'phone_prefix', 'phone_number', 'whatsapp_prefix',
        'whatsapp_number', 'country', 'birthdate', 'latest_esncard', 'latest_document',
        'matricola_number', 'matricola_expiration', 'course', 'person_code', 'domicile'
    ]}
}

# Schema of json representing the questions / fields asked in the form and in additonal fields.
# Types:
#  't': testo
#  'n': numero
#  'c': choice, risposta singola (radio buttons)
#  's': select, menu a tendina (dropdown)
#  'm': multiple choice, risposta multipla
#  'b': boolean, risposta yes/no
#  'd': date (DD-MM-YYYY)
#  'e': esncard number (string)
#  'p': phone (stored as single string e.g. "+39 3375619379")
#  'l': link (user uploads a file -> backend stores public sharing link string)
#
# Example: [{'name':'What are your allergies?', 'type':'t'},
#           {'name':'Are you vegan?','type':'m', 'choices':['yes','no','maybe'] }]
unified_fields_schema = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "type": {"enum": ["t", "n", "c", "m", "s", "b", "d", "e", "p", "l"]},
            "field_type": {"enum": ["form", "additional"]},
            "choices": {
                "type": "array",
                "items": {"type": "string"}
            },
            "required": {"type": "boolean"}
        },
        "required": ["name", "type", "field_type"],
        "allOf": [
            {
                "if": {"properties": {"type": {"enum": ["c", "m", "s"]}}},
                "then": {"required": ["choices"]}
            },
            {
                "if": {"properties": {"field_type": {"const": "form"}}},
                "then": {"properties": {"required": {"type": "boolean"}}}
            }
        ]
    }
}


def validate_field_data(field_config, data_dict, field_type_filter=None):
    errors = []
    relevant_fields = field_config
    if field_type_filter:
        relevant_fields = [f for f in field_config if f.get('field_type') == field_type_filter]
    for field in relevant_fields:
        field_name = field['name']
        field_type = field['type']
        if field_name not in data_dict:
            continue
        value = data_dict[field_name]
        if value is None or value == '':
            continue
        if field_type == 't' and not isinstance(value, str):
            errors.append(f'Invalid data type for field "{field_name}" - expected string')
        elif field_type == 'n':
            if not isinstance(value, (int, float)):
                try:
                    float(value)
                except (ValueError, TypeError):
                    errors.append(f'Invalid data type for field "{field_name}" - expected number')
        elif field_type == 'c' and value not in field.get('choices', []):
            errors.append(
                f'Invalid value "{value}" for field "{field_name}" - must be one of {field.get("choices", [])}')
        elif field_type == 's' and value not in field.get('choices', []):
            errors.append(
                f'Invalid value "{value}" for field "{field_name}" - must be one of {field.get("choices", [])}')
        elif field_type == 'm':
            if not isinstance(value, list):
                errors.append(f'Invalid data type for field "{field_name}" - expected list')
            else:
                for val in value:
                    if val not in field.get('choices', []):
                        errors.append(
                            f'Invalid value "{val}" for field "{field_name}" - must be one of {field.get("choices", [])}')
        elif field_type == 'b' and not isinstance(value, bool):
            errors.append(f'Invalid data type for field "{field_name}" - expected boolean')
        elif field_type in ('d', 'e', 'p'):
            # Accept only strings
            if not isinstance(value, str):
                errors.append(f'Invalid data type for field "{field_name}" - expected string')
            elif field_type == 'd':
                # Basic date format sanity (DD-MM-YYYY)
                from re import match
                if not match(r'^\d{2}-\d{2}-\d{4}', value):
                    errors.append(f'Invalid date format for field "{field_name}" (expected DD-MM-YYYY)')
        elif field_type == 'l':
            if not isinstance(value, str):
                errors.append(f'Invalid data type for field "{field_name}" - expected link string')
    valid_field_names = [f['name'] for f in relevant_fields]
    for provided_field in data_dict.keys():
        if provided_field not in valid_field_names:
            errors.append(f"Unknown field '{provided_field}' provided")
    return errors


# Class the describes an event
class Event(BaseEntity):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=128, unique=True)
    date = models.DateField(null=True)
    description = models.TextField(max_length=2048, null=True)
    cost = models.DecimalField(decimal_places=2, max_digits=20, null=True)
    deposit = models.DecimalField(decimal_places=2, max_digits=20, null=True, default=0)
    subscription_start_date = models.DateTimeField(null=True)
    subscription_end_date = models.DateTimeField(null=True)

    is_a_bando = models.BooleanField(default=False)
    is_allow_external = models.BooleanField(default=False)

    # Indicates whether a form is required for the event
    enable_form = models.BooleanField(default=False)

    # Allow online payment for event form
    allow_online_payment = models.BooleanField(default=False)

    # Optional introductory note shown on the subscription form
    form_note = models.TextField(blank=True, default='')

    # Programmed open time for the form (optional)
    form_programmed_open_time = models.DateTimeField(null=True, blank=True)

    # Rendiconto Finanziario (REFA) state
    is_refa_done = models.BooleanField(default=False)

    # Profile fields columns (i.e. name, surname, email) to be shown in the event list tables
    profile_fields = models.JSONField(default=list, blank=True)

    # Unified fields (replaces form_fields and additional_fields)
    fields = models.JSONField(default=list, blank=True)

    # Manage via event modla toggle, to notify to the Erasmus via confirmation email the assigned list
    notify_list = models.BooleanField(default=True)

    # Make the event visible only to board members
    visible_to_board_only = models.BooleanField(default=False)

    # Make the reimbursements doable only by organizers or board members
    reimbursements_by_organizers_only = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.date})"

    def clean(self):
        super().clean()
        if self.profile_fields is not None:
            validate(instance=self.profile_fields, schema=profile_fields_schema)
        if self.fields is not None:
            validate(instance=self.fields, schema=unified_fields_schema)

        # Validate that form_programmed_open_time is after subscription_start_date
        if (self.form_programmed_open_time and self.subscription_start_date and
                self.form_programmed_open_time <= self.subscription_start_date):
            raise ValidationError({
                'form_programmed_open_time': 'Form opening time must be after subscription start date.'
            })

        # Validate that form_programmed_open_time is before subscription_end_date
        if (self.form_programmed_open_time and self.subscription_end_date and
                self.form_programmed_open_time >= self.subscription_end_date):
            raise ValidationError({
                'form_programmed_open_time': 'Form opening time must be before subscription end date.'
            })

    @property
    def form_fields(self):
        return [f for f in self.fields if f.get('field_type') == 'form']

    @property
    def additional_fields(self):
        return [f for f in self.fields if f.get('field_type') == 'additional']

    @property
    def is_form_open(self):
        """
        Returns True if the event form is enabled and (if programmed open time is set) the current time is after it.
        """
        if not self.enable_form:
            return False
        if self.form_programmed_open_time:
            return timezone.now() >= self.form_programmed_open_time
        return True

    @property
    def status(self):
        now = timezone.now()
        if self.subscription_start_date and self.subscription_end_date:
            if self.subscription_start_date <= now <= self.subscription_end_date:
                return "open"
            elif now < self.subscription_start_date:
                return "not_yet"
            else:
                return "closed"
        elif self.subscription_start_date and not self.subscription_end_date:
            if now >= self.subscription_start_date:
                return "open"
            else:
                return "not_yet"
        elif not self.subscription_start_date and self.subscription_end_date:
            if now <= self.subscription_end_date:
                return "open"
            else:
                return "closed"
        else:
            return "open"


class EventOrganizer(BaseEntity):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='organizers')
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='organized_events')

    # Optional fields to track roles or permissions
    is_lead = models.BooleanField(default=False)
    role = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        unique_together = ('event', 'profile')
        ordering = ['-is_lead', 'id']  # leaders first

    def __str__(self):
        return f"{self.profile} - {self.event}"


class EventListEvent(models.Model):
    """
    Intermediate table for Many-to-Many relationship between EventList and Event.
    Allows a single EventList to be shared across multiple Events.
    """
    eventlist = models.ForeignKey('EventList', on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)

    class Meta:
        db_table = 'events_eventlist_events'
        unique_together = [['eventlist', 'event']]

    def __str__(self):
        return f"{self.eventlist.name} → {self.event.name}"


class EventList(BaseEntity):
    """
    Dynamic lists for events, with customizable names and capacities.

    Many-to-Many Implementation:
    - A single EventList can be shared across multiple Events
    - Changes to name/capacity are synchronized across all events
    - Capacity is pooled: all events share the same total capacity
    - Subscriptions count towards the shared capacity pool
    """
    # Many-to-Many relationship with Event through EventListEvent
    events = models.ManyToManyField(
        Event,
        related_name='lists',
        through='EventListEvent',
        help_text='Eventi che utilizzano questa lista'
    )

    name = models.CharField(max_length=64)
    capacity = models.PositiveIntegerField(default=0)  # 0 means unlimited

    # Display order in the UI
    display_order = models.PositiveIntegerField(default=0)

    # Indicates if this is the main list or a waiting list, or neither
    is_main_list = models.BooleanField(default=False)
    is_waiting_list = models.BooleanField(default=False)

    class Meta:
        ordering = ['display_order', 'id']

    def clean(self):
        super().clean()
        # Validation: only one main list and one waiting list per event
        # Note: with Many-to-Many, we need to check this for each event
        if self.pk:  # Only validate if the list already exists
            for event in self.events.all():
                if self.is_main_list:
                    qs = EventList.objects.filter(events=event, is_main_list=True).exclude(pk=self.pk)
                    if qs.exists():
                        raise ValidationError(f"Only one Main List is allowed per event (conflict with {event.name}).")
                if self.is_waiting_list:
                    qs = EventList.objects.filter(events=event, is_waiting_list=True).exclude(pk=self.pk)
                    if qs.exists():
                        raise ValidationError(f"Only one Waiting List is allowed per event (conflict with {event.name}).")

    def __str__(self):
        event_names = ', '.join([event.name for event in self.events.all()[:3]])
        if self.events.count() > 3:
            event_names += f' (+{self.events.count() - 3} more)'
        return f"{self.name} ({event_names})" if event_names else f"{self.name}"

    @property
    def subscription_count(self):
        """
        Total subscriptions across all events sharing this list.
        This counts towards the shared capacity pool.
        """
        return self.subscriptions.count()

    @property
    def available_capacity(self):
        """
        Available capacity in the shared pool.
        Returns None for unlimited capacity (capacity=0).
        """
        if self.capacity == 0:
            return None  # Unlimited capacity
        return max(0, self.capacity - self.subscription_count)


class SubscriptionStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    PAID = 'paid', 'Paid'
    REIMBURSED = 'reimbursed', 'Reimbursed'
    FAILED = 'failed', 'Failed'


class Subscription(BaseEntity):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, blank=True, null=True)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    list = models.ForeignKey(EventList, on_delete=models.CASCADE, related_name='subscriptions')
    external_name = models.CharField(max_length=128, blank=True, null=True)
    enable_refund = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    created_by_form = models.BooleanField(default=False)
    form_data = models.JSONField(blank=True, default=dict)
    form_notes = models.TextField(blank=True, null=True)
    additional_data = models.JSONField(blank=True, default=dict)

    # --- SumUp integration fields ---
    sumup_checkout_id = models.CharField(max_length=255, blank=True, null=True)
    sumup_transaction_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['profile', 'event'],
                name='unique_profile_event_combination'
            )
        ]

    def clean(self):
        super().clean()
        # Ensure list capacity isn't exceeded (if capacity is not 0/unlimited)
        if self.list.capacity > 0:
            current_count = Subscription.objects.filter(list=self.list).exclude(pk=self.pk).count()
            if current_count >= self.list.capacity:
                raise ValidationError(f"{self.list.name} capacity exceeded")
        # Validate form data using unified fields
        if self.form_data:
            errors = validate_field_data(self.event.fields, self.form_data, 'form')
            if errors:
                raise ValidationError('; '.join(errors))
        # Validate additional data using unified fields
        if self.additional_data:
            errors = validate_field_data(self.event.fields, self.additional_data, 'additional')
            if errors:
                raise ValidationError('; '.join(errors))

    def __str__(self):
        return f"{self.profile} - {self.event} ({self.list.name})"


CANONICAL_PROFILE_ORDER = [
    'name', 'surname', 'birthdate', 'email', 'latest_esncard', 'country', 'domicile',
    'phone_prefix', 'phone_number', 'whatsapp_prefix', 'whatsapp_number',
    'latest_document', 'course', 'matricola_expiration', 'person_code', 'matricola_number'
]


def order_profile_fields(fields):
    return [f for f in CANONICAL_PROFILE_ORDER if f in fields]
