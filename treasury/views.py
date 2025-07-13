import logging
from datetime import timedelta
from decimal import Decimal

import sentry_sdk
from django.core.exceptions import PermissionDenied, ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from events.models import Subscription, Event
from profiles.models import Profile
from treasury.models import Account, ESNcard, Settings, ReimbursementRequest
from treasury.models import Transaction
from treasury.serializers import TransactionViewSerializer, AccountDetailedViewSerializer, AccountEditSerializer, AccountCreateSerializer, ESNcardEmissionSerializer, TransactionCreateSerializer, \
    ESNcardSerializer, AccountListViewSerializer, ReimbursementRequestSerializer, ReimbursementRequestViewSerializer
from users.models import User

logger = logging.getLogger(__name__)


# Endpoint for ESNcard emission.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def esncard_emission(request):
    try:
        profile = Profile.objects.filter(id=request.data['profile_id']).first()
        latest_card = profile.latest_esncard if profile else None
        logger.info("Latest card for" + str(profile) + ": " + str(latest_card))
        esncard_serializer = ESNcardEmissionSerializer(data=request.data)
        if not esncard_serializer.is_valid():
            return Response(esncard_serializer.errors, status=400)

        with transaction.atomic():
            esncard = esncard_serializer.save()
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
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


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
        sentry_sdk.capture_exception(e)
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
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


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

        try:
            transaction_serializer.save()
        except ValueError as ve:
            return Response({'error': str(ve)}, status=400)
        except PermissionDenied as pe:
            return Response({'error': str(pe)}, status=403)

        return Response(status=200)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
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
            transactions = transactions.filter(created_at__lte=parse_datetime(date_to) + timedelta(days=1))
        # Support limit param for dashboard
        limit = request.GET.get('limit')
        if limit:
            try:
                limit = int(limit)
                transactions = transactions[:limit]
                serializer = TransactionViewSerializer(transactions, many=True)
                return Response({'results': serializer.data, 'count': transactions.count() if hasattr(transactions, 'count') else len(transactions)})
            except ValueError:
                pass
        paginator = PageNumberPagination()
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(transactions, request=request)
        serializer = TransactionViewSerializer(page, many=True)
        # Returns paginated response, use .results in frontend
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to retrive transaction details based on id
@api_view(['GET', 'PATCH', 'DELETE'])
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
                try:
                    if int(request.data.get('account', transaction_obj.account.id)) != transaction_obj.account.id:
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
                        transaction_obj.amount = float(request.data['amount'])
                        transaction_obj.executor_id = request.data['executor']
                        transaction_obj.description = request.data.get('description', '')
                        transaction_obj.save()
                except ValueError as ve:
                    return Response({'error': str(ve)}, status=400)
                except PermissionDenied as pe:
                    return Response({'error': str(pe)}, status=403)

                return Response(status=200)
        elif request.method == 'DELETE':
            # Allow deletion only for specific transaction types
            list_deleteable = [
                Transaction.TransactionType.RIMBORSO_CAUZIONE,
                Transaction.TransactionType.REIMBURSEMENT,
                Transaction.TransactionType.RIMBORSO_QUOTA,
                Transaction.TransactionType.DEPOSIT,
                Transaction.TransactionType.WITHDRAWAL
            ]
            if transaction_obj.type in list_deleteable:
                if not request.user.has_perm('treasury.delete_transaction'):
                    return Response({'error': 'Non autorizzato.'}, status=401)
                transaction_obj.delete()
                return Response(status=204)
            else:
                return Response({'error': 'Solo i Rimborsi possono essere eliminati manualmente.'}, status=400)
        else:
            return Response("Metodo non consentito", status=405)
    except Transaction.DoesNotExist:
        return Response({'error': 'Transazione non trovata.'}, status=404)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to retrieve all accounts
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def accounts_list(request):
    try:
        accounts = Account.objects.all().order_by('id')
        visible_accounts = [account for account in accounts if account.is_visible_to_user(request.user)]
        # Returns a plain list, not paginated
        if request.user.groups.filter(name="Aspiranti").exists():
            serializer = AccountListViewSerializer(visible_accounts, many=True)
        else:
            serializer = AccountDetailedViewSerializer(visible_accounts, many=True, context={'request': request})
        return Response(serializer.data, status=200)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
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
        sentry_sdk.capture_exception(e)
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
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reimbursement_request_creation(request):
    try:
        serializer = ReimbursementRequestSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def reimbursement_request_detail(request, pk):
    try:
        try:
            instance = ReimbursementRequest.objects.get(pk=pk)
        except ReimbursementRequest.DoesNotExist:
            return Response({'error': 'Richiesta di rimborso non trovata.'}, status=404)

        if request.method == 'GET':
            serializer = ReimbursementRequestViewSerializer(instance)
            return Response(serializer.data, status=200)

        elif request.method == 'PATCH':
            if request.user.has_perm('treasury.change_reimbursementrequest'):
                allowed_fields = {'description', 'receipt_link', 'account', 'amount'}
                data = {k: v for k, v in request.data.items() if k in allowed_fields}
                serializer = ReimbursementRequestSerializer(instance, data=data, partial=True, context={'request': request})
                if serializer.is_valid():
                    try:
                        serializer.save()
                        # Reload instance to reflect changes (e.g., account deduction)
                        instance.refresh_from_db()
                        response_serializer = ReimbursementRequestViewSerializer(instance)
                        return Response(response_serializer.data, status=200)
                    except serializers.ValidationError as ve:
                        return Response(ve.detail, status=400)
                return Response(serializer.errors, status=400)
            else:
                return Response({'error': 'Non autorizzato.'}, status=401)
        else:
            return Response("Metodo non consentito", status=405)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to retrieve list of reimbursement requests
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reimbursement_requests_list(request):
    try:
        requests = ReimbursementRequest.objects.all().order_by('-created_at')
        search = request.GET.get('search', '').strip()
        if search:
            requests = requests.filter(
                Q(description__icontains=search) |
                Q(user__profile__name__icontains=search) |
                Q(user__profile__surname__icontains=search) |
                Q(user__email__icontains=search)
            )
        # Filtering by payment (multi)
        payments = request.GET.getlist('payment')
        if payments:
            requests = requests.filter(payment__in=payments)
        # Filtering by dateFrom/dateTo
        date_from = request.GET.get('dateFrom')
        if date_from:
            requests = requests.filter(created_at__gte=date_from)
        date_to = request.GET.get('dateTo')
        if date_to:
            requests = requests.filter(created_at__lte=parse_datetime(date_to) + timedelta(days=1))
        # Support limit param for dashboard
        limit = request.GET.get('limit')
        if limit:
            try:
                limit = int(limit)
                requests = requests[:limit]
                serializer = ReimbursementRequestViewSerializer(requests, many=True)
                return Response({'results': serializer.data, 'count': requests.count() if hasattr(requests, 'count') else len(requests)})
            except ValueError:
                pass
        paginator = PageNumberPagination()
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(requests, request=request)
        serializer = ReimbursementRequestViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reimburse_deposits(request):
    """
    Reimburse deposits for a list of subscriptions.
    Expects: { "event": <event_id>, "subscription_ids": [<id1>, <id2>, ...], "account": <account_id>, "notes": <optional> }
    """
    try:
        if not request.user.has_perm('events.add_depositreimbursement'):
            return Response({'error': 'Non autorizzato.'}, status=401)

        event_id = request.data.get('event')
        subscription_ids = request.data.get('subscription_ids', [])
        account_id = request.data.get('account')
        notes = request.data.get('notes', '')

        if not event_id or not subscription_ids or not account_id:
            return Response({'error': 'Dati mancanti.'}, status=400)

        event = Event.objects.get(id=event_id)
        account = Account.objects.get(id=account_id)
        subscriptions = Subscription.objects.filter(id__in=subscription_ids, event=event)

        if not subscriptions.exists():
            return Response({'error': 'Nessuna iscrizione valida trovata.'}, status=400)

        deposit_amount = event.deposit or Decimal('0.00')

        with transaction.atomic():
            account_locked = Account.objects.select_for_update().get(pk=account.pk)
            created = []
            for sub in subscriptions:
                if Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.RIMBORSO_CAUZIONE).exists():
                    continue
                cauzione_tx = Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.CAUZIONE).first()
                if not cauzione_tx:
                    return Response({'error': 'Nessuna cauzione rimborsabile trovata per ' + str(sub.profile)}, status=400)
                if account_locked.status == "closed":
                    return Response({'error': 'La cassa è chiusa.'}, status=400)
                if account_locked.balance < deposit_amount:
                    return Response({'error': 'Saldo cassa insufficiente.'}, status=400)
                tx = Transaction.objects.create(
                    type=Transaction.TransactionType.RIMBORSO_CAUZIONE,
                    subscription=sub,
                    executor=request.user,
                    account=account_locked,
                    amount=-deposit_amount,
                    description=f"Rimborso cauzione per {sub.profile.name} {sub.profile.surname} ({event.name})" + (f" - {notes}" if notes else "")
                )
                created.append(tx)
            # Return the created transactions
            serializer = TransactionViewSerializer(created, many=True)
            return Response(serializer.data, status=201)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reimbursable_deposits(request):
    """
    Returns a list of subscriptions for a given event and list that are eligible for deposit reimbursement.
    Query params: event=<event_id>&list=<list_id>
    """
    try:
        event_id = request.GET.get('event')
        list_id = request.GET.get('list')
        if not event_id or not list_id:
            return Response({'error': 'Evento e Lista richiesti.'}, status=400)

        event = Event.objects.get(id=event_id)

        # Subscriptions in this list, with a paid cauzione transaction, not yet reimbursed
        subs = Subscription.objects.filter(
            event=event,
            list__id=list_id
        )
        result = []
        for sub in subs:
            deposit_tx = Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.CAUZIONE).first()
            reimbursed = Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.RIMBORSO_CAUZIONE).exists()
            if deposit_tx and not reimbursed:
                result.append({
                    "id": sub.id,
                    "profile_id": sub.profile.id,
                    "profile_name": f"{sub.profile.name} {sub.profile.surname}",
                    "account_name": deposit_tx.account.name if deposit_tx.account else None
                })
        return Response(result, status=200)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reimburse_quota(request):
    """
    Reimburse the main event cost ("Quota") for a subscription.
    Expects: { "event": <event_id>, "subscription_id": <id>, "account": <account_id>, "notes": <optional> }
    """
    try:
        if not request.user.has_perm('events.add_depositreimbursement'):
            return Response({'error': 'Non autorizzato.'}, status=401)

        event_id = request.data.get('event')
        subscription_id = request.data.get('subscription_id')
        account_id = request.data.get('account')
        notes = request.data.get('notes', '')

        if not event_id or not subscription_id or not account_id:
            return Response({'error': 'Dati mancanti.'}, status=400)

        event = Event.objects.get(id=event_id)
        account = Account.objects.get(id=account_id)
        sub = Subscription.objects.get(id=subscription_id, event=event)

        # Only allow if event is not free and subscription has a paid transaction
        if not event.cost or float(event.cost) <= 0:
            return Response({'error': 'L\'evento è gratuito, nessuna quota da rimborsare.'}, status=400)
        if not Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.SUBSCRIPTION).exists():
            return Response({'error': 'La quota può essere rimborsata solo se è stato effettuato il pagamento.'}, status=400)

        # Check if already reimbursed
        if Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.RIMBORSO_QUOTA).exists():
            return Response({'error': 'Quota già rimborsata.'}, status=400)

        quota_tx = Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.SUBSCRIPTION).first()
        if not quota_tx:
            return Response({'error': 'Nessun pagamento quota trovato per questa iscrizione.'}, status=400)

        if account.status == "closed":
            return Response({'error': 'La cassa è chiusa.'}, status=400)

        if account.balance < event.cost:
            return Response({'error': 'Saldo cassa insufficiente.'}, status=400)

        with transaction.atomic():
            tx = Transaction.objects.create(
                type=Transaction.TransactionType.RIMBORSO_QUOTA,
                subscription=sub,
                executor=request.user,
                account=account,
                amount=-event.cost,
                description=f"Rimborso quota per {sub.profile.name} {sub.profile.surname} ({event.name})" + (f" - {notes}" if notes else "")
            )
            serializer = TransactionViewSerializer(tx)
            return Response(serializer.data, status=201)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)
