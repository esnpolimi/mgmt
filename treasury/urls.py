from django.urls import path
from treasury import views

urlpatterns = [
    path('esncard_emission/',views.esncard_emission),
    path('esncard/<str:pk>/', views.esncard_detail),
    path('transaction/', views.transaction_add),
    path('transaction/<str:pk>/', views.transaction_detail),
    path('transactions/', views.transactions_list),
    path('esncard_fees/', views.esncard_fees),
    path('accounts/', views.accounts_list),
    path('account/', views.account_creation),
    path('account/<str:pk>/', views.account_detail),
    path('reimbursement_request/', views.reimbursement_request_creation),
    path('reimbursement_request/<str:pk>/', views.reimbursement_request_detail),
    path('reimbursement_requests/', views.reimbursement_requests_list),
    path('reimburse_deposits/', views.reimburse_deposits),
    path('reimbursable_deposits/', views.reimbursable_deposits),
]