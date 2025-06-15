from django.urls import path
from users import views
from rest_framework_simplejwt.views import TokenVerifyView
from .views import CustomTokenObtainPairView

urlpatterns = [
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),  # Login
    path('api/token/refresh/', views.refresh_token_view),  # Refresh token
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),  # Verify token
    path('users/', views.user_list),
    path('users/<str:pk>/', views.user_detail),
    path('login/', views.log_in),
    path('logout/', views.log_out),
    path('api/forgot-password/', views.forgot_password),
    path('api/reset-password/<uid>/<token>/', views.reset_password),
    path('groups/', views.group_list),
]
