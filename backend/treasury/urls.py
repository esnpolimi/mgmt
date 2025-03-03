from django.urls import path
from treasury import views

urlpatterns = [
    path('esncard_emission/',views.esncard_emission),
    path('esncard/<str:pk>/', views.esncard_detail),
    path('transaction/', views.transaction_add),
    path('transaction/<str:pk>/', views.transaction_detail ),
    path('transactions/', views.transactions_list),
    path('accounts/', views.accounts_list),
    path('account/', views.account_creation),
    path('account/<str:pk>/', views.account_detail),
]