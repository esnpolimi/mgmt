import logging
from datetime import datetime
from django.core.exceptions import PermissionDenied, ObjectDoesNotExist
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from treasury.models import Transaction, Account
from treasury.serializers import TransactionViewSerializer, AccountViewSerializer, AccountEditSerializer, AccountCreateSerializer, ESNCardEmissionSerializer, TransactionCreateSerializer
from events.models import Event, Subscription

logger = logging.getLogger(__name__)


# Endpoint for ESNCard emission.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def esncard_emission(request):
    try:
        esncard_serializer = ESNCardEmissionSerializer(data=request.data)
        if not esncard_serializer.is_valid():
            return Response(esncard_serializer.errors, status=400)

        with transaction.atomic():
            esncard = esncard_serializer.save()
            event = Event.objects.filter(name='Anno Associativo ' + esncard.membership_year)
            if not event.exists():
                event = Event(name='Anno Associativo ' + esncard.membership_year,
                              tables={'associati': {'capacity': 100000, 'visible_by_office': True, 'editable_by_office': False}},
                              profile_fields=[], form_fields={}, additional_fields={})
                event.save()
            else:
                event = event.get()

            subscription = event.subscription_set.filter(profile=esncard.profile)
            if not subscription.exists():
                subscription = Subscription(profile=esncard.profile, event=event,
                                            event_data={'table': 'associati'},
                                            form_data={}, additional_data={}, created_at=datetime.now())
                subscription.save()
                amount = 10.0
            else:
                subscription = subscription.get()
                amount = 2.5

            t = Transaction(subscription=subscription, account=esncard_serializer.validated_data['account'],
                            executor=request.user, amount=amount,
                            description="ESNCard emission")
            t.save()
            return Response(esncard_serializer.data, status=200)

    except PermissionDenied as e:
        return Response(str(e), status=403)

    except (ObjectDoesNotExist, ValueError) as e:
        return Response(str(e), status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


#   Endpoint for adding a transaction
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transaction_add(request):
    try:
        transaction_serializer = TransactionCreateSerializer(request.data)
        if not transaction_serializer.is_valid():
            return Response(transaction_serializer.errors, status=400)

        if transaction_serializer.validated_data['subscription'] is None:
            if not request.user.has_perm('treasury.withdraw_deposit'): #TODO: add permission via Meta in model
                return Response(status=401)

        transaction_serializer.save()
        return Response(status=200)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


#   Endpoint to retrieve list of transactions
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transactions_list(request):
    try:
        transactions = Transaction.objects.all()
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(transactions, request=request)
        serializer = TransactionViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


# Endpoint to retrive transaction details based on id
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_detail(request, pk):
    try:
        transaction = Transaction.objects.get(pk=pk)
        serializer = TransactionViewSerializer(transaction)
        return Response(serializer.data, status=200)

    except Transaction.DoesNotExist:
        return Response(status=404)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


# Endpoint to retrieve all accounts 
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def accounts_list(request):
    try:
        accounts = Account.objects.all()
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(accounts, request=request)
        serializer = AccountViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


# Endpoint to create new account
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def account_creation(request):
    try:
        if not request.user.has_perm('treasury.add_account'):
            return Response(status=401)

        account_serializer = AccountCreateSerializer(request.data)
        if not account_serializer.is_valid():
            return Response(account_serializer.errors, status=400)

        account_serializer.save(changed_by=request.user)
        return Response(status=200)
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


# Endpoint to retrieve account info / edit account
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def account_detail(request, pk):
    try:
        account = Account.objects.get(pk=pk)

        if request.method == 'GET':
            serializer = AccountViewSerializer(account)
            return Response(serializer.data, status=200)

        if request.method == 'PATCH':

            if not request.user.has_perm('treasury.change_acconut'):
                return Response(status=401)

            data = request.data
            data['changed_by'] = request.user

            serializer = AccountEditSerializer(account, data=data, partial=True)
            if not serializer.is_valid():
                return Response(serializer.errors, status=400)

            serializer.save()
            return Response(serializer.data, status=200)

    except Account.DoesNotExist:
        return Response(status=404)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
