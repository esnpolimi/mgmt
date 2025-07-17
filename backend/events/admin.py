from django.contrib import admin
from events.models import Event, EventList, EventOrganizer, Subscription


class EventListInline(admin.TabularInline):
    model = EventList
    extra = 1


class EventOrganizerInline(admin.TabularInline):
    model = EventOrganizer
    extra = 1


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'date', 'cost', 'subscription_count', 'organizer_count', 'created_at'
    )
    search_fields = ('name', 'description')
    list_filter = ('date', 'created_at')
    date_hierarchy = 'created_at'
    inlines = [EventListInline, EventOrganizerInline]

    def subscription_count(self, obj):
        return obj.subscription_set.count()

    def organizer_count(self, obj):
        return obj.organizers.count()

    subscription_count.short_description = 'Subscriptions'
    organizer_count.short_description = 'Organizers'

    def get_queryset(self, request):
        # Prefetch organizers for efficiency
        return super().get_queryset(request).prefetch_related('organizers')


@admin.register(EventList)
class EventListAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'event', 'capacity', 'display_order', 'subscription_count'
    )
    list_filter = ('event', 'capacity')
    search_fields = ('name', 'event__name')

    def subscription_count(self, obj):
        return obj.subscriptions.count()

    subscription_count.short_description = 'Subscriptions'

    def get_queryset(self, request):
        # Prefetch subscriptions for efficiency
        return super().get_queryset(request).prefetch_related('subscriptions')


'''
@admin.register(EventOrganizer)
class EventOrganizerAdmin(admin.ModelAdmin):
    list_display = ('profile', 'event', 'is_lead', 'role')
    list_filter = ('event', 'is_lead')
    search_fields = (
        'profile__name', 'profile__surname', 'profile__email', 'event__name', 'role'
    )
'''

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        'profile', 'event', 'list', 'created_at'
    )
    list_filter = (
        'event', 'list', 'created_at', 'enable_refund'
    )
    search_fields = (
        'profile__name', 'profile__surname', 'profile__email', 'event__name', 'list__name'
    )
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at')

    def get_queryset(self, request):
        # Prefetch related user for efficiency
        return super().get_queryset(request).select_related('profile__user')

    def get_list(self, obj):
        try:
            return obj.list
        except Subscription.list.RelatedObjectDoesNotExist:
            return "-"

    get_list.short_description = 'List'