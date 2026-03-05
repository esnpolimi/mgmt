from django.contrib import admin
from django.urls import path, include
from users import views
from maintenance.views import maintenance_admin_view
from content.views import whatsapp_page

urlpatterns = [
    path("admin/maintenance-notify/", admin.site.admin_view(maintenance_admin_view), name='maintenance-admin-notify'),
    path("admin/", admin.site.urls),
    path("backend/", include('users.urls')),
    path("backend/", include('profiles.urls')),
    path("backend/", include('treasury.urls')),
    path("backend/", include('events.urls')),
    path("backend/content/", include('content.urls')),
    path("backend/", include('maintenance.urls')),

    # Dokuwiki integration
    path('openid/', include('oidc_provider.urls', namespace='oidc_provider')),
    path('login_for_oauth/', views.login_for_oauth, name='login'),

    # Standalone server-rendered pages
    path('whatsapp', whatsapp_page, name='whatsapp'),
]
