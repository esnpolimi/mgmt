from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContentSectionViewSet, ContentLinkViewSet, whatsapp_config, whatsapp_register

router = DefaultRouter()
router.register(r'sections', ContentSectionViewSet, basename='content-section')
router.register(r'links', ContentLinkViewSet, basename='content-link')

urlpatterns = [
    path('', include(router.urls)),
    path('whatsapp-config/', whatsapp_config, name='whatsapp-config'),
    path('whatsapp-register/', whatsapp_register, name='whatsapp-register'),
]
