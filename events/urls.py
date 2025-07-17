from django.urls import path
from events import views

urlpatterns = [
    path('events/', views.events_list),
    path('event/',  views.event_creation),
    path('event/<str:pk>/', views.event_detail),
    #path('form_subscription/', views.form_subscription_creation),
    path('subscription/',views.subscription_create),
    path('subscription/<str:pk>/', views.subscription_detail),
    path('move-subscriptions/', views.move_subscriptions),
    path('event/<str:event_id>/printable_liberatorie/', views.printable_liberatorie),
    path('generate_liberatorie_pdf/', views.generate_liberatorie_pdf),
]