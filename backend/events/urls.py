from django.urls import path
from events import views

urlpatterns = [

    # Endpoint to retrieve list of events
    path('events/', views.events_list),

    # Endpoint to create event
    path('event/', views.event_creation),

    # Endpoint to edit/view/delete event in detail
    path('event/<str:pk>/', views.event_detail),

    # Endpoint to create subscription
    path('subscription/', views.subscription_create),

    # Endpoint to edit/view/delete subscription in detail
    path('subscription/<str:pk>/', views.subscription_detail),

    # Endpoint to move subscriptions to another list
    path('move-subscriptions/', views.move_subscriptions),

    # Endpoint to print liberatorie for an event
    path('event/<str:event_id>/printable_liberatorie/', views.printable_liberatorie),

    # Endpoint to generate liberatorie PDF
    path('generate_liberatorie_pdf/', views.generate_liberatorie_pdf),

    # Public endpoint to retrieve event form configuration
    path('event/<str:event_id>/form/', views.event_form_view),
]
