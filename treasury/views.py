import logging
from django.core.exceptions import PermissionDenied, ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from profiles.models import Profile
from users.models import User
from treasury.models import Transaction, Account, ESNcard, Settings
from treasury.serializers import TransactionViewSerializer, AccountDetailedViewSerializer, AccountEditSerializer, AccountCreateSerializer, ESNcardEmissionSerializer, TransactionCreateSerializer, \
    ESNcardSerializer, AccountListViewSerializer

logger = logging.getLogger(__name__)


# Endpoint for ESNcard emission.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def esncard_emission(request):
    try:
        profile = Profile.objects.filter(id=request.data['profile_id']).first()
        latest_card = profile.latest_esncard if profile else None
        print("Latest card for" + str(profile) + ": " + str(latest_card))
        esncard_serializer = ESNcardEmissionSerializer(data=request.data)
        if not esncard_serializer.is_valid():
            return Response(esncard_serializer.errors, status=400)

        with transaction.atomic():
            esncard = esncard_serializer.save()

            # Get the appropriate fee amount from settings
            settings = Settings.get()
            if latest_card:
                if latest_card.is_valid:
                    amount = float(settings.esncard_lost_fee.amount)
                    description = "Emissione ESNcard smarrita"
                else:
                    amount = float(settings.esncard_release_fee.amount)
                    description = "Rinnovo ESNcard"
            else:
                amount = float(settings.esncard_release_fee.amount)
                description = "Emissione ESNcard"

            # Create the transaction
            t = Transaction(
                type=Transaction.TransactionType.ESNCARD,
                esncard=esncard,
                account=esncard_serializer.validated_data['account_id'],
                executor=request.user,
                amount=amount,
                description=f"{description}: {esncard.profile.name} {esncard.profile.surname}"
            )
            t.save()

            # Return the newly created ESNcard with additional info
            response_data = esncard_serializer.data
            return Response(response_data, status=200)

    except PermissionDenied as e:
        return Response(str(e), status=403)

    except (ObjectDoesNotExist, ValueError) as e:
        return Response(str(e), status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(str(e), status=500)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def esncard_detail(request, pk):
    try:
        esncard = ESNcard.objects.get(pk=pk)
        if request.method == 'PATCH':
            if request.user.has_perm('treasury.change_esncard'):
                esncard_serializer = ESNcardSerializer(esncard, data=request.data, partial=True)
                if esncard_serializer.is_valid():
                    esncard_serializer.save()
                    return Response(status=200)
                else:
                    return Response(esncard_serializer.errors, status=400)
            else:
                return Response({'error': 'Non hai i permessi per modificare questa ESNcard.'}, status=403)
        else:
            return Response("Metodo non consentito", status=405)

    except ESNcard.DoesNotExist:
        return Response('La ESNcard non esiste', status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(str(e), status=500)


#   Endpoint for adding a transaction
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transaction_add(request):
    try:
        transaction_serializer = TransactionCreateSerializer(data=request.data)
        if not transaction_serializer.is_valid():
            return Response(transaction_serializer.errors, status=400)

        transaction_type = transaction_serializer.validated_data['type']
        if transaction_type in [Transaction.TransactionType.DEPOSIT, Transaction.TransactionType.WITHDRAWAL]:
            if not request.user.has_perm('treasury.add_transaction'):
                return Response({'error': 'Non autorizzato.'}, status=401)

        transaction_serializer.save()
        return Response(status=200)

    except Exception as e:
        logger.error(str(e))
        return Response({'error': 'Errore interno del server.'}, status=500)


#   Endpoint to retrieve list of transactions
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transactions_list(request):
    try:
        transactions = Transaction.objects.all().order_by('-created_at')
        search = request.GET.get('search', '').strip()
        if search:
            transactions = transactions.filter(
                Q(account__name__icontains=search) |
                Q(description__icontains=search) |
                Q(executor__profile__name__icontains=search) |
                Q(executor__profile__surname__icontains=search)
            )
        # Filtering by account (multi)
        account_ids = request.GET.getlist('account')
        if account_ids:
            transactions = transactions.filter(account__id__in=account_ids)
        # Filtering by type (multi)
        types = request.GET.getlist('type')
        if types:
            transactions = transactions.filter(type__in=types)
        # Filtering by dateFrom/dateTo
        date_from = request.GET.get('dateFrom')
        if date_from:
            transactions = transactions.filter(created_at__gte=date_from)
        date_to = request.GET.get('dateTo')
        if date_to:
            transactions = transactions.filter(created_at__lte=date_to)
        paginator = PageNumberPagination()
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(transactions, request=request)
        serializer = TransactionViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    except Exception as e:
        logger.error(str(e))
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to retrive transaction details based on id
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def transaction_detail(request, pk):
    try:
        transaction_obj = Transaction.objects.get(pk=pk)

        if request.method == 'GET':
            serializer = TransactionViewSerializer(transaction_obj)
            return Response(serializer.data, status=200)

        elif request.method == 'PATCH':
            if not request.user.has_perm('treasury.change_transaction'):
                return Response({'error': 'Non autorizzato.'}, status=401)

            # Retrieve the User regardless of whether an id or email is passed
            executor = request.data.get('executor')
            try:
                executor_user = User.objects.get(profile__id=int(executor))
            except (ValueError, User.DoesNotExist):
                try:
                    executor_user = User.objects.get(profile__email=executor)
                except User.DoesNotExist:
                    return Response({'error': 'Invalid executor information'}, status=400)
            request.data['executor'] = executor_user.pk

            with transaction.atomic():
                if int(request.data.get('account', transaction_obj.account.id)) != transaction_obj.account.id:
                    # Only if the account has changed, delete old transaction and create a new one
                    transaction_obj.delete()
                    t = Transaction(
                        type=transaction_obj.type,
                        account_id=request.data['account'],
                        executor_id=request.data['executor'],
                        amount=float(request.data['amount']),
                        description=request.data.get('description', ''),
                        esncard=transaction_obj.esncard,
                        subscription=transaction_obj.subscription
                    )
                    t.save()
                else:
                    # Just update the non-critical fields
                    transaction_obj.amount = float(request.data['amount'])
                    transaction_obj.executor_id = request.data['executor']
                    transaction_obj.description = request.data.get('description', '')
                    transaction_obj.save()

                return Response(status=200)
        else:
            return Response("Metodo non consentito", status=405)

    except Transaction.DoesNotExist:
        return Response({'error': 'Transazione non trovata.'}, status=404)

    except Exception as e:
        logger.error(str(e))
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to retrieve ensncard fees
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def esncard_fees(request):
    try:
        # Get the settings and add fee information
        settings = Settings.get()
        response = Response({
            'esncard_release_fee': str(settings.esncard_release_fee),
            'esncard_lost_fee': str(settings.esncard_lost_fee)
        }, status=200)
        return response
    except Exception as e:
        logger.error(str(e))
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to retrieve all accounts 
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def accounts_list(request):
    try:
        accounts = Account.objects.all().order_by('id')
        visible_accounts = [account for account in accounts if account.is_visible_to_user(request.user)]
        paginator = PageNumberPagination()
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(visible_accounts, request=request)
        print("User " + str(request.user) + " group: " + str(request.user.groups.all()))
        if request.user.groups.filter(name="Aspiranti").exists():
            serializer = AccountListViewSerializer(page, many=True) # Do not return sensitive data, like balance
        else:
            serializer = AccountDetailedViewSerializer(page, many=True, context={'request': request})
        # Get the paginated response
        response_data = paginator.get_paginated_response(serializer.data).data

        return Response(response_data)
    except Exception as e:
        logger.error(str(e))
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to create new account
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def account_creation(request):
    try:
        if not request.user.has_perm('treasury.add_account'):
            return Response({'error': 'Non autorizzato.'}, status=401)

        account_serializer = AccountCreateSerializer(data=request.data)
        if not account_serializer.is_valid():
            return Response(account_serializer.errors, status=400)

        account_serializer.save(changed_by=request.user)
        return Response(status=200)
    except Exception as e:
        logger.error(str(e))
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to retrieve account info / edit account
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def account_detail(request, pk):
    try:
        account = Account.objects.get(pk=pk)

        if request.method == 'GET':
            if request.user.groups.filter(name="Aspiranti").exists():
                serializer = AccountListViewSerializer(account)  # Do not return sensitive data, like balance
            else:
                serializer = AccountDetailedViewSerializer(account, context={'request': request})
            return Response(serializer.data, status=200)

        if request.method == 'PATCH':
            if not request.user.has_perm('treasury.change_account'):
                return Response({'error': 'Non autorizzato.'}, status=401)
            data = request.data
            data['changed_by'] = request.user
            serializer = AccountEditSerializer(account, data=data, partial=True)
            if not serializer.is_valid():
                return Response(serializer.errors, status=400)

            serializer.save()
            return Response(serializer.data, status=200)
        else:
            return Response("Metodo non consentito", status=405)

    except Account.DoesNotExist:
        return Response({'error': 'Account non trovato.'}, status=404)

    except Exception as e:
        logger.error(str(e))
        return Response({'error': 'Errore interno del server.'}, status=500)
