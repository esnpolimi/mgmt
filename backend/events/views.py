import logging

from django.core.exceptions import ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from events.models import Event, Subscription
from events.serializers import (
    EventsListSerializer, EventCreationSerializer,
    SubscriptionCreateSerializer, SubscriptionUpdateSerializer,
    EventWithSubscriptionsSerializer
)

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
            # If event already has subscriptions, it is not possible to edit the event (TODO: check this statement)
            subs = Subscription.objects.filter(event=event)
            if len(subs) > 0:
                return Response('Cannot edit an event that already has subscriptions', status=400)

            serializer = EventCreationSerializer(instance=event, data=request.data, partial=True)
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
        if serializer.is_valid():
            # Run clean method to validate capacity
            subscription = Subscription(**serializer.validated_data)
            subscription.clean()

            # Save if validation passes
            serializer.save()
            return Response(serializer.data, status=200)
        else:
            return Response(serializer.errors, status=400)

    except ValidationError as e:
        return Response(str(e), status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def subscription_detail(request, pk):
    try:
        sub = Subscription.objects.get(pk=pk)

        if request.method == "PATCH":
            serializer = SubscriptionUpdateSerializer(instance=sub, data=request.data, partial=True)
            if serializer.is_valid():
                # Run clean method to validate capacity
                subscription = Subscription.objects.get(pk=pk)
                for attr, value in serializer.validated_data.items():
                    setattr(subscription, attr, value)
                subscription.clean()

                # Save if validation passes
                serializer.save()
                return Response(serializer.data, status=200)
            else:
                return Response(serializer.errors, status=400)

        elif request.method == "DELETE":
            # TODO: implement permission verification
            sub.delete()
            return Response(status=200)

    except Subscription.DoesNotExist:
        return Response("Subscription does not exist", status=400)

    except ValidationError as e:
        return Response(str(e), status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


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
