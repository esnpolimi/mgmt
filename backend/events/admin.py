from django.contrib import admin
from events.models import Event, EventTable, EventOrganizer, Subscription


class EventTableInline(admin.TabularInline):
    model = EventTable
    extra = 1


class EventOrganizerInline(admin.TabularInline):
    model = EventOrganizer
    extra = 1


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('name', 'date', 'cost', 'subscription_count', 'organizer_count', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('date', 'created_at')
    date_hierarchy = 'created_at'
    inlines = [EventTableInline, EventOrganizerInline]

    def subscription_count(self, obj):
        return obj.subscription_set.count()

    def organizer_count(self, obj):
        return obj.organizers.count()

    subscription_count.short_description = 'Subscriptions'
    organizer_count.short_description = 'Organizers'


@admin.register(EventTable)
class EventTableAdmin(admin.ModelAdmin):
    list_display = ('name', 'event', 'capacity', 'display_order', 'subscription_count')
    list_filter = ('event', 'capacity')
    search_fields = ('name', 'event__name')

    def subscription_count(self, obj):
        return obj.subscriptions.count()

    subscription_count.short_description = 'Subscriptions'


@admin.register(EventOrganizer)
class EventOrganizerAdmin(admin.ModelAdmin):
    list_display = ('profile', 'event', 'is_lead', 'role')
    list_filter = ('event', 'is_lead')
    search_fields = ('profile__name', 'profile__surname', 'profile__email', 'event__name', 'role')


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('profile', 'event', 'table', 'status', 'created_at')
    list_filter = ('event', 'table', 'status', 'created_at', 'enable_refund')
    search_fields = ('profile__name', 'profile__surname', 'profile__email', 'event__name', 'table__name')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at')

    def get_table(self, obj):
        try:
            return obj.table
        except Subscription.table.RelatedObjectDoesNotExist:
            return "-"

    get_table.short_description = 'Table'