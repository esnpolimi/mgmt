from typing import Any

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from profiles.models import Profile, BaseEntity


class Event(BaseEntity):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=128, unique=True)
    date = models.DateField(null=True)
    description = models.TextField(max_length=2048, null=True)
    cost = models.DecimalField(decimal_places=2, max_digits=20, null=True)
    subscription_start_date = models.DateTimeField(null=True)
    subscription_end_date = models.DateTimeField(null=True)

    # is_a_bando = models.BooleanField(default=False)
    # is_liberatoria = models.BooleanField(default=False)
    # is_automatic_reimbursement = models.BooleanField(default=False)
    # is_allow_external = models.BooleanField(default=False)

    # These fields can be uncommented when implementing the full feature set
    # enable_form = models.BooleanField(default=False)
    # profile_fields = models.JSONField(default=list, blank=True, null=True)
    # form_fields = models.JSONField(default=dict, blank=True, null=True)
    # additional_fields = models.JSONField(default=dict, blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.date})"

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

    # Fields to identify special lists that need integration with payment systems, probably not needed?
    # is_main_list = models.BooleanField(default=False)
    # is_waiting_list = models.BooleanField(default=False)

    # Display order in the UI
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('event', 'name')
        ordering = ['display_order', 'id']

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self.RelatedObjectDoesNotExist = None

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
    # TODO: Add more statuses as needed


class Subscription(BaseEntity):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    list = models.ForeignKey(EventList, on_delete=models.CASCADE, related_name='subscriptions')

    # Payment status
    status = models.CharField(
        max_length=30,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.PENDING
    )

    # For payment tracking and integration with treasury
    enable_refund = models.BooleanField(default=False)
    # Simple note field for MVP
    notes = models.TextField(blank=True, null=True)
    # For visual organization (hex color)
    # color = models.CharField(max_length=9, blank=True, null=True)
    # For tracking subscription source
    created_by_form = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['profile', 'event'],
                name='unique_profile_event_combination'
            )
        ]

    def clean(self):
        super(Subscription, self).clean()

        # Ensure list capacity isn't exceeded (if capacity is not 0/unlimited)
        if self.list.capacity > 0:
            current_count = Subscription.objects.filter(list=self.list).exclude(pk=self.pk).count()
            if current_count >= self.list.capacity:
                raise ValidationError(f"{self.list.name} capacity exceeded")

    def __str__(self):
        return f"{self.profile} - {self.event} ({self.list.name})"


# For future implementation
'''
class EventField(BaseEntity):
    """
    This model can be implemented in the future to handle dynamic fields
    for events without complex JSON structures.
    """
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='fields')
    name = models.CharField(max_length=100)

    # Field types
    TYPE_TEXT = 'text'
    TYPE_NUMBER = 'number'
    TYPE_CHOICE = 'choice'
    TYPE_CHECKBOX = 'checkbox'

    FIELD_TYPES = [
        (TYPE_TEXT, 'Text'),
        (TYPE_NUMBER, 'Number'),
        (TYPE_CHOICE, 'Choice'),
        (TYPE_CHECKBOX, 'Checkbox'),
    ]

    field_type = models.CharField(max_length=10, choices=FIELD_TYPES)
    is_profile_field = models.BooleanField(default=False)  # True if from profile data
    is_form_field = models.BooleanField(default=False)  # True if from form
    is_additional_field = models.BooleanField(default=False)  # True if additional

    # Permissions
    office_view = models.BooleanField(default=True)
    office_edit = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.get_field_type_display()}) - {self.event}"


class FieldChoice(BaseEntity):
    """
    This model can store choices for choice and checkbox fields.
    """
    field = models.ForeignKey(EventField, on_delete=models.CASCADE, related_name='choices')
    value = models.CharField(max_length=100)
    color = models.CharField(max_length=9, null=True, blank=True)  # Format: #RRGGBBAA

    def __str__(self):
        return f"{self.value} - {self.field}"


class FieldValue(BaseEntity):
    """
    This model can store actual values for fields in subscriptions.
    """
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='field_values')
    field = models.ForeignKey(EventField, on_delete=models.CASCADE)
    text_value = models.TextField(null=True, blank=True)
    number_value = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.field.name} - {self.subscription}"


class FieldValueChoice(BaseEntity):
    """
    This model can store selected choices for a field value.
    """
    field_value = models.ForeignKey(FieldValue, on_delete=models.CASCADE, related_name='selected_choices')
    choice = models.ForeignKey(FieldChoice, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.choice.value} - {self.field_value}"
        
'''
