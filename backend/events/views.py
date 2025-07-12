import logging
from datetime import timedelta
from decimal import Decimal

import sentry_sdk
from django.core.exceptions import ValidationError, PermissionDenied, ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from events.models import Event, Subscription, EventList
from events.serializers import (
    EventsListSerializer, EventCreationSerializer,
    SubscriptionCreateSerializer, SubscriptionUpdateSerializer,
    EventWithSubscriptionsSerializer, SubscriptionSerializer
)
from treasury.models import Transaction

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def events_list(request):
    try:
        events = Event.objects.all().order_by('-created_at')
        search = request.GET.get('search', '').strip()
        if search:
            events = events.filter(Q(name__icontains=search))

        status_param = request.GET.get('status', '').strip()
        if status_param:
            status_list = [s.strip() for s in status_param.split(',') if s.strip()]
            if status_list:
                events = [e for e in events if e.status in status_list]

        date_from = request.GET.get('dateFrom')
        if date_from:
            events = events.filter(date__gte=date_from)
        date_to = request.GET.get('dateTo')
        if date_to:
            events = events.filter(date__lte=parse_datetime(date_to) + timedelta(days=1))
        # --- End new filters ---
        paginator = PageNumberPagination()
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(events, request=request)
        serializer = EventsListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def event_creation(request):
    try:
        event_serializer = EventCreationSerializer(data=request.data)

        if event_serializer.is_valid():
            event_serializer.save()
            return Response(event_serializer.data, status=200)
        else:
            return Response(event_serializer.errors, status=400)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def event_detail(request, pk):
    try:
        event = Event.objects.get(pk=pk)

        if request.method == 'GET':
            serializer = EventWithSubscriptionsSerializer(event)
            return Response(serializer.data, status=200)

        elif request.method == 'PATCH':
            if request.user.has_perm('events.change_event'):
                # Check for existing subscriptions
                has_subscriptions = Subscription.objects.filter(event=event).exists()
                data_to_validate = request.data
                logger.info("Event data: ", data_to_validate)
                start_date = parse_datetime(data_to_validate.get('subscription_start_date'))
                end_date = parse_datetime(data_to_validate.get('subscription_end_date'))

                # If event has subscriptions, implement stricter validation
                if has_subscriptions:
                    # Not possible to modify start date
                    formatted_start = start_date.strftime('%Y-%m-%d %H:%M:%S')
                    existing_date = event.subscription_start_date.strftime('%Y-%m-%d %H:%M:%S')
                    logger.info(f"Start date: {start_date}, existing: {event.subscription_start_date}")
                    logger.info(f"Start date: {formatted_start}, existing: {existing_date}")
                    if formatted_start != existing_date:
                        return Response("Non è possibile modificare le date d'iscrizione se l'evento ha delle iscrizioni", status=400)

                    # Not possible to change cost
                    if data_to_validate.get('cost') != str(event.cost):
                        return Response("Non è possibile modificare il costo se l'evento ha delle iscrizioni", status=400)

                    # Not possible to reduce capacity below current subscription count
                    for list_data in data_to_validate['lists']:
                        list_id = list_data.get('id')
                        new_capacity = int(list_data.get('capacity', 0))

                        # Skip validation for new lists
                        if not list_id:
                            continue

                        subscription_count = Subscription.objects.filter(event=event, list_id=list_id).count()
                        if subscription_count > new_capacity > 0:
                            return Response(f"Non è possibile impostare una capacità lista minore del numero di iscrizoni presenti ({subscription_count})", status=400)

                # Not possible to set end date before now or before start date
                now = timezone.now()  # This is timezone-aware
                current_start = start_date if start_date else event.subscription_start_date
                if end_date < now:
                    return Response("Non è possibile impostare una data fine iscrizioni nel passato", status=400)
                if current_start and end_date <= current_start:
                    return Response("Non è possibile impostare una data fine iscrizioni minore di quella di inizio iscrizioni", status=400)

                # Continue with serializer validation and saving
                serializer = EventCreationSerializer(instance=event, data=data_to_validate, partial=True)

                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data, status=200)
                else:
                    return Response(serializer.errors, status=400)
            else:
                return Response({'error': 'Non hai i permessi per modificare questo evento.'}, status=403)

        elif request.method == 'DELETE':
            # Check user permission
            if not request.user.has_perm('events.delete_event'):
                return Response({'error': 'Non hai i permessi per eliminare questo evento.'}, status=403)
            # Allow deletion only if there are no subscriptions
            if Subscription.objects.filter(event=event).exists():
                return Response({'error': 'Non è possibile eliminare un evento che ha delle iscrizioni.'}, status=400)
            event.delete()
            return Response(status=200)
        else:
            return Response("Metodo non consentito", status=405)
    except Event.DoesNotExist:
        return Response({'error': "L'evento non esiste"}, status=404)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=403)
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscription_create(request):
    try:
        # Check if the profile is already subscribed to any list in the same event
        profile = request.data.get('profile')
        event_id = request.data.get('event')
        if Subscription.objects.filter(profile=profile, event=event_id).exists():
            return Response({'error': "Il profilo è già iscritto all'evento"}, status=400)

        # Fetch the event and validate subscription period
        event = Event.objects.get(id=event_id)
        now = timezone.now()
        if not (event.subscription_start_date and event.subscription_end_date):
            return Response({'error': "Il periodo di iscrizione non è definito"}, status=400)
        if not (event.subscription_start_date <= now <= event.subscription_end_date):
            return Response({'error': "Il periodo di iscrizione non è attivo"}, status=400)

        serializer = SubscriptionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        with transaction.atomic():
            subscription_data = {key: value for key, value in serializer.validated_data.items()}
            subscription = Subscription(**subscription_data)
            subscription.clean()
            subscription = serializer.save()

            # Only create transactions if status_quota/cauzione are 'paid'
            status_quota = request.data.get('status_quota', 'pending')
            status_cauzione = request.data.get('status_cauzione', 'pending')
            account_id = serializer.account

            # Quota transaction
            if status_quota == 'paid' and account_id:
                t = Transaction(
                    type=Transaction.TransactionType.SUBSCRIPTION,
                    account_id=account_id,
                    subscription=subscription,
                    executor=request.user,
                    amount=Decimal(subscription.event.cost),
                    description=f"Pagamento per {subscription.event.name}"
                )
                t.save()

            # Cauzione transaction
            if status_cauzione == 'paid' and account_id and subscription.event.deposit and Decimal(subscription.event.deposit) > 0:
                t_cauzione = Transaction(
                    type=Transaction.TransactionType.CAUZIONE,
                    account_id=account_id,
                    subscription=subscription,
                    executor=request.user,
                    amount=Decimal(subscription.event.deposit),
                    description=f"Cauzione per {subscription.event.name}"
                )
                t_cauzione.save()
            return Response(serializer.data, status=200)
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)
    except ObjectDoesNotExist as e:
        return Response({'error': str(e)}, status=400)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=403)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def subscription_detail(request, pk):
    try:
        sub = Subscription.objects.get(pk=pk)

        # Check if quota or cauzione is reimbursed
        quota_reimbursed = Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.RIMBORSO_QUOTA).exists()
        cauzione_reimbursed = Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.RIMBORSO_CAUZIONE).exists()

        if request.method == 'GET':
            serializer = SubscriptionSerializer(sub)
            return Response(serializer.data, status=200)

        if request.method == "PATCH":
            if quota_reimbursed or cauzione_reimbursed:
                return Response({'error': 'Non è possibile modificare una iscrizione con quota o cauzione rimborsata.'}, status=400)
            if request.user.has_perm('events.change_subscription'):
                serializer = SubscriptionUpdateSerializer(instance=sub, data=request.data, partial=True)
                if not serializer.is_valid():
                    return Response(serializer.errors, status=400)

                with transaction.atomic():
                    for attr, value in serializer.validated_data.items():
                        setattr(sub, attr, value)
                    sub.clean()
                    subscription = serializer.save()

                    account_id = serializer.account_id
                    status_quota = request.data.get('status_quota', 'pending')
                    status_cauzione = request.data.get('status_cauzione', 'pending')

                    # Quota transaction
                    quota_tx = Transaction.objects.filter(subscription=subscription, type=Transaction.TransactionType.SUBSCRIPTION).first()
                    cauzione_tx = Transaction.objects.filter(subscription=subscription, type=Transaction.TransactionType.CAUZIONE).first()

                    # --- QUOTA ---
                    if status_quota == 'paid' and account_id:
                        if not quota_tx:
                            # Create transaction if not exists
                            t = Transaction(
                                type=Transaction.TransactionType.SUBSCRIPTION,
                                account_id=account_id,
                                subscription=subscription,
                                executor=request.user,
                                amount=Decimal(subscription.event.cost),
                                description=f"Pagamento per {subscription.event.name}"
                            )
                            t.save()
                        elif quota_tx.account_id != account_id:
                            # Move transaction to new account
                            quota_amount = Decimal(subscription.event.cost)
                            quota_tx.delete()
                            t = Transaction(
                                type=Transaction.TransactionType.SUBSCRIPTION,
                                account_id=account_id,
                                subscription=subscription,
                                executor=request.user,
                                amount=quota_amount,
                                description=f"Pagamento per {subscription.event.name} (spostato da altra cassa)"
                            )
                            t.save()
                    elif status_quota != 'paid' and quota_tx:
                        quota_tx.delete()

                    # --- CAUZIONE ---
                    if status_cauzione == 'paid' and account_id and subscription.event.deposit and Decimal(subscription.event.deposit) > 0:
                        if not cauzione_tx:
                            t_cauzione = Transaction(
                                type=Transaction.TransactionType.CAUZIONE,
                                account_id=account_id,
                                subscription=subscription,
                                executor=request.user,
                                amount=Decimal(subscription.event.deposit),
                                description=f"Cauzione per {subscription.event.name}"
                            )
                            t_cauzione.save()
                        elif cauzione_tx.account_id != account_id:
                            # Move transaction to new account
                            cauzione_amount = Decimal(subscription.event.deposit)
                            cauzione_tx.delete()
                            t_cauzione = Transaction(
                                type=Transaction.TransactionType.CAUZIONE,
                                account_id=account_id,
                                subscription=subscription,
                                executor=request.user,
                                amount=cauzione_amount,
                                description=f"Cauzione per {subscription.event.name} (spostata da altra cassa)"
                            )
                            t_cauzione.save()
                    elif status_cauzione != 'paid' and cauzione_tx:
                        cauzione_tx.delete()

                return Response(serializer.data, status=200)
            else:
                return Response({'error': 'Non hai i permessi per modificare questa iscrizione.'}, status=403)

        elif request.method == "DELETE":
            if quota_reimbursed or cauzione_reimbursed:
                return Response({'error': 'Non è possibile eliminare una iscrizione con quota o cauzione rimborsata.'}, status=400)
            if request.user.has_perm('events.delete_subscription'):
                related_transactions = Transaction.objects.filter(
                    subscription=sub,
                    type__in=[Transaction.TransactionType.SUBSCRIPTION, Transaction.TransactionType.CAUZIONE]
                )
                for t in related_transactions:
                    t.delete()
                sub.delete()
                return Response(status=200)
            else:
                return Response({'error': 'Non hai i permessi per eliminare questa iscrizione.'}, status=403)
        else:
            return Response("Metodo non consentito", status=405)
    except Subscription.DoesNotExist:
        return Response({'error': "L'iscrizione non esiste"}, status=404)
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)
    except ObjectDoesNotExist as e:
        return Response({'error': str(e)}, status=400)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=403)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def move_subscriptions(request):
    try:
        # Extract data from the request
        subscription_ids = request.data.get('subscriptionIds', [])
        target_list_id = request.data.get('targetListId')

        if not subscription_ids or not target_list_id:
            return Response({'error': "ID iscrizioni o ID lista di destinazione mancanti"}, status=400)

        # Fetch the target list and validate its existence
        try:
            target_list = EventList.objects.get(id=target_list_id)
        except EventList.DoesNotExist:
            return Response({'error': "Lista di destinazione inesistente"}, status=400)

        # Check if moving the subscriptions would exceed the target list's capacity
        current_count = Subscription.objects.filter(list=target_list).count()
        if target_list.capacity > 0 and current_count + len(subscription_ids) > target_list.capacity:
            return Response({'error': "Numero di iscrizioni in eccesso per la capacità libera nella lista di destinazione"}, status=400)

        # Fetch the subscriptions to be moved
        subscriptions = Subscription.objects.filter(id__in=subscription_ids)

        # Update the list for each subscription
        with transaction.atomic():
            for subscription in subscriptions:
                subscription.list = target_list
                subscription.save()

        return Response({'message': "Iscrizioni spostate con successo"}, status=200)
    except Exception as e:
        logger.error(f"Errore nello spostamento delle iscrizioni: {str(e)}")
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


# Future implementations
'''
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def profile_lookup(request):
    try:
        form = ProfileLookUpForm(request.data)
        if not form.is_valid():
            return Response(form.errors, status=400)

        event = form.cleaned_data['event']
        profile = Profile.objects.filter(email=form.cleaned_data['email'])
        if not profile.exists():
            return Response({'found': False, 'required_fields': event.profile_fields}, status=200)
        else:
            required = []
            for field in event.profile_fields:
                if getattr(profile, field) is None:
                    required.append(field)
            return Response({'found': True, 'required_fields': required}, status=200)

    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response(status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def form_subscription_creation(request):
    try:
        # Extract data from request
        profile_email = request.data.get('email')
        event_id = request.data.get('event')
        list_id = request.data.get('list')
        notes = request.data.get('notes', '')

        # Validate required fields
        if not all([profile_email, event_id, list_id]):
            return Response({'error': 'Missing required fields'}, status=400)

        # Get related objects
        try:
            profile = Profile.objects.get(email=profile_email)
            event = Event.objects.get(id=event_id)
            list = EventList.objects.get(id=list_id, event=event)
        except Profile.DoesNotExist:
            return Response({'error': 'Profile not found'}, status=400)
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=400)
        except EventList.DoesNotExist:
            return Response({'error': 'List not found'}, status=400)

        # Check if subscription already exists
        if Subscription.objects.filter(profile=profile, event=event).exists():
            return Response({'error': 'Subscription already exists'}, status=400)

        # Create and validate subscription
        subscription = Subscription(
            profile=profile,
            event=event,
            list=list,
            notes=notes,
            created_by_form=True
        )
        subscription.clean()
        subscription.save()

        return Response(SubscriptionSerializer(subscription).data, status=201)

    except ValidationError as e:
        return Response(str(e), status=400)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': str(e)}, status=500)

'''
