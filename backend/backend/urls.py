from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("backend/", include('users.urls')),
    path("backend/", include('profiles.urls')),
    path("backend/", include('treasury.urls')),
    path("backend/", include('events.urls')),
    path("backend/content/", include('content.urls'))
]
