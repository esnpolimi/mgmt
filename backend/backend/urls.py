from django.contrib import admin
from django.urls import path, include


def trigger_error(request):
    division_by_zero = 1 / 0


urlpatterns = [
    path("admin/", admin.site.urls),
    path("backend/", include('users.urls')),
    path("backend/", include('profiles.urls')),
    path("backend/", include('treasury.urls')),
    path("backend/", include('events.urls')),
    path("sentrydebug/", trigger_error),
]
