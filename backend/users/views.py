import logging

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from profiles.models import Profile
from users.models import User
from users.serializers import CustomTokenObtainPairSerializer
from users.serializers import UserSerializer, LoginSerializer, UserReactSerializer, GroupListSerializer

logger = logging.getLogger(__name__)
SCHEME_HOST = settings.SCHEME_HOST


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['POST'])
def log_in(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        user = authenticate(username=email, password=password)

        if user is not None:

            profile = Profile.objects.get_or_create(email=request.data.get('email'))[0]
            if not profile.email_is_verified:
                return Response({'detail': 'Email non verificata'}, status=403)

            refresh = RefreshToken.for_user(user)

            # Add custom payload fields to the token
            # logger.info("Serialized user data:", UserReactSerializer(user).data)
            refresh['user'] = UserReactSerializer(user).data  # Serialize the user object
            access_token = str(refresh.access_token)
            logger.info(f"User {user} logged in")

            response = Response({'access': access_token}, status=200)
            # Set refresh token as HTTP-only cookie
            response.set_cookie(
                key='refresh_token',
                value=str(refresh),
                httponly=True,
                secure=True,  # Use True in production (requires HTTPS)
                samesite='Strict',  # Use Strict or Lax depending on whether the frontend and backend are on the same origin
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
            refresh['user'] = UserReactSerializer(user).data
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


@api_view(['POST'])
def forgot_password(request):
    try:
        email = request.data.get('email')
        if not email:
            return Response({"error": "L'indirizzo email è obbligatorio."}, status=400)

        # Verifica se esiste un utente con questa email
        try:
            user = User.objects.get(profile__email=email)
        except User.DoesNotExist:
            # Per ragioni di sicurezza, non riveliamo che l'utente non esiste
            return Response({
                "message": "Se l'indirizzo email è associato a un account, riceverai un'email con le istruzioni per reimpostare la password."
            })

        # Genera token e link per il reset della password
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_link = f"{SCHEME_HOST}/reset-password/{uid}/{token}"

        # Invia email di reset password
        try:
            subject = "Reimposta la tua password - ESN Polimi"
            from_email = settings.DEFAULT_FROM_EMAIL
            to_email = [email]
            text_content = f"Clicca sul seguente link per reimpostare la tua password: {reset_link}"
            html_content = f"""
            <html>
            <body>
                <h2>Reimposta la tua password - ESN Polimi</h2>
                <p>Abbiamo ricevuto una richiesta per reimpostare la password del tuo account.</p>
                <p>Clicca sul pulsante qui sotto per continuare:</p>
                <p><a href="{reset_link}" style="background-color:#1a73e8; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; display:inline-block;">Reimposta Password</a></p>
                <p>Se il pulsante non funziona, copia e incolla questo URL nel tuo browser:</p>
                <p>{reset_link}</p>
                <p>Questo link scadrà tra 24 ore.</p>
                <p>Se non hai richiesto questa reimpostazione, puoi ignorare questa email in tutta sicurezza.</p>
            </body>
            </html>
            """

            email = EmailMultiAlternatives(subject, text_content, from_email, to_email)
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)

            logger.info(f"Email di reset password inviata a {email}")
        except Exception as e:
            logger.info(f"Errore nell'invio dell'email: {str(e)}")
            return Response({"error": f"Errore nell'invio dell'email: {str(e)}"}, status=500)

        return Response({
            "message": "Se l'indirizzo email è associato a un account, riceverai un'email con le istruzioni per reimpostare la password."
        })

    except Exception as e:
        logger.error(str(e))
        return Response({"error": "Si è verificato un errore imprevisto: " + str(e)}, status=500)


@api_view(['POST'])
def reset_password(request, uid, token):
    try:
        # Verifica il token e l'uid
        try:
            uid = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Link di reimpostazione password non valido."}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({"error": "Link di reimpostazione password non valido o scaduto."}, status=400)

        # Verifica la nuova password
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        if not password or not confirm_password:
            return Response({"error": "La password e la conferma della password sono obbligatorie."}, status=400)

        if password != confirm_password:
            return Response({"error": "Le password non corrispondono."}, status=400)

        # Reimpostazione della password
        user.set_password(password)
        user.save()

        return Response({"message": "La tua password è stata reimpostata con successo. Ora puoi accedere con la nuova password."})

    except Exception as e:
        logger.error(str(e))
        return Response({"error": "Si è verificato un errore imprevisto durante la reimpostazione della password."}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_list(request):
    try:
        groups = Group.objects.all()
        serializer = GroupListSerializer(groups, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        return Response(status=500)
