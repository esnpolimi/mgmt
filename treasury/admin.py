from django.contrib import admin
from treasury.models import ESNcard, Transaction, Account, Settings
from events.models import Event, Subscription
from django.utils.html import format_html


@admin.register(Settings)
class SettingsAdmin(admin.ModelAdmin):
    list_display = ('esncard_release_fee', 'esncard_renewal_fee')


@admin.register(ESNcard)
class ESNcardAdmin(admin.ModelAdmin):
    list_display = ('number', 'profile', 'created_at', 'expiration_date', 'is_card_valid', 'membership_year')
    search_fields = ('number', 'profile__name', 'profile__surname', 'profile__email')
    list_filter = ('created_at', 'profile__is_esner')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    def expiration_date(self, obj):
        return obj.expiration

    expiration_date.short_description = 'Expiration Date'

    def is_card_valid(self, obj):
        return obj.is_valid

    is_card_valid.boolean = True
    is_card_valid.short_description = 'Valid'


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'balance_display', 'changed_by', 'created_at', 'updated_at')
    list_filter = ('status', 'created_at', 'updated_at')
    search_fields = ('name', 'changed_by__account__name')
    readonly_fields = ('balance', 'created_at', 'updated_at')

    def balance_display(self, obj):
        if obj.balance.amount < 0:
            return format_html('<span style="color: red;">{}</span>', obj.balance)
        return obj.balance

    balance_display.short_description = 'Balance'


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'account__name', 'amount_display', 'description', 'executor', 'subscription_link', 'created_at')
    list_filter = ('account', 'created_at', 'executor')
    search_fields = ('description', 'account__name', 'executor__account__name')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at')

    def amount_display(self, obj):
        if obj.amount.amount < 0:
            return format_html('<span style="color: red;">{}</span>', obj.amount)
        return format_html('<span style="color: green;">{}</span>', obj.amount)

    amount_display.short_description = 'Amount'

    def subscription_link(self, obj):
        if obj.subscription:
            return format_html('<a href="/admin/events/subscription/{}/">{}</a>',
                               obj.subscription.pk,
                               f"{obj.subscription.profile}")
        return "-"

    subscription_link.short_description = 'Subscription'
