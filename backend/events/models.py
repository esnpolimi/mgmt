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
# Example: ['name','surname','email',...] TODO: check fields
profile_fields_schema = {
    "type": "array",
    "items": {"enum": [
        'id', 'name', 'surname', 'email', 'phone_prefix', 'phone_number', 'whatsapp_prefix',
        'whatsapp_number', 'country', 'birthdate', 'latest_esncard', 'latest_document',
        'matricola_number', 'matricola_expiration', 'course', 'person_code', 'domicile'
    ]}
}

# Schema of json representing the questions / fields asked in the form.
# Types:
#  't': testo
#  'n': numero
#  'c': choice, risposta singola
#  'm': multiple choice, risposta multipla
#  'b': boolean, risposta yes/no
#
# Example: [{'text':'What are your allergies?', 'type':'t'},
#           {'text':'Are you vegan?','type':'b', 'choices':['yes','no'] }]
#
# Note: this schema requires that 'choices':[] should be specified also for text or number field types.
form_fields_schema = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "type": {"enum": ["t", "n", "c", "m", "b"]},
            "choices": {
                "type": "array",
                "items": {"type": "string"}
            }
        },
    }
}

# Schema of json representing the additional fields / columns for the lists / tables.
# Types of data are specified as before.
# Additionally, there is the possibility of restricting the ability to view / edit by the office.
#
# Accessibility legend:
#   0: office can view and edit
#   1: office can view, cannot edit
#   2: office cannot view nor edit
#
# Example: [{'name': 'Pagamento verificato', 'type':'b', 'choices':['Yes','No'], 'accessibility':0},
#           {'name': 'Contattato via email','type':'b', 'choices':['Yes','No'], 'accessibility':2 }]
additional_fields_schema = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},  # fixed from "text"
            "type": {"enum": ["t", "n", "c", "m", "b"]},
            "choices": {
                "type": "array",
                "items": {"type": "string"}
            },
            "accessibility": {"enum": [0, 1, 2]}
        },
        "required": ["name", "type", "choices", "accessibility"]
    }
}


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

    # Indicates whether form is open
    form_open = models.BooleanField(default=False)

    # Required profile fields (i.e. name, surname, whatsapp number, email)
    profile_fields = models.JSONField(default=list, blank=True)

    # Form fields ( questions ) (i.e. 'Are you vegetarian?' )
    form_fields = models.JSONField(default=list, blank=True)

    # Additional fields ( columns ) in the lists
    additional_fields = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.name} ({self.date})"

    def clean(self):
        super().clean()
        if self.profile_fields is not None:
            validate(instance=self.profile_fields, schema=profile_fields_schema)
        if self.form_fields is not None:
            validate(instance=self.form_fields, schema=form_fields_schema)
        if self.additional_fields is not None:
            validate(instance=self.additional_fields, schema=additional_fields_schema)

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
        ordering = ['is_lead', 'id']

    def __str__(self):
        return f"{self.profile} - {self.event}"


class EventList(BaseEntity):
    """
    Dynamic lists for events, with customizable names and capacities
    """
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='lists')
    name = models.CharField(max_length=64)
    capacity = models.PositiveIntegerField(default=0)  # 0 means unlimited

    # Display order in the UI
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('event', 'name')
        ordering = ['display_order', 'id']

    def __str__(self):
        return f"{self.name} ({self.event.name})"

    @property
    def subscription_count(self):
        return self.subscriptions.count()


class SubscriptionStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    PAID = 'paid', 'Paid'
    REIMBURSED = 'reimbursed', 'Reimbursed'
    CANCELLED = 'cancelled', 'Cancelled'


class Subscription(BaseEntity):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, blank=True, null=True)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    list = models.ForeignKey(EventList, on_delete=models.CASCADE, related_name='subscriptions')
    external_name = models.CharField(max_length=128, blank=True, null=True)
    enable_refund = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    created_by_form = models.BooleanField(default=False)
    form_data = models.JSONField(blank=True, default=dict)  # Use dict for key-value answers
    additional_data = models.JSONField(blank=True, default=dict)  # Use dict for key-value answers

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

        # Validate form data
        if self.form_data:
            for question in self.event.form_fields:
                text = question['text']
                type_ = question['type']
                if text not in self.form_data:
                    raise ValidationError(f'Missing form data for field "{text}"')
                value = self.form_data[text]
                if type_ == 't' and not isinstance(value, str):
                    raise ValidationError(f'Invalid data type for field "{text}"')
                if type_ == 'n' and not isinstance(value, (int, float)):
                    raise ValidationError(f'Invalid data type for field "{text}"')
                if type_ == 'c' and value not in question['choices']:
                    raise ValidationError(f'Invalid value for field "{text}"')
                if type_ == 'm':
                    if not isinstance(value, list):
                        raise ValidationError(f'Invalid data type for field "{text}"')
                    for ans in value:
                        if ans not in question['choices']:
                            raise ValidationError(f'Invalid value for field "{text}"')
                if type_ == 'b' and not isinstance(value, bool):
                    raise ValidationError(f'Invalid data type for field "{text}"')
            for provided_field in self.form_data.keys():
                if provided_field not in [f['text'] for f in self.event.form_fields]:
                    raise ValidationError(f"Unknown form field '{provided_field}' provided in form_data")

        # Validate additional data, i.e. check that it contains valid values for the additional fields.
        if self.additional_data:
            for field in self.event.additional_fields:
                name = field['name']
                type_ = field['type']
                if name not in self.additional_data:
                    continue
                value = self.additional_data[name]
                if type_ == 't' and not isinstance(value, str):
                    raise ValidationError(f'Invalid data type for field "{name}"')
                if type_ == 'n' and not isinstance(value, (int, float)):
                    raise ValidationError(f'Invalid data type for field "{name}"')
                if type_ == 'c' and value not in field['choices']:
                    raise ValidationError(f'Invalid value for field "{name}"')
                if type_ == 'm':
                    if not isinstance(value, list):
                        raise ValidationError(f'Invalid data type for field "{name}"')
                    for val in value:
                        if val not in field['choices']:
                            raise ValidationError(f'Invalid value for field "{name}"')
                if type_ == 'b' and not isinstance(value, bool):
                    raise ValidationError(f'Invalid data type for field "{name}"')
            for provided_field in self.additional_data.keys():
                if provided_field not in [f['name'] for f in self.event.additional_fields]:
                    raise ValidationError(f"Unknown additional field '{provided_field}' provided in additional_data")

    def __str__(self):
        return f"{self.profile} - {self.event} ({self.list.name})"
