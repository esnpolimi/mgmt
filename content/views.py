import csv
import io
import logging
from datetime import datetime

from django.conf import settings
from django.core.mail import send_mail
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from rest_framework import viewsets, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status as drf_status
from .models import ContentSection, ContentLink, WhatsAppConfig
from .serializers import (
    ContentSectionSerializer, ContentLinkSerializer,
    WhatsAppConfigSerializer, WhatsAppRegistrationSerializer,
)

logger = logging.getLogger(__name__)

_CSV_FILENAME = 'cronologia richieste gruppo whatsapp.csv'
_CSV_HEADERS = [
    'Timestamp', 'Email', 'Nome', 'Cognome',
    'Studente Internazionale/Erasmus', 'Università di Provenienza',
    'Corso di Studi (Polimi)', 'Esito',
]


def _get_drive_service():
    credentials = service_account.Credentials.from_service_account_file(
        settings.GOOGLE_SERVICE_ACCOUNT_FILE,
        scopes=['https://www.googleapis.com/auth/drive'],
    )
    return build('drive', 'v3', credentials=credentials)


def _append_to_whatsapp_log(data, outcome):
    """
    Append one registration row to a CSV file on Google Drive.
    Uses only the Drive API (no Sheets API needed).
    Returns None on success, or an error string on failure.
    """
    try:
        folder_id = settings.GOOGLE_DRIVE_FOLDER_ID
        drive = _get_drive_service()

        # Search for existing CSV file in the Drive folder
        escaped_name = _CSV_FILENAME.replace("'", "\\'")
        query = (
            f"name='{escaped_name}' and '{folder_id}' in parents and trashed=false"
        )
        results = drive.files().list(
            q=query, spaces='drive', fields='files(id)',
            supportsAllDrives=True, includeItemsFromAllDrives=True,
        ).execute()
        files = results.get('files', [])

        new_row = [
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            data['email'],
            data['first_name'],
            data['last_name'],
            'Sì' if data['is_international'] else 'No',
            data['home_university'],
            data['course_of_study'],
            outcome,
        ]

        if files:
            # Download existing CSV, append the new row, re-upload
            file_id = files[0]['id']
            existing_bytes = drive.files().get_media(fileId=file_id).execute()
            existing_text = existing_bytes.decode('utf-8-sig')

            output = io.StringIO()
            output.write(existing_text)
            if existing_text and not existing_text.endswith('\n'):
                output.write('\n')
            csv.writer(output).writerow(new_row)

            content_bytes = output.getvalue().encode('utf-8-sig')
            drive.files().update(
                fileId=file_id,
                media_body=MediaIoBaseUpload(
                    io.BytesIO(content_bytes), mimetype='text/csv',
                ),
                supportsAllDrives=True,
            ).execute()
        else:
            # Create a new CSV file with header + first row
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(_CSV_HEADERS)
            writer.writerow(new_row)

            content_bytes = output.getvalue().encode('utf-8-sig')
            drive.files().create(
                body={'name': _CSV_FILENAME, 'parents': [folder_id]},
                media_body=MediaIoBaseUpload(
                    io.BytesIO(content_bytes), mimetype='text/csv',
                ),
                fields='id',
                supportsAllDrives=True,
            ).execute()

        logger.info(f"WhatsApp CSV log appended for {data['email']} — {outcome}")
        return None
    except Exception as e:
        error_msg = f"Drive CSV logging failed: {e}"
        logger.error(error_msg)
        return error_msg


class IsFinanceManagerOrReadOnly(permissions.BasePermission):
    """
    Custom permission for content management.
    - GET: All authenticated users
    - POST/PUT/PATCH/DELETE: Board, Attivi, Aspiranti with can_manage_casse,
      or users with can_manage_content flag
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        # Check if user can manage treasury (same permissions as Tesoreria)
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        # Board and Attivi always have permission
        if user.groups.filter(name__in=['Board', 'Attivi']).exists():
            return True
        
        # Aspiranti with the special finance flag
        if getattr(user, 'can_manage_casse', False):
            return True
        
        # Users with the Content Manager flag
        if getattr(user, 'can_manage_content', False):
            return True
        
        return False


class ContentSectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ContentSection.
    GET: Available to all authenticated users
    POST/PUT/PATCH/DELETE: Users with treasury management permissions
    """
    queryset = ContentSection.objects.filter(is_active=True).prefetch_related('links')
    serializer_class = ContentSectionSerializer
    permission_classes = [IsFinanceManagerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def active_sections(self, request):
        """Get all active sections with their links."""
        sections = ContentSection.objects.filter(is_active=True).prefetch_related('links')
        serializer = ContentSectionSerializer(sections, many=True)
        return Response(serializer.data)


class ContentLinkViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ContentLink.
    GET: Available to all authenticated users
    POST/PUT/PATCH/DELETE: Users with treasury management permissions
    """
    queryset = ContentLink.objects.all()
    serializer_class = ContentLinkSerializer
    permission_classes = [IsFinanceManagerOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        section_id = self.request.query_params.get('section', None)
        if section_id:
            queryset = queryset.filter(section_id=section_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def whatsapp_config(request):
    """
    GET  /backend/content/whatsapp-config/  → returns the current WhatsApp link.
    PATCH /backend/content/whatsapp-config/ → updates the link (board/attivi only).
    """
    instance = WhatsAppConfig.get_instance()

    if request.method == 'GET':
        serializer = WhatsAppConfigSerializer(instance)
        return Response(serializer.data)

    # PATCH – board/attivi or content managers can edit
    user = request.user
    can_edit = (
        user.groups.filter(name__in=['Board', 'Attivi']).exists()
        or getattr(user, 'can_manage_casse', False)
        or getattr(user, 'can_manage_content', False)
    )
    if not can_edit:
        return Response({'detail': 'Permission denied.'}, status=drf_status.HTTP_403_FORBIDDEN)

    serializer = WhatsAppConfigSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=user)
        return Response(serializer.data)
    return Response(serializer.errors, status=drf_status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def whatsapp_register(request):
    """
    POST /backend/content/whatsapp-register/
    Public endpoint: validates the form and sends the WhatsApp link by email.
    """
    serializer = WhatsAppRegistrationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=drf_status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    config = WhatsAppConfig.get_instance()

    # Only International / Erasmus students are admitted
    if not data['is_international']:
        _append_to_whatsapp_log(data, 'Non ammesso (non internazionale/Erasmus)')
        return Response(
            {'detail': 'Not admitted: the group is reserved for International and Erasmus students.'},
            status=drf_status.HTTP_403_FORBIDDEN,
        )

    if not config.whatsapp_link:
        _append_to_whatsapp_log(data, 'Errore: link WhatsApp non configurato')
        return Response(
            {'detail': 'The WhatsApp link has not been configured yet. Please contact us on Instagram.'},
            status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    first_name = data['first_name']
    email = data['email']
    whatsapp_link = config.whatsapp_link

    subject = 'ESN Politecnico Milano – WhatsApp Group Link'
    html_content = f"""
    <html><body>
    <p>Hi {first_name},</p>
    <p>here is the link to gain access to the WhatsApp group:
    <a href="{whatsapp_link}">ESN Politecnico Milano - WhatsApp</a>.</p>
    <p>We kindly ask you not to share the link, as the access to the group should be limited
    to students attending Politecnico di Milano, or exchange students studying at our university.</p>
    <p>Please contact us at <strong>@esnpolimi</strong> on Instagram for every information.</p>
    <br/>
    <p>Have a nice day!</p>
    <p><strong>ESN Politecnico Milano</strong></p>
    </body></html>
    """
    plain_content = (
        f"Hi {first_name},\n\n"
        f"here is the link to gain access to the WhatsApp group: ESN Politecnico Milano - WhatsApp "
        f"({whatsapp_link}).\n"
        "We kindly ask you not to share the link, as the access to the group should be limited "
        "to students attending Politecnico di Milano, or exchange students studying at our university.\n"
        "Please contact us at @esnpolimi on Instagram for every information.\n\n"
        "Have a nice day!\n\nESN Politecnico Milano"
    )

    try:
        send_mail(
            subject=subject,
            message=plain_content,
            from_email=None,  # uses DEFAULT_FROM_EMAIL
            recipient_list=[email],
            html_message=html_content,
            fail_silently=False,
        )
        logger.info(f"WhatsApp link sent to {email}")
    except Exception as e:
        logger.error(f"Error sending WhatsApp link email to {email}: {e}")
        _append_to_whatsapp_log(data, f'Errore invio email: {e}')
        return Response(
            {'detail': f'Error sending email: {e}'},
            status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    log_error = _append_to_whatsapp_log(data, 'Email inviata')
    response_body = {'message': 'Email sent successfully.'}
    if log_error:
        response_body['warning'] = log_error
    return Response(response_body, status=drf_status.HTTP_200_OK)
