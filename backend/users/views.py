import logging

import sentry_sdk
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
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
from users.serializers import FinancePermissionSerializer
from users.serializers import UserSerializer, LoginSerializer, UserReactSerializer, GroupListSerializer

logger = logging.getLogger(__name__)
SCHEME_HOST = settings.SCHEME_HOST


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


def user_is_board(user):
    return user.groups.filter(name="Board").exists()


def get_action_permissions(action, user):
    """
    Returns True if the user is allowed to perform the given action.
    """
    if action == 'user_create':
        return user.has_perm('users.add_user')
    if action == 'user_modify':
        return user.has_perm('users.change_user')
    if action == 'user_delete':
        return user_is_board(user)
    return True


@permission_classes([IsAuthenticated])
def userinfo(request, user):
    print(f"OIDC userinfo requested for user {user} with request {request}")
    """Return user info for DokuWiki OIDC"""
    return {
        "sub": str(user.id),
        "email": user.profile.email,
        "preferred_username": user.profile.email,
        "name": f"{user.profile.name} {user.profile.surname}".strip(),
    }

@api_view(['POST'])
def log_in(request):
    try:
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']

            # Enforce esnpolimi.it domain for login
            if not isinstance(email, str) or not email.endswith('@esnpolimi.it'):
                return Response({'detail': 'Solo email @esnpolimi.it sono ammesse per il login.'}, status=403)

            user = authenticate(username=email, password=password)

            if user is not None:
                profile = Profile.objects.get_or_create(email=request.data.get('email'))[0]
                if not profile.email_is_verified:
                    return Response({'detail': 'Email non verificata'}, status=403)

                first_login = False
                if user.last_login is None:
                    first_login = True

                user.last_login = timezone.now()
                user.save(update_fields=['last_login'])

                if first_login:  # pop the last_login field from the returned user
                    user.last_login = None

                refresh = RefreshToken.for_user(user)
                refresh['user'] = UserReactSerializer(user).data
                access_token = str(refresh.access_token)
                logger.info(f"User {user} logged in")

                response = Response({'access': access_token, 'refresh': str(refresh)}, status=200)
                response.set_cookie(
                    key='refresh_token',
                    value=str(refresh),
                    httponly=True,
                    secure=True,
                    samesite='Strict',
                    max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                )

                return response
            else:
                return Response({'detail': 'Credenziali invalide'}, status=403)
        return Response(serializer.errors, status=400)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
def log_out(request):
    try:
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception as e:
                logger.error(f"Error blacklisting token: {str(e)}")
        response = Response({'detail': 'Log out avvenuto con successo'}, status=200)
        response.delete_cookie('refresh_token')
        return response
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
def refresh_token_view(request):
    try:
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
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_list(request):
    try:
        if request.method == 'GET':
            users = User.objects.all()
            serializer = UserSerializer(users, many=True)
            return Response(serializer.data)
        elif request.method == 'POST':
            if not get_action_permissions('user_create', request.user):
                return Response({'error': 'Non autorizzato.'}, status=401)
            data = request.data
            serializer = UserSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(status=201)
            return Response(serializer.errors, status=400)
        else:
            return Response({'error': 'Metodo non consentito.'}, status=405)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, pk):
    try:
        user = User.objects.get(pk=pk)
        if request.method == 'GET':
            serializer = UserSerializer(user)
            return Response(serializer.data)
        elif request.method == 'PATCH':
            if not get_action_permissions('user_modify', request.user):
                return Response({'error': 'Non autorizzato.'}, status=401)
            data = request.data
            serializer = UserSerializer(user, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        elif request.method == 'DELETE':
            if not get_action_permissions('user_delete', request.user):
                return Response({'error': 'Non autorizzato.'}, status=401)
            user.delete()
            return Response(status=204)
        else:
            return Response({'error': 'Metodo non consentito.'}, status=405)
    except User.DoesNotExist:
        return Response({'error': 'Utente non trovato.'}, status=404)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
def forgot_password(request):
    try:
        email = request.data.get('email')
        if not email:
            return Response({"error": "L'indirizzo email è obbligatorio."}, status=400)
        try:
            user = User.objects.get(profile__email=email)
        except User.DoesNotExist:
            return Response({
                "message": "Se l'indirizzo email è associato a un account, riceverai un'email con le istruzioni per reimpostare la password."
            })
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_link = f"{SCHEME_HOST}/reset-password/{uid}/{token}"
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
                <p>Questo link scadrà tra 7 giorni.</p>
                <p>Se non hai richiesto questa reimpostazione, puoi ignorare questa email in tutta sicurezza.</p>
            </body>
            </html>
            """
            email_obj = EmailMultiAlternatives(subject, text_content, from_email, to_email)
            email_obj.attach_alternative(html_content, "text/html")
            email_obj.send(fail_silently=False)
            logger.info(f"Email di reset password inviata a {email}")
        except Exception as e:
            logger.info(f"Errore nell'invio dell'email: {str(e)}")
            return Response({"error": "Errore nell'invio dell'email."}, status=500)
        return Response({
            "message": "Se l'indirizzo email è associato a un account, riceverai un'email con le istruzioni per reimpostare la password."
        })
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({"error": "Si è verificato un errore imprevisto."}, status=500)


@api_view(['POST'])
def reset_password(request, uid, token):
    try:
        try:
            uid = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Link di reimpostazione password non valido."}, status=400)
        if not default_token_generator.check_token(user, token):
            return Response({"error": "Link di reimpostazione password non valido o scaduto."}, status=400)
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')
        if not password or not confirm_password:
            return Response({"error": "La password e la conferma della password sono obbligatorie."}, status=400)
        if password != confirm_password:
            return Response({"error": "Le password non corrispondono."}, status=400)
        user.set_password(password)
        user.save()
        return Response({"message": "La tua password è stata reimpostata con successo. Ora puoi accedere con la nuova password."})
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({"error": "Si è verificato un errore imprevisto."}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_list(request):
    try:
        groups = Group.objects.all()
        serializer = GroupListSerializer(groups, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


def _in_group(user, name: str):
    return user.groups.filter(name=name).exists()


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def user_finance_permissions(request):
    """
    GET: Return raw and effective finance permission flags.
    PATCH: Board only. Allowed only if target is ESNer in group 'Aspiranti'.
    """
    email = request.query_params.get("email")
    if not email:
        return Response({"error": "Missing 'email' parameter."}, status=400)

    try:
        print(email)
        target = User.objects.get(profile=email)

        def effective_manage(u):
            return u.can_manage_casse or _in_group(u, 'Attivi') or _in_group(u, 'Board')

        def effective_view(u):
            return u.can_view_casse_import or _in_group(u, 'Attivi') or _in_group(u, 'Board')

        if request.method == 'GET':
            return Response({
                'can_manage_casse': target.can_manage_casse,
                'can_view_casse_import': target.can_view_casse_import,
                'effective_can_manage_casse': effective_manage(target),
                'effective_can_view_casse_import': effective_view(target),
            }, status=200)

        if request.method == 'PATCH':
            if not user_is_board(request.user):
                return Response({'error': 'Solo Board può modificare questi permessi.'}, status=403)
            if not target.profile.is_esner:
                return Response({'error': 'Il profilo non è un ESNer.'}, status=400)
            if not _in_group(target, 'Aspiranti'):
                return Response({'error': 'Permessi speciali applicabili solo agli Aspiranti.'}, status=400)
            serializer = FinancePermissionSerializer(target, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response({
                    **serializer.data,
                    'effective_can_manage_casse': effective_manage(target),
                    'effective_can_view_casse_import': effective_view(target),
                }, status=200)
            return Response(serializer.errors, status=400)
        return Response({'error': 'Metodo non consentito.'}, status=405)
    except User.DoesNotExist:
        return Response({'error': 'Utente non trovato.'}, status=404)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)
