from django.urls import path
from events import views

urlpatterns = [
    path('events/', views.events_list),
    path('event/',  views.event_creation),
    path('event/<str:pk>', views.event_detail), 
    path('form_subscription/', views.form_subscription_creation),
    path('subscription/',views.manual_subscription_creation),
    path('subcription/<str:pk>', views.subscription_detail),
]