import logging
from django.core.mail import send_mail
from django.db import transaction
from rest_framework.decorators import api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from backend.settings import HOSTNAME
from profiles.models import Profile, Document, Matricola
from profiles.serializers import ProfileListViewSerializer, ProfileCreateSerializer, ProfileDetailViewSerializer
from profiles.serializers import MatricolaCreateSerializer, DocumentCreateSerializer, MatricolaEditSerializer, DocumentEditSerializer, ProfileFullEditSerializer, ProfileBasicEditSerializer
from profiles.tokens import email_verification_token
from users.auth_guard import login_required


logger = logging.getLogger(__name__)


# Endpoint to retrieve a list of the profiles. Pagination is implemented
@api_view(['GET'])
@login_required
def profile_list(request):  
    try:
        profiles = Profile.objects.all().order_by('-created_at')
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(profiles,request=request)
        serializer = ProfileListViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
        
# Endpoint to create a profile, document and matricola together.
@api_view(['POST'])
def profile_creation(request):
    
    try:
        data = request.data
        #Create profile    

        profile_serializer = ProfileCreateSerializer(data=data)
        document_serializer = DocumentCreateSerializer(data={ k[9:]:v for k,v in data.items() if k.startswith('document-')}, partial=True)
        matricola_serializer = MatricolaCreateSerializer(data={ k[10:]:v for k,v in data.items() if k.startswith('matricola-')}, partial=True)

        if profile_serializer.is_valid() and document_serializer.is_valid() and matricola_serializer.is_valid():
            
            # Data is valid: create objects
            with transaction.atomic():
                profile = profile_serializer.save()
                document_serializer.save(profile=profile)
                matricola_serializer.save(profile=profile)

            # Send email for email verification
            token = email_verification_token.make_token(profile)
            verification_link = HOSTNAME + '/profile/' + str(profile.pk) + '/verification/' + token

            send_mail(
                "Email verification",
                verification_link,
                "noreply@"+HOSTNAME,
                [profile.email],
                fail_silently=False,) 
            return Response(status=200)
            
        else:
            
            #Calling is_valid() is needed to access errors. In the 'if' statement they may not have been called
            profile_serializer.is_valid()
            document_serializer.is_valid()
            matricola_serializer.is_valid()
            # Data is invalid: return bad request (400) and errors
            errors = {k : v[0] for k,v in profile_serializer.errors.items()}
            errors.update({ 'document-'+k: v[0] for k,v in document_serializer.errors.items()})
            errors.update({ 'matricola-'+k: v[0] for k,v in matricola_serializer.errors.items()})
            return Response(errors,status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)

# Endpoint to view in detail, edit, delete a profile
@api_view(['GET','PATCH','DELETE'])
@login_required
def profile_detail(request,pk):

    try:
        profile = Profile.objects.get(pk=pk)

        if request.method == 'GET':
            serializer = ProfileDetailViewSerializer(profile)
            return Response(serializer.data)
        
        elif request.method == 'PATCH':
            if request.user.has_perm('profiles.profile.can_change_profile'):
                serializer = ProfileFullEditSerializer(profile, data=request.data, partial=True)
            elif request.user.has_perm('profiles.profile.can_change_person_code'):
                serializer = ProfileBasicEditSerializer(profile, data=request.data, partial=True)
            else:
                return Response(status=401)
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        
        elif request.method == 'DELETE':
            if request.user.has_perm('profiles.profile.can_delete_profile'):
                profile.enabled = False
                profile.save()
                return Response(status=200)
            return Response(status=401)

    except Profile.DoesNotExist:
        return Response('Profile does not exist',status=404)
    
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)

# Endpoint to verify email
@api_view(['GET'])
def profile_verification(request,pk,token):
    try:
        profile = Profile.objects.get(pk=pk)
        if email_verification_token.check_token(profile,token):
            profile.email_is_verified = True
            profile.save()
            return Response('Email verified',status=200)
        else:
            return Response('Invalid token',status=400)

    except Profile.DoesNotExist:
        return Response('Profile does not exist',status=400)
    
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)

# Endpoint to create document    
@api_view(['POST'])
@login_required
def document_creation(request):
    
    try:
        document_serializer = DocumentCreateSerializer(data=request.data, partial=True)
        
        if document_serializer.is_valid():
            document_serializer.save()
            return Response(document_serializer.data,status=200)
        
        else:
            return Response(document_serializer.errors,status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
    
    
@api_view(['PATCH'])
@login_required
def document_detail(request,pk):

    try:
        document = Document.objects.get(pk=pk)
        document_serializer = DocumentEditSerializer(document,data=request.data,partial=True)

        if document_serializer.is_valid():
            document_serializer.save()
            return Response(status=200)
        else:
            return Response(document_serializer.errors,status=400)

    except Document.DoesNotExist:
        return Response('Document does not exist',status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
        

@api_view(['POST'])
@login_required
def matricola_creation(request):

    try:
        matricola_serializer = MatricolaCreateSerializer(data=request.data)
        
        if matricola_serializer.is_valid():
            matricola_serializer.save()
            return Response(matricola_serializer.data,status=200)
        else:
            return Response(matricola_serializer.errors,status=400)
        
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
        

@api_view(['PATCH'])
@login_required
def matricola_detail(request,pk):

    try:
        matricola = Matricola.objects.get(pk=pk)
        matricola_serializer = MatricolaEditSerializer(matricola,data=request.data,partial=True)

        if matricola_serializer.is_valid():
            matricola_serializer.save()
            return Response(status=200)
        else:
            return Response(matricola_serializer.errors,status=400)

    except Matricola.DoesNotExist:
        return Response('Matricola does not exist',status=400)
    
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)