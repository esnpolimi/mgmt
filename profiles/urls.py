from django.urls import path
from profiles import views

urlpatterns = [
    path('profiles/', views.profile_list),
    path('profile/',views.profile_creation),
    path('profile/<str:pk>/',views.profile_detail),
    path('profile/<str:pk>/verification/<str:token>/',views.profile_verification),

    path('document/',views.document_creation),
    path('document/<str:pk>/',views.document_detail),
    
    path('matricola/',views.matricola_creation),
    path('matricola/<str:pk>/',views.matricola_detail),
]