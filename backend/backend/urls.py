from django.contrib import admin
from django.urls import path, include
from users import views
from maintenance.views import maintenance_admin_view

BACKEND_API_PREFIX = "backend/"
BACKEND_CONTENT_PREFIX = "backend/content/"

urlpatterns = [
    path("admin/maintenance-notify/", admin.site.admin_view(maintenance_admin_view), name='maintenance-admin-notify'),
    path("admin/", admin.site.urls),
    path(BACKEND_API_PREFIX, include('users.urls')),
    path(BACKEND_API_PREFIX, include('profiles.urls')),
    path(BACKEND_API_PREFIX, include('treasury.urls')),
    path(BACKEND_API_PREFIX, include('events.urls')),
    path(BACKEND_CONTENT_PREFIX, include('content.urls')),
    path(BACKEND_API_PREFIX, include('maintenance.urls')),

    # Dokuwiki integration
    path('openid/', include('oidc_provider.urls', namespace='oidc_provider')),
    path('login_for_oauth/', views.login_for_oauth, name='login'),
]
