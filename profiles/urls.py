from django.urls import path
from profiles import views

urlpatterns = [
    path('profiles/', views.profile_list),  # returns list of profiles, without related esncards, documents, matricole

    path('profile/', views.profile_creation),  # creates a profile

    path('profile/<str:pk>/', views.profile_detail),  # returns detailed profile, including esncards, documents and matricole

    path('profile/<str:pk>/verification/<str:token>/', views.profile_verification),  # used to verify emails

    path('document/', views.document_creation),  # creates a new document

    path('document/<str:pk>/', views.document_detail),

    path('matricola/', views.matricola_creation),
    path('matricola/<str:pk>/', views.matricola_detail),
]
