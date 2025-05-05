import logging

from rest_framework_simplejwt.exceptions import TokenError

from profiles.models import Profile
from treasury.models import Account
from treasury.serializers import AccountListViewSerializer
from users.models import User
from rest_framework.pagination import PageNumberPagination
from users.serializers import UserSerializer, LoginSerializer, UserWithProfileAndGroupsSerializer, UserReactSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from users.serializers import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings

logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['POST'])
def log_in(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user = authenticate(username=username, password=password)

        if user is not None:
            refresh = RefreshToken.for_user(user)

            # Add custom payload fields to the token
            accounts = Account.objects.all().order_by('id')
            refresh['user'] = UserReactSerializer(user).data  # Serialize the user object
            refresh['accounts'] = AccountListViewSerializer(accounts, many=True).data

            access_token = str(refresh.access_token)
            print(f"User {user} logged in")

            response = Response({'access': access_token}, status=200)
            # Set refresh token as HTTP-only cookie
            response.set_cookie(
                key='refresh_token',
                value=str(refresh),
                httponly=True,
                secure=False,  # Use True in production (requires HTTPS)
                samesite='Lax',  # Use Strict or Lax depending on whether the frontend and backend are on the same origin
                max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
            )
            return response
        else:
            return Response({'detail': 'Credenziali invalide'}, status=403)

    return Response(serializer.errors, status=400)


@api_view(['POST'])
def log_out(request):
    response = Response({'detail': 'Log out avvenuto con successo'}, status=200)

    # Delete the refresh token cookie
    response.delete_cookie('refresh_token')
    return response


@api_view(['POST'])
def refresh_token_view(request):
    refresh_token = request.COOKIES.get('refresh_token')
    if not refresh_token:
        return Response({'detail': 'Token di refresh non trovato'}, status=400)

    profile, _ = Profile.objects.get_or_create(email=request.data.get('email'))
    user, _ = User.objects.get_or_create(profile=profile)

    if user is not None:
        try:
            refresh = RefreshToken(str(refresh_token))
            accounts = Account.objects.all().order_by('id')
            refresh['user'] = UserReactSerializer(user).data
            refresh['accounts'] = AccountListViewSerializer(accounts, many=True).data
            access_token = str(refresh.access_token)
            return Response({'access': access_token}, status=200)
        except TokenError as e:
            return Response({'detail': str(e)}, status=401)
    else:
        return Response({'detail': 'Profilo utente invalido'}, status=403)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_list(request):
    if request.method == 'GET':
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data
        serializer = UserSerializer(data=data)

        if serializer.is_valid():
            serializer.save()
            return Response(status=201)
        return Response(serializer.errors, status=400)

    else:
        return Response(status=405)


# Endpoint to retrieve a list of ESNers profiles. Pagination is implemented
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_with_profile_list(request):
    try:
        profiles = User.objects.filter(profile__is_esner=True).order_by('-profile__created_at')
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(profiles, request=request)
        serializer = UserWithProfileAndGroupsSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response(status=404)

    if request.method == 'GET':
        serializer = UserSerializer(user)
        return Response(serializer.data)

    elif request.method == 'PATCH':
        data = request.data
        serializer = UserSerializer(user, data=data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    elif request.method == 'DELETE':
        if request.user.has_perm('users.delete_user'):
            user.delete()
            return Response(status=204)
        return Response(status=401)

    else:
        return Response(status=405)
