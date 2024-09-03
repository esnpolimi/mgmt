import logging
from rest_framework.decorators import api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from profiles.models import Profile
from events.models import Event, Subscription
from events.serializers import EventListViewSerializer, SubscriptionSerializer, EventEditSerializer, EventDetailViewSerializer, EventCreationSerializer
from events.forms import EventCreationForm, FormSubscriptionForm, ManualSubscriptionForm, ProfileLookUpForm, JSONFieldsValidationForm
from users.auth_guard import login_required


logger = logging.getLogger(__name__)


@api_view(['GET'])
@login_required
def events_list(request):
    try:
        events = Event.objects.all().order_by('-created_at')
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(events,request=request)
        serializer = EventListViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


@api_view(['POST'])
@login_required
def event_creation(request):
    try:
        event_serializer = EventCreationSerializer(data=request.data)

        if event_serializer.is_valid():
            event_serializer.save()
            return Response(event_serializer.data,status=200)
        else:
            return Response(event_serializer.errors,status=400)
        
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


@api_view(['GET','PATCH','DELETE'])
@login_required
def event_detail(request,pk):
    try:
        event = Event.objects.get(pk=pk)

        if request.method == 'GET':
            event_serializer = EventDetailViewSerializer(event)
            return Response(event_serializer.data,status=200)
            
        elif request.method == 'PATCH':
            serializer = EventEditSerializer(request.data,instance=event,partial=True)

            # If event already has subscriptions, it is not possible to edit the event 
            subs = Subscription.objects.filter(event=event)
            if len(subs) > 0:
                return Response('Cannot edit an event that already has subscriptions',status=400)
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data,status=200)
            else:
                return Response(serializer.errors,status=400)
            
        elif request.method == 'DELETE':
            # TODO: implement permission verification
            event.delete()
            return Response(status=200)


    except Event.DoesNotExist:
        return Response('Event does not exist',status=400)
    
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
    
@api_view(['POST'])
def profile_lookup(request):
    try:
        form = ProfileLookUpForm(request.data)
        if not form.is_valid():
            return Response(form.errors,status=400)
        
        event = form.cleaned_data['event']
        profile = Profile.objects.filter(email=form.cleaned_data['email'])
        if not profile.exists():
            return Response({'found':False, 'required_fields':event.profile_fields},status=200)
        else:
            required = []
            for field in event.profile_fields:
                if getattr(profile,field) is None:
                    required.append(field)
            return Response({'found':True, 'required_fields':required}, status=200)
        
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
 
@api_view(['POST'])
def form_subscription_creation(request):
    try:
        form = FormSubscriptionForm(request.data)
        if not form.is_valid():
            return Response(form.errors,status=400)
    
        profile = Profile.objects.get(email=form.cleaned_data['email'])
        event = form.cleaned_data['event']
        sub = form.save(commit=False)

        if not event.enable_form:
            return Response('Form is closed',status=401)

        if Subscription.objects.filter(profile=profile,event=event).exists():
            return Response('Subscription already exists',status=400)
        
        if not 'form_responses' in event.tables:
            event.tables.append('form_responses')
            event.save()

        event_data = {'table':'form_responses','color':'#00ffffff','type':'form'}
        sub.event_data = event_data
        sub.save()
        return Response(status=200)
    
    except Profile.DoesNotExist:
        return Response('Profile with this email does not exist',status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
    
    
@api_view(['POST'])
@login_required
def manual_subscription_creation(request):
    try:
        form = ManualSubscriptionForm(request.data)
        if form.is_valid():
            form.save()
            return Response(status=200)
        else:
            return Response(form.errors,status=400)
    
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


@api_view(['PATCH','DELETE'])
@login_required
def subscription_detail(request, pk):
    try:
        sub = Subscription.objects.get(pk=pk)

        if request.method == "PATCH":
            serializer = SubscriptionSerializer(request.data,instance=sub,partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data,status=200)
            else:
                return Response(status=400)
            
        elif request.method == "DELETE":
            #TODO: implement permission verification    
            sub.delete()
            return Response(status=200)

    except Subscription.DoesNotExist:
        return Response("Subscription does not exist",status=400)
    
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)

