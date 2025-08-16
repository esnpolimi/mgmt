import logging
import sentry_sdk

from django.conf import settings
from django.contrib.auth.models import Group
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.db.models import Q
from django.utils.encoding import force_bytes
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.utils.http import urlsafe_base64_encode
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import NotFound
from django.core.paginator import InvalidPage

from events.models import Subscription, EventOrganizer
from events.serializers import SubscriptionSerializer, OrganizedEventSerializer
from profiles.models import Profile, Document
from profiles.serializers import DocumentCreateSerializer, DocumentEditSerializer, ProfileFullEditSerializer
from profiles.serializers import ProfileListViewSerializer, ProfileCreateSerializer, ProfileDetailViewSerializer
from profiles.tokens import email_verification_token
from users.models import User
from users.serializers import UserGroupEditSerializer

logger = logging.getLogger(__name__)
SCHEME_HOST = settings.SCHEME_HOST


def user_is_board(user):
    return user.groups.filter(name="Board").exists()


def get_action_permissions(action, user):
    """
    Returns True if the user has permission for the specified action.
    """
    if action == 'profile_detail_patch':
        return user.has_perm('profiles.change_profile')
    if action == 'profile_detail_delete':
        return user_is_board(user)
    if action == 'document_patch':
        return user.has_perm('profiles.change_document')
    if action == 'document_delete':
        return user.has_perm('profiles.delete_document')
    return True


# Endpoint to retrieve a list of Erasmus or ESNers profiles. Pagination is implemented
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_list(request, is_esner):
    try:
        profiles = Profile.objects.filter(is_esner=is_esner).order_by('-created_at')
        search = request.GET.get('search', '').strip()
        if search:
            profiles = profiles.filter(
                Q(name__icontains=search) |
                Q(surname__icontains=search) |
                Q(email__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(whatsapp_number__icontains=search)
            )

        # Filter by user's group (only if ESNer)
        if is_esner:
            group_param = request.GET.get('group', '')
            if group_param:
                group_names = [g.strip() for g in group_param.split(',') if g.strip()]
                if group_names:
                    user_profile_ids = User.objects.filter(groups__name__in=group_names) \
                        .values_list('profile__id', flat=True).distinct()
                    profiles = profiles.filter(id__in=user_profile_ids)

        # Updated ESNcard validity multi-selection filtering (union logic)
        esncard_validity_param = request.GET.get('esncardValidity', '')
        if esncard_validity_param:
            validity_values = [v.strip() for v in esncard_validity_param.split(',') if v.strip()]
            profiles = profiles.prefetch_related('esncard_set')
            profiles_list = list(profiles)
            union_ids = set()
            for profile in profiles_list:
                card = profile.latest_esncard
                if card:
                    if card.is_valid and 'valid' in validity_values:
                        union_ids.add(profile.id)
                    elif not card.is_valid and 'expired' in validity_values:
                        union_ids.add(profile.id)
                else:
                    if 'absent' in validity_values:
                        union_ids.add(profile.id)
            profiles = profiles.filter(id__in=union_ids) if union_ids else profiles.none()

        paginator = PageNumberPagination()
        paginator.page_size_query_param = 'page_size'
        try:
            page = paginator.paginate_queryset(profiles, request=request)
        except (NotFound, InvalidPage):
            return Response({'error': 'Invalid page.'}, status=400)
        serializer = ProfileListViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
def initiate_profile_creation(request):
    try:
        data = request.data

        # Enforce esnpolimi.it domain for ESNer registration
        is_esner = data.get('is_esner', False)
        email = data.get('email', '')
        if is_esner and (not isinstance(email, str) or not email.endswith('@esnpolimi.it')):
            return Response({'email': 'Solo email @esnpolimi.it sono ammesse per la registrazione.'}, status=400)

        # Validate data but don't save yet
        profile_serializer = ProfileCreateSerializer(data=data)
        document_serializer = DocumentCreateSerializer(
            data={k[9:]: v for k, v in data.items() if k.startswith('document_')},
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
                password = data.get('password')
                if is_esner and password:
                    try:
                        user = User.objects.create_user(profile=profile, password=password)
                        user.is_active = False
                        aspiranti_group, created = Group.objects.get_or_create(name="Aspiranti")
                        user.save()  # Ensure user is saved before adding group
                        user.groups.add(aspiranti_group)
                        user.save()  # Explicit save after group assignment
                        logger.info(f"User created for profile {profile.email}")
                    except Exception as e:
                        Document.objects.filter(profile=profile).delete()
                        profile.delete()
                        logger.error(f"User creation failed for profile {profile.email}: {str(e)}")
                        sentry_sdk.capture_exception(e)
                        return Response({"error": f"User creation failed: {str(e)}"}, status=500)

            # Generate verification token and send verification email
            uid = urlsafe_base64_encode(force_bytes(profile.pk))
            token = email_verification_token.make_token(profile)
            verification_link = f"{SCHEME_HOST}/verify-email/{uid}/{token}"

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

                logger.info(f"Email sent to {profile.email}")
            except Exception as e:
                logger.info(f"Email error: {str(e)}")
                return Response({"error": f"{error_message}{str(e)}"}, status=500)

            return Response({"message": success_message}, status=201)
        else:
            # Return validation errors
            errors = {}
            if not profile_valid:
                errors.update({k: v[0] for k, v in profile_serializer.errors.items()})
            if not document_valid:
                errors.update({'document_' + k: v[0] for k, v in document_serializer.errors.items()})
            return Response(errors, status=400)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['GET'])
def verify_email_and_enable_profile(request, uid, token):
    try:
        # Get profile from uid
        try:
            uid = force_str(urlsafe_base64_decode(uid))
            profile = Profile.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, Profile.DoesNotExist):
            return Response({'error': 'Link di verifica non valido.'}, status=400)

        if not email_verification_token.check_token(profile, token):
            if profile.is_esner:
                return Response({'error': 'Link di verifica non valido o scaduto.'}, status=400)
            else:
                return Response(
                    {'error': 'Invalid or expired verification link. Please contact us at informatica@esnpolimi.it'},
                    status=400)

        if profile.email_is_verified:
            if profile.is_esner:
                return Response({'message': 'Email già verificata.'}, status=200)
            else:
                return Response({'message': 'Email already verified.'}, status=200)

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
                    return Response({'error': "L'utente associato a questo profilo non esiste."}, status=500)

        if profile.is_esner:
            return Response({'message': 'Email verificata e profilo attivato con successo!'})
        else:
            return Response({'message': 'Email verified and profile successfully activated!'})
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


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
            if not get_action_permissions('profile_detail_patch', request.user):
                return Response({'error': 'Non hai i permessi per modificare questo profilo.'}, status=403)
            serializer = ProfileFullEditSerializer(profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                group_name = request.data.get('group')
                try:
                    user = User.objects.get(profile=profile)
                    current_group_obj = user.groups.first()
                    current_group = current_group_obj.name if current_group_obj else None

                    # Only allow change if requested group is different
                    if current_group != group_name:
                        # Permission logic
                        allowed = False
                        error_msg = None
                        # Get requester's group
                        try:
                            requester_user = User.objects.get(profile=request.user.profile)
                            requester_group_obj = requester_user.groups.first()
                            requester_group = requester_group_obj.name if requester_group_obj else None
                        except ExceptionGroup:
                            requester_group = None

                        if current_group == "Aspiranti" and group_name == "Attivi":
                            if requester_group in ["Board"]:
                                allowed = True
                            else:
                                error_msg = "Solo membri Board possono promuovere Aspiranti ad Attivi."
                        elif current_group == "Attivi" and group_name == "Board":
                            if requester_group == "Board":
                                allowed = True
                            else:
                                error_msg = "Solo membri Board possono promuovere Attivi a Board."
                        else:
                            allowed = True  # Other transitions allowed

                        if allowed:
                            group_serializer = UserGroupEditSerializer(user, data={'group': group_name}, partial=True)
                            if group_serializer.is_valid():
                                group_serializer.save()
                            else:
                                return Response(group_serializer.errors, status=400)
                        else:
                            return Response({'error': error_msg}, status=403)
                    # else: no change needed
                except User.DoesNotExist:
                    pass
                response_serializer = ProfileDetailViewSerializer(profile)
                return Response(response_serializer.data)
            return Response(serializer.errors, status=400)

        elif request.method == 'DELETE':
            if not get_action_permissions('profile_detail_delete', request.user):
                return Response({'error': 'Non hai i permessi per eliminare questo profilo.'}, status=401)
            profile.enabled = False
            profile.save()
            return Response(status=200)
        else:
            return Response({'error': 'Metodo non supportato.'}, status=405)
    except Profile.DoesNotExist:
        return Response({'error': 'Il profilo non esiste.'}, status=404)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


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
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def document_detail(request, pk):
    try:
        document = Document.objects.get(pk=pk)
        if request.method == 'PATCH':
            if not get_action_permissions('document_patch', request.user):
                return Response({'error': 'Non hai i permessi per modificare questo documento.'}, status=403)
            document_serializer = DocumentEditSerializer(document, data=request.data, partial=True)
            if document_serializer.is_valid():
                document_serializer.save()
                return Response(status=200)
            else:
                return Response(document_serializer.errors, status=400)
        elif request.method == 'DELETE':
            if not get_action_permissions('document_delete', request.user):
                return Response({'error': 'Non hai i permessi per eliminare questo documento.'}, status=403)
            document.enabled = False
            document.save()
            return Response(status=200)
        else:
            return Response({'error': 'Metodo non supportato.'}, status=405)
    except Document.DoesNotExist:
        return Response({'error': 'Il documento non esiste.'}, status=404)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


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
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(profiles, request=request)
        serializer = ProfileListViewSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_subscriptions(_, pk):
    """
    Returns all subscriptions for a given profile, with event and list info.
    """
    try:
        subs = Subscription.objects.filter(profile_id=pk).select_related('event', 'list')
        serializer = SubscriptionSerializer(subs, many=True)
        return Response(serializer.data, status=200)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
def check_erasmus_email(request):
    """
    Public endpoint to check if an email belongs to an Erasmus profile.
    """
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email required.'}, status=400)
    exists = Profile.objects.filter(email__iexact=email, is_esner=False, enabled=True, email_is_verified=True).exists()
    # Return profile data to allow automatic field filling in the form
    if exists:
        profile = Profile.objects.get(email__iexact=email, is_esner=False, enabled=True, email_is_verified=True)
        serializer = ProfileDetailViewSerializer(profile)
        return Response(serializer.data, status=200)
    else:
        return Response(None, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_organized_events(_, pk):
    """
    Returns a list of events organized by the profile (for ESNers).
    """
    organizers = EventOrganizer.objects.filter(profile_id=pk).select_related('event')
    data = [
        {
            'event_id': org.event.id,
            'event_name': org.event.name,
            'event_date': org.event.date,
            'is_lead': org.is_lead
        }
        for org in organizers
    ]
    serializer = OrganizedEventSerializer(data, many=True)
    return Response(serializer.data)
