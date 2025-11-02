from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContentSectionViewSet, ContentLinkViewSet

router = DefaultRouter()
router.register(r'sections', ContentSectionViewSet, basename='content-section')
router.register(r'links', ContentLinkViewSet, basename='content-link')

urlpatterns = [
    path('', include(router.urls)),
]
