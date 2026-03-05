from django.urls import path
from . import views

urlpatterns = [
    # SSE stream - clients connect once and listen for push events (legacy/fallback)
    path('maintenance/stream/', views.maintenance_stream, name='maintenance-stream'),
    # Polling endpoint
    path('maintenance/status/', views.maintenance_status, name='maintenance-status'),
]
