import logging
from django.db import transaction
from django.contrib.auth.models import Group
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from profiles.models import Profile, Document
from profiles.serializers import ProfileListViewSerializer, ProfileCreateSerializer, ProfileDetailViewSerializer
from profiles.serializers import DocumentCreateSerializer, DocumentEditSerializer, ProfileFullEditSerializer, ProfileBasicEditSerializer
from users.models import User
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from profiles.tokens import email_verification_token
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q

logger = logging.getLogger(__name__)
HOSTNAME = settings.HOSTNAME


# Endpoint to retrieve a list of the Erasmus profiles. Pagination is implemented
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def erasmus_profile_list(request):
    try:
        profiles = Profile.objects.filter(is_esner=False).order_by('-created_at')
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(profiles, request=request)
        serializer = ProfileListViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    except Exception as e:
        logger.error(str(e))
        return Response(status=500)


@api_view(['POST'])
def initiate_profile_creation(request):
    try:
        data = request.data

        # Validate data but don't save yet
        profile_serializer = ProfileCreateSerializer(data=data)
        document_serializer = DocumentCreateSerializer(
            data={k[9:]: v for k, v in data.items() if k.startswith('document-')},
            partial=True
        )

        profile_valid = profile_serializer.is_valid()
        document_valid = document_serializer.is_valid()

        if profile_valid and document_valid:
            with transaction.atomic():
                # Store validated data, set flags and create profile
                profile_data = profile_serializer.validated_data.copy()
                profile_data['enabled'] = False
                profile_data['email_is_verified'] = False
                profile = Profile.objects.create(**profile_data)

                # Create document (disabled until email verification) and create it
                document_data = document_serializer.validated_data.copy()
                document_data['enabled'] = False
                Document.objects.create(profile=profile, **document_data)

                # Create user if ESN member
                is_esner = profile_data.get('is_esner', False)
                if is_esner and 'password' in data:
                    user = User.objects.create_user(
                        profile=profile,
                        password=data.get('password')
                    )
                    user.is_active = False  # Will be activated upon verification
                    aspiranti_group, created = Group.objects.get_or_create(name="Aspiranti")
                    user.groups.add(aspiranti_group)

            # Generate verification token and send verification email
            uid = urlsafe_base64_encode(force_bytes(profile.pk))
            token = email_verification_token.make_token(profile)
            verification_link = f"http://{HOSTNAME}:3000/#/verify-email/{uid}/{token}"  # TODO: set proper url

            # Language selection
            if is_esner:
                subject = "Verifica email per ESN Polimi"
                from_email = settings.DEFAULT_FROM_EMAIL
                to_email = [profile.email]
                text_content = f"Clicca sul seguente link per verificare la tua email: {verification_link}"
                html_content = f"""
                <html>
                <body>
                    <h2>Benvenuto/a in ESN Polimi!</h2>
                    <p>Per favore, clicca sul seguente link per verificare la tua email:</p>
                    <p><a href="{verification_link}" style="background-color:#1a73e8; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; display:inline-block;">Verifica indirizzo email</a></p>
                    <p>Se il pulsante non funziona, copia e incolla questo URL nel tuo browser:</p>
                    <p>{verification_link}</p>
                    <p>Questo link scadrà tra 24 ore.</p>
                </body>
                </html>
                """
                success_message = "Email di verifica inviata. Controlla la tua casella di posta per completare la registrazione."
                error_message = "Errore nell'invio dell'email: "
            else:
                subject = "Email verification for ESN Polimi"
                from_email = settings.DEFAULT_FROM_EMAIL
                to_email = [profile.email]
                text_content = f"Click the following link to verify your email: {verification_link}"
                html_content = f"""
                <html>
                <body>
                    <h2>Welcome to ESN Polimi!</h2>
                    <p>Please click the following link to verify your email:</p>
                    <p><a href="{verification_link}" style="background-color:#1a73e8; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; display:inline-block;">Verify Email Address</a></p>
                    <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                    <p>{verification_link}</p>
                    <p>This link will expire in 24 hours.</p>
                </body>
                </html>
                """
                success_message = "Verification email sent. Check your inbox to complete registration."
                error_message = "Error sending email: "

            try:
                email = EmailMultiAlternatives(subject, text_content, from_email, to_email)
                email.attach_alternative(html_content, "text/html")
                email.send(fail_silently=False)

                print(f"Email sent to {profile.email}")
            except Exception as e:
                print(f"Email error: {str(e)}")
                # Don't delete profile on email error, just return the error
                return Response({"error": f"{error_message}{str(e)}"}, status=500)

            return Response({
                "message": success_message
            })
        else:
            # Return validation errors
            errors = {}
            if not profile_valid:
                errors.update({k: v[0] for k, v in profile_serializer.errors.items()})
            if not document_valid:
                errors.update({'document-' + k: v[0] for k, v in document_serializer.errors.items()})
            return Response(errors, status=400)

    except Exception as e:
        logger.error(str(e))
        return Response({"error": "Si è verificato un errore imprevisto: " + str(e)}, status=500)


@api_view(['GET'])
def verify_email_and_enable_profile(request, uid, token):
    try:
        # Get profile from uid
        try:
            uid = force_str(urlsafe_base64_decode(uid))
            profile = Profile.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, Profile.DoesNotExist):
            return Response({"error": "Link di verifica non valido."}, status=400)

        if not email_verification_token.check_token(profile, token):
            if profile.is_esner:
                return Response({"error": "Link di verifica non valido o scaduto."}, status=400)
            else:
                return Response({"error": "Invalid or expired verification link."}, status=400)

        if profile.email_is_verified:
            if profile.is_esner:
                return Response({"message": "Email già verificata."}, status=200)
            else:
                return Response({"message": "Email already verified."}, status=200)

        # Activate profile and related objects
        with transaction.atomic():
            profile.email_is_verified = True
            profile.enabled = True
            profile.save()

            # Enable document
            Document.objects.filter(profile=profile).update(enabled=True)

            # Activate user if esner
            if profile.is_esner:
                try:
                    user = User.objects.get(profile=profile)
                    user.is_active = True
                    user.save()
                except User.DoesNotExist:
                    return Response({"error": "L'utente associato a questo profilo non esiste."}, status=500)

        if profile.is_esner:
            return Response({"message": "Email verificata e profilo attivato con successo!"})
        else:
            return Response({"message": "Email verified and profile successfully activated!"})

    except Exception as e:
        logger.error(str(e))
        if 'profile' in locals() and hasattr(profile, 'is_esner') and profile.is_esner:
            return Response({"error": "Si è verificato un errore imprevisto."}, status=500)
        else:
            return Response({"error": "An unexpected error occurred."}, status=500)


# Endpoint to view in detail, edit, delete a profile
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def profile_detail(request, pk):
    try:
        profile = Profile.objects.get(pk=pk)
        if request.method == 'GET':
            serializer = ProfileDetailViewSerializer(profile)
            return Response(serializer.data)

        elif request.method == 'PATCH':
            if request.user.has_perm('profiles.change_profile'):
                serializer = ProfileFullEditSerializer(profile, data=request.data, partial=True)
            elif request.user.has_perm('profiles.change_person_code'):  # TODO: permission to define via Meta in the model
                serializer = ProfileBasicEditSerializer(profile, data=request.data, partial=True)
            else:
                return Response({'error': 'Non hai i permessi per modificare questo profilo.'}, status=403)

            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)

        elif request.method == 'DELETE':
            if request.user.has_perm('profiles.delete_profile'):
                profile.enabled = False
                profile.save()
                return Response(status=200)
            return Response({'error': 'Non hai i permessi per eliminare questo profilo.'}, status=401)
        else:
            return Response({'error': 'Metodo non supportato.'}, status=405)

    except Profile.DoesNotExist:
        return Response('Il profilo non esiste.', status=404)

    except Exception as e:
        logger.error(str(e))
        return Response({'error': 'Si è verificato un errore imprevisto.'}, status=500)


# Endpoint to create document
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def document_creation(request):
    try:
        document_serializer = DocumentCreateSerializer(data=request.data, partial=True)

        if document_serializer.is_valid():
            document_serializer.save()
            return Response(document_serializer.data, status=200)

        else:
            return Response(document_serializer.errors, status=400)

    except Exception as e:
        logger.error(str(e))
        return Response('Si è verificato un errore imprevisto.', status=500)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def document_detail(request, pk):
    try:
        document = Document.objects.get(pk=pk)
        if request.method == 'PATCH':
            if request.user.has_perm('profiles.change_document'):
                document_serializer = DocumentEditSerializer(document, data=request.data, partial=True)
                if document_serializer.is_valid():
                    document_serializer.save()
                    return Response(status=200)
                else:
                    return Response(document_serializer.errors, status=400)
            else:
                return Response({'error': 'Non hai i permessi per modificare questo documento.'}, status=403)

        elif request.method == 'DELETE':
            if request.user.has_perm('profiles.delete_document'):
                document.enabled = False
                document.save()
                return Response(status=200)
            else:
                return Response({'error': 'Non hai i permessi per eliminare questo documento.'}, status=403)
        else:
            return Response({'error': 'Metodo non supportato.'}, status=405)
    except Document.DoesNotExist:
        return Response('Il documento non esiste.', status=400)

    except Exception as e:
        logger.error(str(e))
        return Response(str(e), status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_profiles(request):
    try:
        query = request.GET.get('q', '').strip()
        valid_only = request.GET.get('valid_only', 'false').lower() == 'true'
        esner_only = request.GET.get('esner_only', 'false').lower() == 'true'

        if len(query) < 2:
            return Response({"results": []})

        # Search by name, surname, or esncard
        tokens = query.split()
        q_filter = Q()
        for token in tokens:
            q_filter &= (
                    Q(name__icontains=token) |
                    Q(surname__icontains=token) |
                    Q(esncard__enabled=True, esncard__number__icontains=token)
            )
        profiles = Profile.objects.filter(q_filter).distinct()

        if valid_only:
            profiles = profiles.filter(enabled=True, email_is_verified=True)

        if esner_only:
            profiles = profiles.filter(is_esner=True)

        # Order by most relevant (exact matches first, then contains)
        profiles = profiles.order_by('-created_at')

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(profiles, request=request)
        serializer = ProfileListViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    except Exception as e:
        logger.error(str(e))
        return Response({"error": "Si è verificato un errore: " + str(e)}, status=500)
