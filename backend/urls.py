from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("backend/", include('users.urls')),
    path("backend/", include('profiles.urls')),
    path("backend/", include('treasury.urls')),
    path("backend/", include('events.urls')),
    path("backend/content/", include('content.urls')),
    # TODO: Install django-oidc-provider and configure before enabling
    # path('openid/', include('oidc_provider.urls', namespace='oidc_provider')),
    # This gives us endpoints like:
    #   https://mgmt.esnpolimi.it/openid/authorize/
    #   https://mgmt.esnpolimi.it/openid/token/
    #   https://mgmt.esnpolimi.it/openid/userinfo/

]
