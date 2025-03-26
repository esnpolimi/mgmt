import logging

from django.core.exceptions import ValidationError, PermissionDenied, ObjectDoesNotExist
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from events.models import Event, Subscription
from events.serializers import (
    EventsListSerializer, EventCreationSerializer,
    SubscriptionCreateSerializer, SubscriptionUpdateSerializer,
    EventWithSubscriptionsSerializer
)
from treasury.models import Transaction

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def events_list(request):
    try:
        events = Event.objects.all().order_by('-created_at')
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(events, request=request)
        serializer = EventsListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


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
        return Response(status=500)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def event_detail(request, pk):
    try:
        event = Event.objects.get(pk=pk)

        if request.method == 'GET':
            serializer = EventWithSubscriptionsSerializer(event)
            return Response(serializer.data, status=200)

        elif request.method == 'PATCH':
            # Check for existing subscriptions
            has_subscriptions = Subscription.objects.filter(event=event).exists()
            data_to_validate = request.data
            print("Event data: ", data_to_validate)
            start_date = parse_datetime(data_to_validate.get('subscription_start_date'))
            end_date = parse_datetime(data_to_validate.get('subscription_end_date'))

            # If event has subscriptions, implement stricter validation
            if has_subscriptions:
                # Not possible to modify start date
                formatted_start = start_date.strftime('%Y-%m-%d %H:%M:%S')
                existing_date = event.subscription_start_date.strftime('%Y-%m-%d %H:%M:%S')
                print(f"Start date: {start_date}, existing: {event.subscription_start_date}")
                print(f"Start date: {formatted_start}, existing: {existing_date}")
                if formatted_start != existing_date:
                    return Response("Cannot modify start date when event has subscriptions", status=400)

                # Not possible to change cost
                if data_to_validate.get('cost') != event.cost:
                    return Response("Cannot modify cost when event has subscriptions", status=400)

                # Not possible to reduce capacity below current subscription count
                for list_data in data_to_validate['lists']:
                    list_id = list_data.get('id')
                    new_capacity = int(list_data.get('capacity', 0))

                    # Skip validation for new lists
                    if not list_id:
                        continue

                    subscription_count = Subscription.objects.filter(event=event, list_id=list_id).count()
                    if subscription_count > new_capacity > 0:
                        return Response(f"Cannot reduce list capacity below current subscription count ({subscription_count})", status=400)

            # Not possible to set end date before now or before start date
            now = timezone.now()  # This is timezone-aware
            current_start = start_date if start_date else event.subscription_start_date
            print(f"Now: {now}")
            print(f"Current start: {current_start}")
            print(f"Start date: {current_start}")
            print(f"End date: {end_date}")
            if end_date < now:
                return Response("Subscription end date cannot be in the past", status=400)
            if current_start and end_date <= current_start:
                return Response("Subscription end date must be after start date", status=400)

            # Continue with serializer validation and saving
            serializer = EventCreationSerializer(instance=event, data=data_to_validate, partial=True)

            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=200)
            else:
                return Response(serializer.errors, status=400)

        elif request.method == 'DELETE':
            # TODO: implement permission verification
            event.delete()
            return Response(status=200)

    except Event.DoesNotExist:
        return Response('Event does not exist', status=400)

    except Exception as e:
        logger.error(str(e))
        return Response({"message": "An unexpected error occurred: " + str(e)}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscription_create(request):
    try:
        serializer = SubscriptionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        with transaction.atomic():
            # Run clean method to validate capacity
            subscription_data = {key: value for key, value in serializer.validated_data.items()}
            subscription = Subscription(**subscription_data)
            subscription.clean()

            # Save if validation passes
            subscription = serializer.save()

            # Create transaction if status is paid
            if subscription.status == 'paid':
                # Check if we have an account ID
                if not hasattr(serializer, 'account') or not serializer.account:
                    raise ValidationError("Account ID is required for paid subscriptions")

                # Create transaction
                t = Transaction(
                    account_id=serializer.account,
                    executor=request.user,
                    amount=float(subscription.event.cost),
                    description=f"Payment for {subscription.event.name}"
                )
                t.save()

            return Response(serializer.data, status=200)

    except ValidationError as e:
        return Response(str(e), status=400)

    except ObjectDoesNotExist as e:
        return Response(str(e), status=400)

    except PermissionDenied as e:
        return Response(str(e), status=403)

    except Exception as e:
        logger.error(str(e))
        return Response(str(e), status=500)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def subscription_detail(request, pk):
    try:
        sub = Subscription.objects.get(pk=pk)
        old_status = sub.status

        if request.method == "PATCH":
            serializer = SubscriptionUpdateSerializer(instance=sub, data=request.data, partial=True)
            if not serializer.is_valid():
                return Response(serializer.errors, status=400)

            with transaction.atomic():
                # Run clean method to validate capacity
                for attr, value in serializer.validated_data.items():
                    setattr(sub, attr, value)
                sub.clean()

                # Save if validation passes
                subscription = serializer.save()

                # Create a transaction if status changed to paid
                if old_status != 'paid' and subscription.status == 'paid':
                    # Check if we have an account ID
                    if not hasattr(serializer, 'account_id') or not serializer.account_id:
                        raise ValidationError("Account ID is required for paid subscriptions")

                    # Create transaction
                    t = Transaction(
                        account_id=serializer.account_id,
                        executor=request.user,
                        amount=float(subscription.event.cost),
                        description=f"Payment for {subscription.event.name}"
                    )
                    t.save()

                # Handle refunds if enabled and status changed from paid to something else
                elif old_status == 'paid' and subscription.status != 'paid' and subscription.enable_refund:
                    if not hasattr(serializer, 'account_id') or not serializer.account_id:
                        raise ValidationError("Account ID is required for refunds")

                    # Create refund transaction
                    t = Transaction(
                        account_id=serializer.account_id,
                        executor=request.user,
                        amount=-float(subscription.event.cost),  # Negative amount for refund
                        description=f"Refund for {subscription.event.name}"
                    )
                    t.save()

                return Response(serializer.data, status=200)

        elif request.method == "DELETE":
            # TODO: implement permission verification
            sub.delete()
            return Response(status=200)

    except Subscription.DoesNotExist:
        return Response("Subscription does not exist", status=400)

    except ValidationError as e:
        return Response(str(e), status=400)

    except ObjectDoesNotExist as e:
        return Response(str(e), status=400)

    except PermissionDenied as e:
        return Response(str(e), status=403)

    except Exception as e:
        logger.error(str(e))
        return Response(str(e), status=500)


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
        return Response({'error': str(e)}, status=500)

'''
