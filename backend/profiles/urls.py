from django.urls import path
from profiles import views

urlpatterns = [
    path('erasmus_profiles/', views.erasmus_profile_list),  # returns list of Erasmus profiles (only essential data)
    path('profile/initiate-creation/', views.initiate_profile_creation),  # creates a profile
    path('api/profile/verify-email/<str:uid>/<str:token>/', views.verify_email_and_enable_profile),
    path('profile/<str:pk>/', views.profile_detail),  # returns detailed profile, including esncards, documents and matricole
    path('profile/<str:pk>/verification/<str:token>/', views.profile_verification),  # used to verify emails
    path('document/', views.document_creation),  # creates a new document
    path('document/<str:pk>/', views.document_detail)
]
