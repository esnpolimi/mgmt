from django.core.management.base import BaseCommand
from users.models import User
from profiles.models import Profile

class Command(BaseCommand):
    help = "Creates superuser and its profile"

    def add_arguments(self, parser):
        parser.add_argument("email", nargs=1, type=str)
        parser.add_argument("password", nargs=1, type=str)

    def handle(self, *args, **options):
        email = options['email'][0]
        psw = options['password'][0]
        
        profile = Profile(email=email)
        profile.save()
        user = User(profile=profile)
        user.is_superuser = True
        user.is_staff = True
        user.set_password(psw)
        user.save()
