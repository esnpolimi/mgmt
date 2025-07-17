from django.contrib import admin
from django.utils.html import format_html
from treasury.models import ESNcard, Transaction, Account, Settings, ReimbursementRequest


@admin.register(Settings)
class SettingsAdmin(admin.ModelAdmin):
    list_display = ('esncard_release_fee', 'esncard_lost_fee')


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
        if obj.balance < 0:
            return format_html('<span style="color: red;">{}</span>', obj.balance)
        return obj.balance

    balance_display.short_description = 'Balance'


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'account_link',
        'type',
        'amount_display',
        'description',
        'executor_link',
        'subscription_link',
        'esncard_link',
        'created_at',
        'updated_at',
    )
    list_filter = (
        'type',
        'account',
        'esncard',
        'subscription',
        'executor',
        'created_at',
        'amount',
    )
    search_fields = (
        'description',
        'account__name',
        'executor__account__name',
        'esncard__number',
        'subscription__event__name',
        'subscription__profile__name',
        'subscription__profile__surname',
    )
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    list_per_page = 50

    def account_link(self, obj):
        if obj.account:
            return format_html('<a href="/admin/treasury/account/{}/change/">{}</a>', obj.account.id, obj.account.name)
        return "-"
    account_link.short_description = 'Account'
    account_link.admin_order_field = 'account__name'

    def executor_link(self, obj):
        if obj.executor and hasattr(obj.executor, 'profile'):
            profile = obj.executor.profile
            return format_html('<a href="/admin/profiles/profile/{}/change/">{}</a>', profile.id, f"{profile.name} {profile.surname}")
        return "-"
    executor_link.short_description = 'Executor'
    executor_link.admin_order_field = 'executor__profile__name'

    def subscription_link(self, obj):
        if obj.subscription:
            event = obj.subscription.event
            profile = obj.subscription.profile
            return format_html(
                '<a href="/admin/events/subscription/{}/change/">{}</a> ({})',
                obj.subscription.id,
                event.name,
                f"{profile.name} {profile.surname}"
            )
        return "-"
    subscription_link.short_description = 'Subscription'
    subscription_link.admin_order_field = 'subscription__event__name'

    def esncard_link(self, obj):
        if obj.esncard:
            return format_html('<a href="/admin/treasury/esncard/{}/change/">{}</a>', obj.esncard.id, obj.esncard.number)
        return "-"
    esncard_link.short_description = 'ESNcard'
    esncard_link.admin_order_field = 'esncard__number'

    def amount_display(self, obj):
        color = "red" if obj.amount < 0 else "green"
        return format_html('<span style="color: {};">{}</span>', color, obj.amount)
    amount_display.short_description = 'Amount'
    amount_display.admin_order_field = 'amount'

    # Optional: bulk export action
    actions = ['export_selected']

    def export_selected(self, request, queryset):
        import csv
        from django.http import HttpResponse
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=transactions.csv'
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Account', 'Type', 'Amount', 'Description', 'Executor', 'Subscription', 'ESNcard', 'Created At', 'Updated At'
        ])
        for obj in queryset:
            writer.writerow([
                obj.id,
                obj.account.name if obj.account else '',
                obj.type,
                obj.amount,
                obj.description,
                f"{obj.executor.profile.name} {obj.executor.profile.surname}" if hasattr(obj.executor, 'profile') else '',
                f"{obj.subscription.event.name} ({obj.subscription.profile.name} {obj.subscription.profile.surname})" if obj.subscription else '',
                obj.esncard.number if obj.esncard else '',
                obj.created_at,
                obj.updated_at,
            ])
        return response
    export_selected.short_description = "Export selected transactions to CSV"


@admin.register(ReimbursementRequest)
class ReimbursementRequestAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user_link',
        'amount',
        'payment',
        'description_short',
        'receipt_link_display',
        'account',
        'is_reimbursed',
        'created_at',
    )
    list_filter = ('payment', 'account', 'created_at', 'reimbursement_transaction')
    search_fields = ('user__profile__name', 'user__profile__surname', 'user__email', 'description')
    readonly_fields = ('created_at', 'reimbursement_transaction', 'is_reimbursed', 'receipt_link')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    def user_link(self, obj):
        profile = getattr(obj.user, 'profile', None)
        if profile:
            return format_html(
                '<a href="/admin/profiles/profile/{}/change/">{}</a>',
                profile.id,
                f"{profile.name} {profile.surname}"
            )
        return obj.user.email
    user_link.short_description = 'User'

    def description_short(self, obj):
        return (obj.description[:50] + '...') if len(obj.description) > 50 else obj.description
    description_short.short_description = 'Description'

    def receipt_link_display(self, obj):
        if obj.receipt_link:
            return format_html('<a href="{}" target="_blank">Link</a>', obj.receipt_link)
        return "-"
    receipt_link_display.short_description = 'Receipt'

    def is_reimbursed(self, obj):
        return obj.is_reimbursed
    is_reimbursed.boolean = True
    is_reimbursed.short_description = 'Reimbursed'

    def get_readonly_fields(self, request, obj=None):
        ro = list(self.readonly_fields)
        if obj and obj.is_reimbursed:
            # Make all fields readonly if reimbursed, except for 'reimbursement_transaction'
            model_fields = [f.name for f in self.model._meta.fields]
            ro = list(set(ro + model_fields))
        return ro

    def has_delete_permission(self, request, obj=None):
        # Prevent deleting reimbursed requests
        if obj and obj.is_reimbursed:
            return False
        return super().has_delete_permission(request, obj)
