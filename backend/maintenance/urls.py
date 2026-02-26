from django.urls import path
from . import views

urlpatterns = [
    # SSE stream – clients connect once and listen for push events
    path('maintenance/stream/', views.maintenance_stream, name='maintenance-stream'),
]
