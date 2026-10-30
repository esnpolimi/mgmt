from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ContentSectionViewSet, ContentLinkViewSet, whatsapp_config, whatsapp_register,
    wishlist_submit, wishlist_lookup, wishlist_submissions,
)

router = DefaultRouter()
router.register(r'sections', ContentSectionViewSet, basename='content-section')
router.register(r'links', ContentLinkViewSet, basename='content-link')

urlpatterns = [
    path('', include(router.urls)),
    path('whatsapp-config/', whatsapp_config, name='whatsapp-config'),
    path('whatsapp-register/', whatsapp_register, name='whatsapp-register'),
    path('wishlist/', wishlist_submit, name='wishlist-submit'),
    path('wishlist-lookup/', wishlist_lookup, name='wishlist-lookup'),
    path('wishlist-submissions/', wishlist_submissions, name='wishlist-submissions'),
]
