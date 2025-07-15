from django.core.management.base import BaseCommand
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from django.utils import timezone

class Command(BaseCommand):
    help = 'Delete expired outstanding and blacklisted tokens'

    def handle(self, *args, **kwargs):
        now = timezone.now()
        expired_outstanding = OutstandingToken.objects.filter(expires_at__lt=now)
        expired_blacklisted = BlacklistedToken.objects.filter(token__expires_at__lt=now)
        count_outstanding = expired_outstanding.count()
        count_blacklisted = expired_blacklisted.count()
        expired_blacklisted.delete()
        expired_outstanding.delete()
        self.stdout.write(self.style.SUCCESS(
            f'Deleted {count_outstanding} expired outstanding tokens and {count_blacklisted} expired blacklisted tokens.'
        ))
