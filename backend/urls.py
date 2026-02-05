from django.contrib import admin
from django.urls import path, include
from users import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("backend/", include('users.urls')),
    path("backend/", include('profiles.urls')),
    path("backend/", include('treasury.urls')),
    path("backend/", include('events.urls')),
    path("backend/content/", include('content.urls')),

    # Dokuwiki integration
    path('openid/', include('oidc_provider.urls', namespace='oidc_provider')),
    path('login_for_oauth/', views.login_for_oauth, name='login'),
]
