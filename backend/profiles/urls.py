from django.urls import path
from profiles import views

urlpatterns = [
    path('erasmus_profiles/', lambda request: views.profile_list(request, is_esner=False)),  # Erasmus profiles
    path('esner_profiles/', lambda request: views.profile_list(request, is_esner=True)),  # ESNer profiles
    path('profile/initiate-creation/', views.initiate_profile_creation),  # creates a profile
    path('api/profile/verify-email/<str:uid>/<str:token>/', views.verify_email_and_enable_profile),
    path('profile/<str:pk>/', views.profile_detail),  # returns detailed profile, including esncards, documents and matricole
    path('profile_subscriptions/<str:pk>/', views.profile_subscriptions),  # subscriptions for profile
    path('profile_events/<str:pk>/', views.profile_organized_events),  # events organized by an ESNer
    path('document/', views.document_creation),  # creates a new document
    path('document/<str:pk>/', views.document_detail),
    path('profiles/search/', views.search_profiles),  # search for profiles by name, surname, or email
    path('check_erasmus_email/', views.check_erasmus_email),  # public: check if email belongs to an Erasmus
]
