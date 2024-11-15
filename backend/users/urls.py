from django.urls import path
from users import views

urlpatterns = [
    path('users/', views.user_list),
    path('user_profiles/', views.user_with_profile_list),
    path('users/<str:pk>/', views.user_detail),
    path('login/', views.log_in)
]