import logging
import time
from datetime import timedelta
from decimal import Decimal
from io import BytesIO

import requests
import sentry_sdk
from babel.dates import format_date
from django.conf import settings
from django.core.exceptions import ValidationError, PermissionDenied, ObjectDoesNotExist
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q, Count
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
import json

from events.models import Event, Subscription
from events.models import EventList, validate_field_data
from events.serializers import (
    EventsListSerializer, EventCreationSerializer,
    SubscriptionCreateSerializer, SubscriptionUpdateSerializer,
    EventWithSubscriptionsSerializer, SubscriptionSerializer, PrintableLiberatoriaSerializer,
    LiberatoriaProfileSerializer
)
from profiles.models import Profile
from treasury.models import Transaction, Account

logger = logging.getLogger(__name__)

# --- Allowed file types for 'link' form fields (mirrors treasury) ---
FORM_UPLOAD_ALLOWED_MIMETYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/bmp',
    'image/webp',
    'image/tiff',
    'image/heic',
    'image/heif'
]
FORM_UPLOAD_ALLOWED_EXTENSIONS = [
    '.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif', '.heic', '.heif'
]


def _validate_form_upload(file_obj):
    ext = os.path.splitext(file_obj.name)[1].lower()
    if hasattr(file_obj, 'content_type') and file_obj.content_type not in FORM_UPLOAD_ALLOWED_MIMETYPES:
        raise ValidationError("File must be an image or a PDF.")
    if ext not in FORM_UPLOAD_ALLOWED_EXTENSIONS:
        raise ValidationError("File must be an image or a PDF.")
    return True


def _get_or_create_event_folder(service, parent_folder_id, event_name, event_id, event_date=None):
    """
    Gets or creates a folder for the event inside the parent folder.
    Returns the folder ID.
    """
    # Sanitize event name for folder name
    safe_event_name = "".join(c for c in event_name if c.isalnum() or c in (' ', '-', '_'))[:100]
    
    # Include event date in folder name if available
    if event_date:
        date_str = event_date.strftime('%Y-%m-%d')
        folder_name = f"{safe_event_name} ({date_str})"
    else:
        folder_name = f"{safe_event_name} (ID_{event_id})"
    
    # Check if folder already exists
    query = f"name='{folder_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()
    
    items = results.get('files', [])
    if items:
        return items[0]['id']
    
    # Create new folder if it doesn't exist
    folder_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_folder_id]
    }
    folder = service.files().create(
        body=folder_metadata,
        fields='id',
        supportsAllDrives=True
    ).execute()
    
    return folder['id']


def _upload_form_file_to_drive(file_obj, event_id, field_name, event_name=None, event_date=None):
    """
    Uploads file for form 'l' field to Drive and returns public link.
    Creates a dedicated folder for the event if event_name is provided.
    """
    GOOGLE_DRIVE_FOLDER_ID = settings.GOOGLE_DRIVE_FOLDER_ID
    SERVICE_ACCOUNT_FILE = settings.GOOGLE_SERVICE_ACCOUNT_FILE
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=['https://www.googleapis.com/auth/drive']
    )
    service = build('drive', 'v3', credentials=credentials)
    
    # Get or create event-specific folder
    if event_name:
        target_folder_id = _get_or_create_event_folder(service, GOOGLE_DRIVE_FOLDER_ID, event_name, event_id, event_date)
    else:
        target_folder_id = GOOGLE_DRIVE_FOLDER_ID
    
    file_obj.seek(0)
    mimetype = getattr(file_obj, 'content_type', 'application/octet-stream')
    # Use original filename
    filename = file_obj.name
    media = MediaIoBaseUpload(file_obj, mimetype=mimetype)
    metadata = {'name': filename, 'parents': [target_folder_id]}
    created = service.files().create(
        body=metadata,
        media_body=media,
        fields='id',
        supportsAllDrives=True
    ).execute()
    service.permissions().create(
        fileId=created['id'],
        body={'role': 'reader', 'type': 'anyone'},
        supportsAllDrives=True
    ).execute()
    return f"https://drive.google.com/file/d/{created['id']}/view?usp=sharing"


# Merge phone/whatsapp prefixes into numbers in any dict/list payload
def _combine_prefix_numbers(obj):
    def _merge_in_place(d, num_key, pref_key, also_keys=None):
        if not isinstance(d, dict):
            return
        n = (d.get(num_key) or "").strip()
        p = (d.get(pref_key) or "").strip()
        if n and p and not n.startswith(p):
            d[num_key] = f"{p} {n}"
        # Optional aliases like 'phone'/'whatsapp'
        for k in (also_keys or []):
            v = (d.get(k) or "").strip()
            if v and p and not v.startswith(p):
                d[k] = f"{p} {v}"

    if isinstance(obj, dict):
        _merge_in_place(obj, 'phone_number', 'phone_prefix', also_keys=['phone'])
        _merge_in_place(obj, 'whatsapp_number', 'whatsapp_prefix', also_keys=['whatsapp'])
        # Recurse
        for v in obj.values():
            _combine_prefix_numbers(v)
    elif isinstance(obj, list):
        for it in obj:
            _combine_prefix_numbers(it)


def _normalize_event_services(event):
    services = event.services or []
    normalized = []
    for s in services:
        if not isinstance(s, dict):
            continue
        sid = (s.get('id') or s.get('service_id') or '').strip()
        name = (s.get('name') or '').strip()
        if not name:
            continue
        try:
            price = Decimal(str(s.get('price') or 0))
        except Exception:
            price = Decimal('0')
        normalized.append({
            'id': sid,
            'name': name,
            'description': s.get('description', ''),
            'price': price
        })
    return normalized


def _build_selected_services(event, selected_services_raw):
    if not selected_services_raw:
        return [], []
    if not isinstance(selected_services_raw, list):
        return [], ["selected_services must be a list"]
    available = _normalize_event_services(event)
    by_id = {s['id']: s for s in available if s.get('id')}
    by_name = {s['name']: s for s in available if s.get('name')}
    errors = []
    normalized = []
    for idx, item in enumerate(selected_services_raw):
        if not isinstance(item, dict):
            errors.append(f"Invalid selected service at index {idx}")
            continue
        service_id = (item.get('service_id') or item.get('id') or '').strip()
        name = (item.get('name') or '').strip()
        try:
            quantity = int(item.get('quantity') or 1)
        except (TypeError, ValueError):
            quantity = 0
        if quantity <= 0:
            errors.append(f"Invalid quantity for service at index {idx}")
            continue
        svc = by_id.get(service_id) if service_id else None
        if not svc and name:
            svc = by_name.get(name)
        if not svc:
            errors.append(f"Unknown service selection at index {idx}")
            continue
        normalized.append({
            'service_id': svc.get('id') or service_id or svc.get('name'),
            'name': svc.get('name'),
            'price_at_purchase': str(svc.get('price') or 0),
            'quantity': quantity
        })
    return normalized, errors


def _parse_selected_services(raw_value):
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return raw_value
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _services_total(selected_services):
    total = Decimal('0')
    for s in (selected_services or []):
        try:
            price = Decimal(str(s.get('price_at_purchase') or s.get('price') or 0))
        except Exception:
            price = Decimal('0')
        try:
            qty = int(s.get('quantity') or 1)
        except Exception:
            qty = 1
        if qty > 0:
            total += (price * qty)
    return total


# --- Helper to auto-move from any non-ML/WL to ML/WL after payment ---
def attempt_move_from_form_list(subscription):
    """
    If the subscription is in a non-main/waiting list and a quota or deposit transaction exists
    (or event has no cost/deposit), move it to Main List (priority) else Waiting List.
    Returns outcome dict or None if not applicable.
    """
    try:
        lst = subscription.list
        # Only attempt if current list is neither Main nor Waiting
        if not lst or getattr(lst, 'is_main_list', False) or getattr(lst, 'is_waiting_list', False):
            return None

        event = subscription.event
        cost = Decimal(event.cost or 0)
        deposit = Decimal(event.deposit or 0)
        services_total = _services_total(subscription.selected_services or [])

        quota_tx_exists = Transaction.objects.filter(
            subscription=subscription,
            type=Transaction.TransactionType.SUBSCRIPTION
        ).exists()
        deposit_tx_exists = Transaction.objects.filter(
            subscription=subscription,
            type=Transaction.TransactionType.CAUZIONE
        ).exists()

        service_tx_exists = Transaction.objects.filter(
            subscription=subscription,
            type=Transaction.TransactionType.SERVICE
        ).exists()

        paid_flag = quota_tx_exists or deposit_tx_exists or service_tx_exists or (cost <= 0 and deposit <= 0 and services_total <= 0)
        if not paid_flag:
            return {'status': 'stayed', 'reason': 'not_paid'}

        lists_qs = event.lists.all()
        main_list = lists_qs.filter(is_main_list=True).first()
        waiting_list = lists_qs.filter(is_waiting_list=True).first()

        def has_space(target):
            if not target:
                return False
            if target.capacity == 0:
                return True
            return target.subscriptions.count() < target.capacity

        for target in [main_list, waiting_list]:
            if has_space(target):
                subscription.list = target
                subscription.save(update_fields=['list'])
                return {'status': 'moved', 'list': target.name}

        return {'status': 'stayed', 'reason': 'no_capacity'}
    except Exception as e:
        logger.error(f"attempt_move_from_form_list error sub {subscription.pk}: {e}")
        return {'status': 'stayed', 'reason': 'error'}


# -- Helper functions -- #
def get_action_permissions(request, action, default_perm=None):
    """
    Returns True if the user has the required permission for the action.
    You can customize this mapping per view/action.
    All actions must be explicitly mapped - no permissive default.
    """
    # Define permissions per action
    perms_map = {
        'event_detail_GET': 'events.view_event',
        'event_detail_PATCH': 'events.change_event',
        'event_detail_DELETE': 'events.delete_event',
        'subscription_detail_GET': 'events.view_subscription',
        'subscription_detail_PATCH': 'events.change_subscription',
        'subscription_detail_DELETE': 'events.delete_subscription',
        'event_creation_POST': 'events.add_event',
        'subscription_create_POST': 'events.add_subscription',
        'move_subscriptions_POST': 'events.change_subscription',
        'events_list_GET': 'events.view_event',
        'generate_liberatorie_pdf_POST': None,  # Special case: Board only (handled below)
        'printable_liberatorie_GET': None,  # Special case: Board only (handled below)
        'link_event_to_lists_POST': 'events.change_event',
        'available_events_for_sharing_GET': 'events.view_event',
    }
    
    # Special case: allow Board group for liberatorie actions
    if action in ['generate_liberatorie_pdf_POST', 'printable_liberatorie_GET']:
        if request.user.groups.filter(name='Board').exists():
            return True
        return False
    
    # Get permission from map or use provided default
    perm = perms_map.get(action, default_perm)
    
    if perm:
        return request.user.has_perm(perm)
    
    # If action not in map and no default provided, deny access (secure default)
    if action not in perms_map:
        logger.warning(f"Unknown action '{action}' in get_action_permissions - access denied")
        return False
    
    # If action is in map but perm is None and not a special case, deny
    return False


def _subscription_recipient_email(subscription):
    if subscription.profile and getattr(subscription.profile, 'email', None):
        return subscription.profile.email
    ad = subscription.additional_data or {}
    return ad.get('form_email') or ad.get('external_email')


def _get_bool(data, key, default=True):
    v = data.get(key, None) if hasattr(data, 'get') else None
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ('true', '1', 'yes', 'y', 'on')
    return bool(v)


def _send_email(subject, html_content, to_email):
    if not to_email:
        return False
    try:
        send_mail(
            subject=subject,
            message='',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
            html_message=html_content
        )
        return True
    except Exception as e:
        logger.warning(f"Email send failed ({subject}) -> {to_email}: {e}")
        return False


def _send_form_subscription_email(subscription, assigned_label, online_payment_required, payment_required):
    # Only for form-created subscriptions; send once
    if not getattr(subscription, 'created_by_form', False):
        return
    ad = subscription.additional_data or {}
    if ad.get('subscription_confirmation_email_sent'):
        return
    recipient = _subscription_recipient_email(subscription)
    if not recipient:
        return

    event = subscription.event
    waiting = 'wait' in (assigned_label or '').lower()
    notify_lists = getattr(event, 'notify_list', True)
    subject = f"{event.name} - Subscription received"
    html_parts = [
        "<html><body style='font-family:Arial,Helvetica,sans-serif;'>",
        "<p>We received your subscription!</p>",
    ]

    if payment_required:
        if online_payment_required:
            base = settings.SCHEME_HOST
            pay_link = f"{base}/event/{event.id}/pay?subscriptionId={subscription.id}"
            html_parts.append("<p>Please complete your payment to be assigned a spot in a list.</p>")
            # Hide concrete list hints if notify_list is False
            if notify_lists:
                if waiting:
                    html_parts.append("<p style='color:#b06500'>Spots are only available in the Waiting List at the moment.</p>")
                else:
                    html_parts.append("<p style='color:#0a5db3'>Spots are available in the Main List at the moment.</p>")
            html_parts.append(
                "<p>Use the link below to complete your payment:<br/>"
                f"<a href='{pay_link}' style='font-weight:bold;color:#0a5db3;'>{pay_link}</a></p>"
            )
        else:
            html_parts.append(
                "<p>Payment is required. Please follow the instructions already sent on our channels.<br/>"
            )
    else:
        html_parts.append("<p>No payment is required for this event.</p>")
    html_parts.append("<p>Thank you!<br/><br/><i>ESN Politecnico Milano</i></p></body></html>")
    html_content = "".join(html_parts)

    if _send_email(subject, html_content, recipient):
        ad['subscription_confirmation_email_sent'] = True
        subscription.additional_data = ad
        subscription.save(update_fields=['additional_data'])


def _send_payment_confirmation_email(subscription):
    ad = subscription.additional_data or {}
    recipient = _subscription_recipient_email(subscription)

    # Allow sending if:
    #  - subscription was created via public form (created_by_form)
    #  - OR a recipient is available (profile email / form email / external_email)
    if not (getattr(subscription, 'created_by_form', False) or recipient or (subscription.external_name and ad.get('external_email'))):
        logger.debug(f"_send_payment_confirmation_email: no recipient and not form-created -> skipping for sub {subscription.pk}")
        return

    if ad.get('payment_confirmation_email_sent'):
        logger.debug(f"_send_payment_confirmation_email: already sent flag present for sub {subscription.pk}")
        return

    event = subscription.event
    cost = Decimal(event.cost or 0)
    deposit = Decimal(event.deposit or 0)
    services_total = _services_total(subscription.selected_services or [])
    payment_required = (cost > 0) or (deposit > 0) or (services_total > 0)
    if not payment_required:
        logger.debug(f"_send_payment_confirmation_email: no payment required for event {event.id}, sub {subscription.pk}")
        return  # Nothing to confirm

    quota_tx = Transaction.objects.filter(subscription=subscription,
                                          type=Transaction.TransactionType.SUBSCRIPTION).exists()
    deposit_tx = Transaction.objects.filter(subscription=subscription,
                                            type=Transaction.TransactionType.CAUZIONE).exists()
    services_tx = Transaction.objects.filter(subscription=subscription,
                                             type=Transaction.TransactionType.SERVICE).exists()

    # Conditions:
    # - If cost > 0 -> require quota transaction
    # - Else if cost == 0 and deposit > 0 -> require deposit transaction
    if cost > 0 and not quota_tx:
        logger.debug(f"_send_payment_confirmation_email: quota tx missing for sub {subscription.pk}")
        return
    if cost == 0 and deposit > 0 and not deposit_tx:
        logger.debug(f"_send_payment_confirmation_email: deposit tx missing for sub {subscription.pk}")
        return
    if services_total > 0 and not services_tx:
        logger.debug(f"_send_payment_confirmation_email: services tx missing for sub {subscription.pk}")
        return

    if not recipient:
        logger.debug(f"_send_payment_confirmation_email: recipient resolution failed for sub {subscription.pk}")
        return

    paid_parts = []
    if quota_tx and cost > 0:
        paid_parts.append(f"fee ({cost} EUR)")
    if deposit_tx and deposit > 0:
        paid_parts.append(f"deposit ({deposit} EUR)")
    if services_tx and services_total > 0:
        paid_parts.append(f"services ({services_total} EUR)")
    paid_label = " and ".join(paid_parts) if paid_parts else "payment"

    subject = f"{event.name} - Payment confirmed"

    # Hide concrete list assignment if notify_list is False
    if getattr(event, 'notify_list', True):
        list_sentence = f"You have been assigned to the <b>{subscription.list.name if subscription.list else '(no list)'}</b>."
    else:
        list_sentence = "List of assignment to be determined, please wait for our confirmation."

    html_content = (
        "<html><body style='font-family:Arial,Helvetica,sans-serif;'>"
        f"<p>We have registered your <b>{paid_label}</b>.</p>"
        f"<p>{list_sentence}</p>"
        "<p>Thank you,<br/>ESN Politecnico Milano</p>"
        "</body></html>"
    )

    sent = _send_email(subject, html_content, recipient)
    if sent:
        ad['payment_confirmation_email_sent'] = True
        subscription.additional_data = ad
        subscription.save(update_fields=['additional_data'])
        logger.debug(f"_send_payment_confirmation_email: sent to {recipient} for sub {subscription.pk}")
    else:
        logger.warning(f"_send_payment_confirmation_email: failed to send to {recipient} for sub {subscription.pk}")


def _upsert_transaction(*, subscription, tx_type, account_id, amount, description, executor):
    """
    Create or (if account changed) recreate a transaction of given type.
    Idempotent if same account & amount.
    """
    if amount is None or amount <= 0:
        return None
    existing = Transaction.objects.filter(subscription=subscription, type=tx_type).first()
    if existing:
        # If same account & amount keep it
        if (account_id and existing.account_id != account_id) or (amount and existing.amount != amount):
            existing.delete()
        else:
            return existing
    return Transaction.objects.create(
        type=tx_type,
        account_id=account_id,
        subscription=subscription,
        executor=executor,  # may be None (now nullable)
        amount=amount,
        description=description
    )


def _remove_transaction(subscription, tx_type):
    """
    Delete a transaction of given type if exists.
    """
    Transaction.objects.filter(subscription=subscription, type=tx_type).delete()


def _sync_service_transactions(*, subscription, account_id, executor, allow_delete=True):
    existing_qs = Transaction.objects.filter(subscription=subscription, type=Transaction.TransactionType.SERVICE)
    if existing_qs.exists():
        if allow_delete:
            existing_qs.delete()
        else:
            return
    if not account_id:
        return
    selected_services = subscription.selected_services or []
    payer_name = None
    if subscription.profile:
        payer_name = f"{subscription.profile.name} {subscription.profile.surname}"
    elif subscription.external_name:
        payer_name = subscription.external_name

    for svc in selected_services:
        try:
            price = Decimal(str(svc.get('price_at_purchase') or svc.get('price') or 0))
        except Exception:
            price = Decimal('0')
        try:
            qty = int(svc.get('quantity') or 1)
        except Exception:
            qty = 1
        if qty <= 0:
            continue
        amount = price * qty
        if amount <= 0:
            continue
        name = svc.get('name') or 'Servizio'
        person_label = payer_name or 'Partecipante'
        Transaction.objects.create(
            type=Transaction.TransactionType.SERVICE,
            account_id=account_id,
            subscription=subscription,
            executor=executor,
            amount=amount,
            description=f"Servizio {name} x{qty} - {person_label} - {subscription.event.name}"
        )


def _handle_payment_status(*, subscription, account_id, quota_status, deposit_status, services_status=None,
                           executor, allow_delete=True, auto_move_on_payment=True, send_email_on_payment=True):
    """
    Apply payment statuses for quota & deposit using unified logic.
    quota_status / deposit_status: 'paid' | other (delete if allow_delete)
    Guaranteed: subscription is a saved instance (has .pk).
    Returns move_info if auto-move executed, else None.
    """
    event_obj = subscription.event
    quota_amount = Decimal(event_obj.cost or 0)
    deposit_amount = Decimal(event_obj.deposit or 0)
    payer = subscription.profile.name + " " + subscription.profile.surname if subscription.profile else subscription.external_name

    # Quota
    if quota_status == 'paid' and quota_amount > 0 and account_id:
        _upsert_transaction(
            subscription=subscription,
            tx_type=Transaction.TransactionType.SUBSCRIPTION,
            account_id=account_id,
            amount=quota_amount,
            description=f"Quota {payer} - {event_obj.name}",
            executor=executor
        )
    elif allow_delete:
        _remove_transaction(subscription, Transaction.TransactionType.SUBSCRIPTION)

    # Deposit
    if deposit_status == 'paid' and deposit_amount > 0 and account_id:
        _upsert_transaction(
            subscription=subscription,
            tx_type=Transaction.TransactionType.CAUZIONE,
            account_id=account_id,
            amount=deposit_amount,
            description=f"Cauzione {payer} - {event_obj.name}",
            executor=executor
        )
    elif allow_delete:
        _remove_transaction(subscription, Transaction.TransactionType.CAUZIONE)

    # Services
    services_total = _services_total(subscription.selected_services or [])
    if services_status == 'paid' and services_total > 0 and account_id:
        _sync_service_transactions(
            subscription=subscription,
            account_id=account_id,
            executor=executor,
            allow_delete=allow_delete
        )
    elif allow_delete:
        _remove_transaction(subscription, Transaction.TransactionType.SERVICE)

    # Determine if any payment is (now) registered
    did_pay = Transaction.objects.filter(subscription=subscription,
                                         type__in=[Transaction.TransactionType.SUBSCRIPTION,
                                                   Transaction.TransactionType.CAUZIONE,
                                                   Transaction.TransactionType.SERVICE]).exists()
    # print(f"DEBUG: did_pay={did_pay} for sub {subscription.pk}, auto_move={auto_move_on_payment}, send_email={send_email_on_payment}")
    move_info = None
    if auto_move_on_payment and did_pay:
        try:
            move_info = attempt_move_from_form_list(subscription)
        except Exception as move_err:
            logger.error(f"Auto-move after payment failed for sub {subscription.pk}: {move_err}")

    if send_email_on_payment and did_pay:
        _send_payment_confirmation_email(subscription)

    return move_info


# --------------------------------------------------------------------------------------


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def events_list(request):
    if not get_action_permissions(request, 'events_list_GET'):
        return Response({'error': 'Non hai i permessi per visualizzare gli eventi.'}, status=403)
    try:
        events = Event.objects.all().order_by('-created_at')
        # --- Filter out board-only events unless user is board member ---
        if not request.user.groups.filter(name__in=['Board']).exists():
            events = events.filter(visible_to_board_only=False)

        search = request.GET.get('search', '').strip()
        if search:
            events = events.filter(Q(name__icontains=search))

        status_param = request.GET.get('status', '').strip()
        if status_param:
            status_set = {s.strip() for s in status_param.split(',') if s.strip()}
            if status_set:
                matching_ids = [e.id for e in events if e.status in status_set]
                events = events.filter(id__in=matching_ids)

        date_from = request.GET.get('dateFrom')
        if date_from:
            events = events.filter(date__gte=date_from)
        date_to = request.GET.get('dateTo')
        if date_to:
            events = events.filter(date__lte=parse_datetime(date_to) + timedelta(days=1))

        paginator = PageNumberPagination()
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(events, request=request)
        serializer = EventsListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to create event
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def event_creation(request):
    if not get_action_permissions(request, 'event_creation_POST'):
        return Response({'error': 'Non hai i permessi per creare eventi.'}, status=403)
    try:
        event_serializer = EventCreationSerializer(data=request.data)

        if event_serializer.is_valid():
            event_serializer.save()
            return Response(event_serializer.data, status=200)
        else:
            return Response(event_serializer.errors, status=400)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to edit/view/delete event in detail
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def event_detail(request, pk):
    try:
        event = Event.objects.get(pk=pk)
        # --- Filter out board-only event unless user is board member ---
        if event.visible_to_board_only and not request.user.groups.filter(name__in=['Board']).exists():
            return Response({'error': 'Non hai i permessi per visualizzare questo evento.'}, status=403)

        if request.method == 'GET':
            if not get_action_permissions(request, 'event_detail_GET'):
                return Response({'error': 'Non hai i permessi per visualizzare questo evento.'}, status=403)
            serializer = EventWithSubscriptionsSerializer(event)
            data = serializer.data
            _combine_prefix_numbers(data)  # ensure phone/wa numbers include prefix
            return Response(data, status=200)

        elif request.method == 'PATCH':
            if not get_action_permissions(request, 'event_detail_PATCH'):
                return Response({'error': 'Non hai i permessi per modificare questo evento.'}, status=403)

            # Validation logic is handled in the serializer
            serializer = EventCreationSerializer(
                instance=event,
                data=request.data,
                partial=True,
                context={'user': request.user}
            )

            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=200)
            else:
                return Response(serializer.errors, status=400)

        elif request.method == 'DELETE':
            if not get_action_permissions(request, 'event_detail_DELETE'):
                return Response({'error': 'Non hai i permessi per eliminare questo evento.'}, status=403)
            # Allow deletion only if there are no subscriptions
            if Subscription.objects.filter(event=event).exists():
                return Response({'error': 'Non è possibile eliminare un evento che ha delle iscrizioni.'}, status=400)
            event.delete()
            return Response(status=200)
        else:
            return Response({'error': "Metodo non consentito"}, status=405)
    except Event.DoesNotExist:
        return Response({'error': "L'evento non esiste"}, status=404)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=403)
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscription_create(request):
    if not get_action_permissions(request, 'subscription_create_POST'):
        return Response({'error': 'Non hai i permessi per creare iscrizioni.'}, status=403)
    try:
        profile = request.data.get('profile')
        event_id = request.data.get('event')
        external_name = request.data.get('external_name', '').strip()
        event = Event.objects.get(id=event_id)
        now = timezone.now()
        if not (event.subscription_start_date and event.subscription_end_date):
            return Response({'error': "Il periodo di iscrizione non è definito"}, status=400)
        if not (event.subscription_start_date <= now <= event.subscription_end_date):
            return Response({'error': "Il periodo di iscrizione non è attivo"}, status=400)

        # Check for duplicate subscription
        if profile and Subscription.objects.filter(profile=profile, event=event_id).exists():
            return Response({'error': "Il profilo è già iscritto all'evento"}, status=400)
        if external_name and Subscription.objects.filter(external_name=external_name, event=event_id).exists():
            return Response({'error': "Il nominativo esterno è già iscritto all'evento"}, status=400)
        if not profile and not external_name:
            if event.is_allow_external:
                return Response({'error': "Devi inserire un nominativo esterno se non selezioni un profilo."},
                                status=400)
            else:
                return Response({'error': "Seleziona un profilo per l'iscrizione."}, status=400)

        # Normalize selected services (if any)
        raw_selected = _parse_selected_services(request.data.get('selected_services'))
        normalized_selected, sel_errors = _build_selected_services(event, raw_selected)
        if sel_errors:
            return Response({'error': 'Invalid selected services', 'details': sel_errors}, status=400)

        mutable_data = request.data.copy()
        if normalized_selected:
            mutable_data['selected_services'] = normalized_selected

        serializer = SubscriptionCreateSerializer(data=mutable_data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            subscription = serializer.save()
            status_quota = request.data.get('status_quota', 'pending')
            status_cauzione = request.data.get('status_cauzione', 'pending')
            status_services = request.data.get('status_services', 'pending')
            account_id = (request.data.get('account_id')
                          or request.data.get('account')
                          or getattr(serializer, 'account', None)
                          or getattr(serializer, 'account_id', None))

            # Extract send_payment_email from the request
            auto_move = _get_bool(request.data, 'auto_move_after_payment', True)
            send_email = _get_bool(request.data, 'send_payment_email', True)
            # print(f"DEBUG: auto_move={auto_move}, send_email={send_email} for sub {subscription.pk}")
            move_info = _handle_payment_status(
                subscription=subscription,
                account_id=account_id,
                quota_status=status_quota,
                deposit_status=status_cauzione,
                services_status=status_services,
                executor=request.user,
                allow_delete=False,
                auto_move_on_payment=auto_move,
                send_email_on_payment=send_email
            )

            # Re-serialize to reflect possible list change
            data = SubscriptionSerializer(subscription).data
            if move_info:
                if move_info.get('status') == 'moved':
                    data.update({
                        'auto_move_status': 'moved',
                        'auto_move_list': move_info.get('list'),
                        'auto_move_reason': None
                    })
                elif move_info.get('status') == 'stayed':
                    data.update({
                        'auto_move_status': 'stayed',
                        'auto_move_list': None,
                        'auto_move_reason': move_info.get('reason')
                    })
            _combine_prefix_numbers(data)  # merge prefixes into numbers
            return Response(data, status=200)
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)
    except ObjectDoesNotExist as e:
        return Response({'error': str(e)}, status=400)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=403)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


# Endpoint to edit/view/delete subscription in detail
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def subscription_detail(request, pk):
    try:
        sub = Subscription.objects.get(pk=pk)

        # Check if quota, cauzione or services are reimbursed
        quota_reimbursed = Transaction.objects.filter(subscription=sub,
                                                      type=Transaction.TransactionType.RIMBORSO_QUOTA).exists()
        cauzione_reimbursed = Transaction.objects.filter(subscription=sub,
                                                         type=Transaction.TransactionType.RIMBORSO_CAUZIONE).exists()
        services_reimbursed = Transaction.objects.filter(subscription=sub,
                                 type=Transaction.TransactionType.RIMBORSO_SERVICE).exists()

        if request.method == 'GET':
            if not get_action_permissions(request, 'subscription_detail_GET'):
                return Response({'error': 'Non hai i permessi per visualizzare questa iscrizione.'}, status=403)
            serializer = SubscriptionSerializer(sub)
            data = serializer.data
            _combine_prefix_numbers(data)  # merge prefixes into numbers
            return Response(data, status=200)

        if request.method == "PATCH":
            ''' TODO:
            # if user is  organizer, allow full modification of the subscription
            if request.user.profile.id in sub.event.organizers:
                serializer = SubscriptionOfficeEditSerializer(instance=sub, data=request.data, partial=True)

            # if not, check that they have permissions
            elif request.user.has_perm('events.change_subscription'):
                serializer = SubscriptionOfficeEditSerializer(instance=sub, data=request.data, partial=True)

            # otherwise return permission denied
            else:'''
            if quota_reimbursed or cauzione_reimbursed or services_reimbursed:
                return Response({'error': 'Non è possibile modificare una iscrizione con quota, cauzione o servizi rimborsati.'},
                                status=400)
            if not get_action_permissions(request, 'subscription_detail_PATCH'):
                return Response({'error': 'Non hai i permessi per modificare questa iscrizione.'}, status=403)
            # --- Sanitize nullable statuses ---
            mutable_data = request.data.copy()
            if 'status_quota' not in mutable_data or mutable_data['status_quota'] is None:
                return Response({'error': 'status_quota is required.'}, status=400)
            if 'status_cauzione' not in mutable_data or mutable_data['status_cauzione'] is None:
                return Response({'error': 'status_cauzione is required.'}, status=400)
            if 'status_services' not in mutable_data or mutable_data['status_services'] is None:
                mutable_data['status_services'] = 'pending'

            # Normalize selected services if present
            raw_selected = _parse_selected_services(mutable_data.get('selected_services'))
            normalized_selected, sel_errors = _build_selected_services(sub.event, raw_selected)
            if sel_errors:
                return Response({'error': 'Invalid selected services', 'details': sel_errors}, status=400)
            if 'selected_services' in mutable_data:
                mutable_data['selected_services'] = normalized_selected
            serializer = SubscriptionUpdateSerializer(instance=sub, data=mutable_data, partial=True)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                updated_sub = serializer.save()
                account_id = (mutable_data.get('account_id')
                              or mutable_data.get('account')
                              or getattr(serializer, 'account_id', None))

                status_quota = mutable_data['status_quota']
                status_cauzione = mutable_data['status_cauzione']
                status_services = mutable_data.get('status_services', 'pending')

                # Ensure send_email_on_payment is properly handled
                auto_move = _get_bool(mutable_data, 'auto_move_after_payment', True)
                send_email = _get_bool(mutable_data, 'send_payment_email', True)

                move_info = _handle_payment_status(
                    subscription=updated_sub,
                    account_id=account_id,
                    quota_status=status_quota,
                    deposit_status=status_cauzione,
                    services_status=status_services,
                    executor=request.user,
                    allow_delete=True,
                    auto_move_on_payment=auto_move,
                    send_email_on_payment=send_email
                )

            # Re-serialize to reflect possible move
            resp_data = SubscriptionSerializer(updated_sub).data
            if move_info:
                if move_info.get('status') == 'moved':
                    resp_data.update({
                        'auto_move_status': 'moved',
                        'auto_move_list': move_info.get('list'),
                        'auto_move_reason': None
                    })
                elif move_info.get('status') == 'stayed':
                    resp_data.update({
                        'auto_move_status': 'stayed',
                        'auto_move_list': None,
                        'auto_move_reason': move_info.get('reason')
                    })
            _combine_prefix_numbers(resp_data)  # merge prefixes into numbers
            return Response(resp_data, status=200)

        elif request.method == "DELETE":
            if not get_action_permissions(request, 'subscription_detail_DELETE'):
                return Response({'error': 'Non hai i permessi per eliminare questa iscrizione.'}, status=403)
            if quota_reimbursed or cauzione_reimbursed or services_reimbursed:
                return Response({'error': 'Non è possibile eliminare una iscrizione con quota, cauzione o servizi rimborsati.'},
                                status=400)
            if request.user.has_perm('events.delete_subscription'):
                related_transactions = Transaction.objects.filter(
                    subscription=sub,
                    type__in=[Transaction.TransactionType.SUBSCRIPTION, Transaction.TransactionType.CAUZIONE,
                              Transaction.TransactionType.SERVICE]
                )
                for t in related_transactions:
                    t.delete()
                sub.delete()
                return Response(status=200)
            else:
                return Response({'error': 'Non hai i permessi per eliminare questa iscrizione.'}, status=403)
        else:
            return Response("Metodo non consentito", status=405)
    except Subscription.DoesNotExist:
        return Response({'error': "L'iscrizione non esiste"}, status=404)
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)
    except ObjectDoesNotExist as e:
        return Response({'error': str(e)}, status=400)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=403)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def move_subscriptions(request):
    if not get_action_permissions(request, 'move_subscriptions_POST'):
        return Response({'error': 'Non hai i permessi per spostare iscrizioni.'}, status=403)
    try:
        # Extract data from the request
        subscription_ids = request.data.get('subscriptionIds', [])
        target_list_id = request.data.get('targetListId')
        target_event_id = request.data.get('targetEventId') or request.data.get('eventId')

        if not subscription_ids or not target_list_id:
            return Response({'error': "ID iscrizioni o ID lista di destinazione mancanti"}, status=400)

        # Fetch the target list and validate its existence
        try:
            target_list = EventList.objects.get(id=target_list_id)
        except EventList.DoesNotExist:
            return Response({'error': "Lista di destinazione inesistente"}, status=400)

        # Fetch the subscriptions to be moved
        subscriptions = (Subscription.objects
                                  .select_related('profile', 'event')
                                  .filter(id__in=subscription_ids))

        if subscriptions.count() != len(subscription_ids):
            return Response({'error': "Alcune iscrizioni selezionate non esistono più"}, status=400)

        # If target_event_id is missing (older clients), infer it from subscriptions when possible
        if not target_event_id:
            distinct_event_ids = list(subscriptions.values_list('event_id', flat=True).distinct())
            if len(distinct_event_ids) == 1:
                target_event_id = distinct_event_ids[0]
            else:
                return Response({'error': "ID evento di destinazione mancante"}, status=400)

        try:
            target_event = Event.objects.get(id=target_event_id)
        except Event.DoesNotExist:
            return Response({'error': "Evento di destinazione inesistente"}, status=400)

        # Ensure the target list belongs to the target event (Many-to-Many aware)
        if not target_list.events.filter(id=target_event.id).exists():
            return Response({'error': "La lista selezionata non appartiene all'evento indicato"}, status=400)

        # Check if moving the subscriptions would exceed the target list's capacity
        current_count = Subscription.objects.filter(list=target_list, event=target_event).count()
        if target_list.capacity > 0 and current_count + len(subscription_ids) > target_list.capacity:
            return Response(
                {'error': "Numero di iscrizioni in eccesso per la capacità libera nella lista di destinazione"},
                status=400)

        # Update the list for each subscription
        with transaction.atomic():
            for subscription in subscriptions:
                # Ensure unique constraint won't be violated when switching event
                if subscription.profile_id and Subscription.objects.filter(
                        profile_id=subscription.profile_id,
                        event=target_event
                ).exclude(pk=subscription.pk).exists():
                    raise ValidationError(
                        f"{subscription.profile} è già iscritto all'evento {target_event.name}")

                if subscription.external_name and Subscription.objects.filter(
                        external_name=subscription.external_name,
                        event=target_event
                ).exclude(pk=subscription.pk).exists():
                    raise ValidationError(
                        f"{subscription.external_name} è già registrato all'evento {target_event.name}")

                subscription.list = target_list
                subscription.event = target_event
                subscription.save(update_fields=['list', 'event'])

                # Re-sync payment transactions to reflect the new event economics
                quota_tx = Transaction.objects.filter(
                    subscription=subscription,
                    type=Transaction.TransactionType.SUBSCRIPTION
                ).order_by('-id').first()
                cauzione_tx = Transaction.objects.filter(
                    subscription=subscription,
                    type=Transaction.TransactionType.CAUZIONE
                ).order_by('-id').first()

                quota_status = 'paid' if quota_tx else 'pending'
                cauzione_status = 'paid' if cauzione_tx else 'pending'
                account_id = quota_tx.account_id if quota_tx else (cauzione_tx.account_id if cauzione_tx else None)

                _handle_payment_status(
                    subscription=subscription,
                    account_id=account_id,
                    quota_status=quota_status,
                    deposit_status=cauzione_status,
                    services_status='paid' if Transaction.objects.filter(subscription=subscription,
                                                                         type=Transaction.TransactionType.SERVICE).exists() else 'pending',
                    executor=request.user,
                    allow_delete=False,
                    auto_move_on_payment=False,
                    send_email_on_payment=False
                )

        return Response({'message': "Iscrizioni spostate con successo"}, status=200)
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)
    except Exception as e:
        logger.error(f"Errore nello spostamento delle iscrizioni: {str(e)}")
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_liberatorie_pdf(request):
    def italian_date(dt):
        if not dt:
            return "N/A"
        return format_date(dt, format='d MMMM yyyy', locale='it')

    def display_na(value):
        return value if value not in [None, '', [], {}] else 'N/A'

    if not get_action_permissions(request, 'generate_liberatorie_pdf_POST'):
        return Response({'error': 'Non hai i permessi per generare liberatorie.'}, status=403)
    try:
        event_id = request.data.get('event_id')
        subscription_ids = request.data.get('subscription_ids', [])

        if not event_id or not subscription_ids:
            return Response({'error': 'Event ID and Subscription IDs are required.'}, status=400)

        event = Event.objects.get(pk=event_id)
        subscriptions = Subscription.objects.filter(id__in=subscription_ids)

        # Use a more detailed serializer to get all profile info
        profiles_data = LiberatoriaProfileSerializer([sub.profile for sub in subscriptions], many=True).data

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                rightMargin=1 * cm, leftMargin=1 * cm,
                                topMargin=1 * cm, bottomMargin=1 * cm)
        story = []
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name='Justify', alignment=0))  # 0 for Left alignment (1 for Center)

        # --- ESN Logo ---
        logo_path = 'static/esnpolimi-logo.png'
        try:
            scale = 0.2
            orig_width, orig_height = 600, 334
            width = orig_width * scale * 0.0352778  # convert px to cm (1 px ≈ 0.0352778 cm)
            height = orig_height * scale * 0.0352778

            logo = Image(logo_path, width=width * cm, height=height * cm)
            logo.hAlign = 'CENTER'
        except (OSError, IOError):
            logo = None

        # Calculate age limit date (18 years before event)
        age_limit_date = event.date - timedelta(days=18 * 365.25)

        for profile_data in profiles_data:
            if logo:
                story.append(logo)
                story.append(Spacer(1, 1 * cm))

            # Build phone with prefix if available
            phone_combined = (profile_data.get('phone') or '').strip()
            if not phone_combined:
                pn = (profile_data.get('phone_number') or profile_data.get('phone') or '').strip()
                pp = (profile_data.get('phone_prefix') or '').strip()
                if pn and pp and not pn.startswith(pp):
                    phone_combined = f"{pp} {pn}"
                else:
                    phone_combined = pn

            # --- Personal Details ---
            details = f"""
            <b>Nome/Name:</b> {display_na(profile_data.get('name'))}<br/>
            <b>Cognome/Surname:</b> {display_na(profile_data.get('surname'))}<br/>
            <b>Indirizzo/Address:</b> {display_na(profile_data.get('address'))}<br/>
            <b>ESNcard N°:</b> {display_na(profile_data.get('esncard_number'))}<br/>
            <b>ID/Passport N°:</b> {display_na(profile_data.get('document_number'))}<br/>
            <b>Data di scadenza/Expiration date:</b> {display_na(profile_data.get('document_expiry'))}<br/>
            <b>Data e Luogo di nascita/Date and Place of birth:</b> {display_na(profile_data.get('date_of_birth'))} - {display_na(profile_data.get('place_of_birth'))}<br/>
            <b>Telefono/Telephone:</b> {display_na(phone_combined)}<br/>
            <b>E-mail:</b> {display_na(profile_data.get('email'))}<br/>
            <b>Matricola/Enrollment Number:</b> {display_na(profile_data.get('matricola'))}<br/>
            <b>Codice Persona/Personal Code:</b> {display_na(profile_data.get('codice_persona'))}<br/>
            """
            story.append(Paragraph(details, styles['Normal']))
            story.append(Spacer(1, 1 * cm))

            # --- Waiver Text ---
            waiver_text_1 = f"""
            La presente dichiarazione liberatoria dovrà essere letta e firmata, in calce alla stessa, in nome e per conto proprio, oltre che in nome e per conto
            delle persone sotto elencate, nonchè dal legale responsabile qualora l'iscritto non sia maggiorenne (nato dopo il <b>{italian_date(age_limit_date)}</b>). La firma apposta
            in fondo alla presente dichiarazione comporta la piena e consapevole lettura e comprensione del contenuto e la conferma della volontà di attenersi
            alla stessa: sono a conoscenza dei rischi connessi riguardo alla mia partecipazione a questo pacchetto viaggio e alle relative attività collaterali.
            Con la sottoscrizione della presente dichiaro di voler liberare ed esonerare, come in effetti libero ed esonero, qualsiasi persona dell'organizzazione
            Erasmus Student Network Politecnico Milano, gli organizzatori dell'evento <b>"{event.name}" ({italian_date(event.date)})</b>, collettivamente
            denominati organizzatori dell'evento, da tutte le azioni, cause qualsiasi procedimento giudiziario e arbitrale tra questi compresi ma non limitati a
            quelli relativi al rischio di infortuni durante la disputa delle attività e al rischio di smarrimento di effetti personali per furto o per qualsiasi altra
            ragione. Prima dell'iscrizione a questo pacchetto viaggio sarà mia cura e onere verificare le norme e le disposizioni che mi consentono di
            partecipare al viaggio. Inoltre, con la sottoscrizione della presente, concedo agli organizzatori dell'evento la mia completa autorizzazione a tale
            viaggio con foto, servizi filmati, TV, radio, videoregistrazioni e altri strumenti di comunicazione noti o sconosciuti, indipendentemente da chi li
            abbia effettuati e a utilizzare gli stessi nel modo che verrà ritenuto più opportuno, con assoluta discrezione, per ogni forma di pubblicità,
            promozione, annuncio, progetti di scambio o a scopo commerciale senza pretendere alcun rimborso di qualsiasi natura e senza richiedere alcuna
            forma di ricompensa.
            """
            story.append(Paragraph(waiver_text_1, styles['Justify']))
            story.append(Spacer(1, 1 * cm))
            story.append(Paragraph("Firma/Signature _______________________________", styles['Normal']))
            story.append(Spacer(1, 1 * cm))

            privacy_text = """
            <b>INFORMAZIONI AI SENSI DELLA LEGGE 675/96</b><br/>
            ESN Politecnico Milano desidera informarla che la legge 675/96 prevede la tutela delle persone rispetto al trattamento dei dati
            personali. In base alla legge, il trattamento che intendiamo effettuare utilizzando i suoi dati è possibile soltanto con il suo consenso scritto e:il trattamento verrà effettuato con sistemi
            prevalentemente informatici;ai sensi della legge sulla privacy, il trattamento sarà svolto in base ai principi di correttezza, trasparenza e liceità, per consentire la tutela della riservatezza dei
            suoi dati e del relativi diritti. Il rilascio dei suoi dati non è obbligatorio se non per le finalità legate alle prenotazioni in corso e in ogni caso avrà la possibilità di esercitare i diritti
            riconosciuti dall'Art. 13 della legge in oggetto che prevedono in qualsiasi momento la verifica dell'esistenza dei suoi dati presso gli archivi cartacei ed informatici, dei criteri e degli scopi
            del trattamento dei dati, richiedendo la verifica, cancellazione, aggiornamento ed opposizione al loro utilizzo. Il titolare del trattamento dei suoi dati è ESN Politecnico Milano, Via Bonardi
            3, 20133, Milano. Acquisite le suddette informazioni, rese ai sensi dell'Art 10 della legge 675/96, acconsento al trattamento dei miei dati personali da parte di ESN Politecnico Milano.<br/><br/>
            Accettazione: SI NO<br/><br/>
            Firma/Signature______________________
            """
            story.append(Paragraph(privacy_text, styles['Justify']))
            story.append(PageBreak())

        doc.build(story)
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ESNPolimi_Liberatoria_{event.name}.pdf"'
        return response

    except Event.DoesNotExist:
        return Response({'error': "Event not found"}, status=404)
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        sentry_sdk.capture_exception(e)
        return Response({'error': 'An error occurred while generating the PDF.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def printable_liberatorie(request, event_id):
    """
    Returns all subscriptions for the event with a paid quota (status_quota == 'paid').
    Optional query param: list=<list_id> to filter by list.
    """
    if not get_action_permissions(request, 'printable_liberatorie_GET'):
        return Response({'error': 'Non hai i permessi per visualizzare le liberatorie.'}, status=403)
    try:
        event = Event.objects.get(pk=event_id)
        list_id = request.GET.get('list')

        # Find subscriptions that have a 'SUBSCRIPTION' type transaction and no 'RIMBORSO_QUOTA' transaction
        subs_with_paid_quota = Subscription.objects.filter(
            event=event,
            transaction__type=Transaction.TransactionType.SUBSCRIPTION
        ).exclude(
            transaction__type=Transaction.TransactionType.RIMBORSO_QUOTA
        ).distinct()

        if list_id:
            subs_with_paid_quota = subs_with_paid_quota.filter(list_id=list_id)

        serializer = PrintableLiberatoriaSerializer(subs_with_paid_quota, many=True)
        data = serializer.data
        _combine_prefix_numbers(data)  # merge prefixes into numbers
        return Response(data, status=200)

    except Event.DoesNotExist:
        return Response({'error': "L'evento non esiste"}, status=404)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)


# --- SumUp helpers ---
_SUMUP_TOKEN_CACHE = {"token": None, "expires_at": 0}


# NOTE (SumUp / Cloudflare debug):
# You may see in the browser devtools a POST like:
# https://api.sumup.com/cdn-cgi/challenge-platform/...  (status: (canceled) / NS_BINDING_ABORTED)
# This is a Cloudflare anti‑bot / challenge script injected by SumUp.
# The browser marks it aborted when the iframe/widget finishes or unloads early.
# It is NOT an application error and requires no backend handling.
# Safe to ignore; it does not affect payment confirmation logic (_process_sumup_checkout / webhook).
def get_sumup_access_token():
    """
    Cached SumUp access token (simple in-memory cache).
    """
    now = time.time()
    if _SUMUP_TOKEN_CACHE["token"] and _SUMUP_TOKEN_CACHE["expires_at"] > now + 30:
        return _SUMUP_TOKEN_CACHE["token"]

    r = requests.post(
        "https://api.sumup.com/token",
        data={
            "grant_type": "client_credentials",
            "client_id": settings.SUMUP_CLIENT_ID,
            "client_secret": settings.SUMUP_CLIENT_SECRET,
            "scope": "payments",
        },
        timeout=15,
    )
    r.raise_for_status()
    token_data = r.json()
    access_token = token_data["access_token"]
    expires_in = token_data.get("expires_in", 300)
    _SUMUP_TOKEN_CACHE["token"] = access_token
    _SUMUP_TOKEN_CACHE["expires_at"] = now + expires_in
    return access_token


def create_sumup_checkout(subscription, total_amount, currency="EUR"):
    """
    Create checkout (widget flow only). No return/cancel URLs, no hosted redirect.
    """

    def _sumup_destination_fields():
        """
        Prefer merchant_code if configured, else fallback to pay_to_email.
        Raises if neither is set to avoid INVALID pay_to_email or merchant_code errors.
        """
        merchant_code = settings.SUMUP_MERCHANT_CODE
        pay_to_email = settings.SUMUP_PAY_TO_EMAIL
        if merchant_code:
            return {"merchant_code": merchant_code}
        if pay_to_email:
            return {"pay_to_email": pay_to_email}
        raise RuntimeError("SumUp not configured: set SUMUP_MERCHANT_CODE or SUMUP_PAY_TO_EMAIL")

    def _sumup_headers():
        access_token = get_sumup_access_token()  # fetch dynamically
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    payload = {
        "checkout_reference": str(subscription.pk),
        "amount": float(total_amount),
        "currency": currency,
        "description": f"Subscription {subscription.event.name} #{subscription.pk}",
    }
    payload.update(_sumup_destination_fields())
    headers = _sumup_headers()
    r = requests.post("https://api.sumup.com/v0.1/checkouts", json=payload, headers=headers, timeout=15)
    if r.status_code >= 300:
        raise RuntimeError(f"SumUp error {r.status_code}: {r.text}")
    data = r.json()
    checkout_id = data.get("id") or data.get("checkout_reference")
    if not checkout_id:
        raise RuntimeError("SumUp response missing checkout id")
    return checkout_id, None  # second value retained for backward compatibility


def _ensure_sumup_transactions(subscription):
    """
    Idempotently create quota/deposit if paid remotely. Uses unified helpers.
    Also moves subscription out of non-ML/WL if payment succeeds and space exists.
    """
    try:
        event_obj = subscription.event
        cost = Decimal(event_obj.cost or 0)
        deposit = Decimal(event_obj.deposit or 0)
        services_total = _services_total(subscription.selected_services or [])
        if cost <= 0 and deposit <= 0 and services_total <= 0:
            return

        account = Account.objects.filter(name="SumUp").first()
        # Defaults: auto-move and send email enabled for remote payments
        _handle_payment_status(
            subscription=subscription,
            account_id=account.id if account else None,
            quota_status='paid' if cost > 0 else 'pending',
            deposit_status='paid' if deposit > 0 else 'pending',
            services_status='paid' if services_total > 0 else 'pending',
            executor=None,
            allow_delete=False,
            auto_move_on_payment=True,
            send_email_on_payment=True
        )

    except Exception as e:
        logger.error(f"Failed _ensure_sumup_transactions for sub {subscription.pk}: {e}")


def _process_sumup_checkout(subscription, card_token):
    """
    Lightweight, idempotent confirmation.
      - Always GET first.
      - If already PAID/FAILED/CANCELED -> act & return.
      - If still open/pending and a card_token is supplied (rare race) -> single PUT then confirm.
      - If no token and still pending -> return PENDING (webhook / later retry can finalize).
    """
    if not subscription.sumup_checkout_id:
        return 'ERROR', {'error': 'Missing checkout id'}
    checkout_id = subscription.sumup_checkout_id
    try:
        access_token = get_sumup_access_token()

        def fetch():
            r = requests.get(
                f"https://api.sumup.com/v0.1/checkouts/{checkout_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=12
            )
            if r.status_code != 200:
                print(f"[SUMUP] Fetch {checkout_id} status={r.status_code}")
                logger.debug(f"[SUMUP] Fetch {checkout_id} status={r.status_code}")
                return None, r.status_code
            return r.json(), 200

        def interpret(data):
            rs = (data.get("status") or "").upper()
            txs = data.get("transactions") or []
            success = rs == 'PAID' or any((t.get('status') or '').upper() == 'SUCCESSFUL' for t in txs)
            failed = rs in ('FAILED', 'CANCELED')
            return rs, success, failed, txs

        # First fetch
        data, code = fetch()
        if data:
            rs, success, failed, txs = interpret(data)
            if success:
                successful_tx = next((t for t in txs if (t.get("status") or "").upper() == "SUCCESSFUL"), None)
                if successful_tx and not subscription.sumup_transaction_id:
                    subscription.sumup_transaction_id = successful_tx.get("id")
                    subscription.save(update_fields=["sumup_transaction_id"])
                _ensure_sumup_transactions(subscription)
                return 'PAID', {'status': rs, 'transaction_id': subscription.sumup_transaction_id}
            if failed:
                ad = subscription.additional_data or {}
                if not ad.get('payment_failed'):
                    ad['payment_failed'] = True
                    subscription.additional_data = ad
                    subscription.save(update_fields=['additional_data'])
                return rs, {'status': rs}
            # Still open -> maybe proceed to PUT if token present
        else:
            rs = None

        if card_token:
            put_payload = {"payment_type": "card", "card": {"token": card_token}}
            r_put = requests.put(
                f"https://api.sumup.com/v0.1/checkouts/{checkout_id}",
                json=put_payload,
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                timeout=25
            )
            if r_put.status_code not in (200, 202, 409):
                return 'ERROR', {"error": f"Process response {r_put.status_code}"}
            # 409 means already processed by widget; continue

            time.sleep(0.4)  # short settle
            data2, _ = fetch()
            if data2:
                rs2, success2, failed2, txs2 = interpret(data2)
                if success2:
                    successful_tx = next((t for t in txs2 if (t.get("status") or "").upper() == "SUCCESSFUL"), None)
                    if successful_tx and not subscription.sumup_transaction_id:
                        subscription.sumup_transaction_id = successful_tx.get("id")
                        subscription.save(update_fields=["sumup_transaction_id"])
                    _ensure_sumup_transactions(subscription)
                    return 'PAID', {'status': rs2, 'transaction_id': subscription.sumup_transaction_id}
                if failed2:
                    ad = subscription.additional_data or {}
                    if not ad.get('payment_failed'):
                        ad['payment_failed'] = True
                        subscription.additional_data = ad
                        subscription.save(update_fields=['additional_data'])
                    return rs2, {'status': rs2}
                return 'PENDING', {'status': rs2}
            return 'PENDING', {'status': 'UNKNOWN_AFTER_PUT'}

        # No token supplied & still pending
        return 'PENDING', {'status': rs or 'PENDING'}

    except Exception as e:
        print(f"[SUMUP] Exception in _process_sumup_checkout: {e}")
        logger.error(f"[SUMUP] Exception in _process_sumup_checkout: {e}")
        return 'ERROR', {"error": str(e)}


# --- End SumUp helpers ---

# --- Form and Payment views ---
@api_view(['GET'])
def event_form_view(_, event_id):
    """
    Public endpoint to retrieve event form configuration for the event form page.
    (Profile columns removed: profile data no longer handled client-side.)
    """
    try:
        event = Event.objects.get(pk=event_id)
        if not event.enable_form:
            return Response({'error': 'Form not enabled for this event.'}, status=404)
        return Response({
            'id': event.id,
            'status': event.status,
            'name': event.name,
            'date': event.date,
            'cost': event.cost,
            'deposit': event.deposit,
            'services': event.services,
            'form_fields': event.form_fields,
            'is_form_open': event.is_form_open,
            'form_programmed_open_time': event.form_programmed_open_time,
            'allow_online_payment': event.allow_online_payment,
            'is_allow_external': event.is_allow_external,
            'form_note': event.form_note,
        }, status=200)
    except Event.DoesNotExist:
        return Response({'error': "Event not found"}, status=404)


@api_view(['GET'])
def event_form_status(_, event_id):
    """
    Public endpoint to check if the event is full.
    Also checks for the status of the SumUp account.
    NOW: primary gate is the Form List capacity (Form List).
    Legacy fields (main_list_full / waiting_list_full) still returned for backward compatibility.
    """
    try:
        sumup_account = Account.objects.filter(name="SumUp").first()
        event = Event.objects.get(pk=event_id)
        event_lists = EventList.objects.filter(events=event)
        main_list = event_lists.filter(is_main_list=True).first()
        waiting_list = event_lists.filter(is_waiting_list=True).first()
        form_list = event_lists.filter(name='Form List').first()

        def is_full(lst):
            if not lst:
                return True
            if lst.capacity == 0:
                return False  # unlimited
            return lst.subscriptions.count() >= lst.capacity

        main_list_full = is_full(main_list)
        waiting_list_full = is_full(waiting_list)
        form_list_full = is_full(form_list)

        message = ""
        if main_list_full and waiting_list and waiting_list_full:
            message = "Main List and Waiting List are both full."
        elif main_list_full and waiting_list:
            message = "Main List is full. You may be assigned to the Waiting List if places will be available."

        form_message = ""
        if form_list_full:
            form_message = "The Form List is full. No further online subscriptions are possible."

        return Response({
            "account_status": sumup_account.status,
            "main_list_full": main_list_full,
            "waiting_list_full": waiting_list_full,
            "message": message,
            "form_list_full": form_list_full,
            "form_list_capacity": getattr(form_list, 'capacity', None),
            "form_list_subscriptions": form_list.subscriptions.count() if form_list else 0,
            "form_message": form_message
        }, status=200)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=404)


@api_view(['POST'])
def event_form_submit(request, event_id):
    """
    Public endpoint to submit event form.
    Expects JSON:
      {
        "email": "...",
        "form_data": {...},
        "form_notes": "..."
      }
    Behavior:
      - If email matches a Profile, subscription is tied to that profile.
      - Otherwise, if externals allowed, creates an external subscription (external_name = name + surname).
      - Validates only event form fields (no profile data anymore).
    """
    try:
        event = Event.objects.get(pk=event_id)
        form_data_raw = request.data.get("form_data", {}) or {}
        # Support multipart where form_data may arrive as JSON string
        if isinstance(form_data_raw, str):
            try:
                form_data = json.loads(form_data_raw)
                if not isinstance(form_data, dict):
                    form_data = {}
            except Exception:
                form_data = {}
        else:
            form_data = form_data_raw
        form_notes = request.data.get("form_notes", "") or ""
        email = (request.data.get("email") or "").strip()
        raw_selected_services = _parse_selected_services(request.data.get("selected_services"))

        if not email:
            return Response({"error": "Missing email"}, status=400)
        try:
            validate_email(email)
        except Exception:
            return Response({"error": "Invalid email format"}, status=400)

        profile = None
        external_name = None
        external_first_name = None
        external_last_name = None
        external_has_esncard = None
        external_esncard_number = None
        external_whatsapp_number = None
        
        try:
            profile = Profile.objects.get(email=email)
        except Profile.DoesNotExist:
            if event.is_allow_external:
                # Collect external user data
                external_first_name = request.data.get('external_first_name', '').strip()
                external_last_name = request.data.get('external_last_name', '').strip()
                external_has_esncard = _get_bool(request.data, 'external_has_esncard', False)
                external_esncard_number = request.data.get('external_esncard_number', '').strip() if external_has_esncard else None
                external_whatsapp_number = request.data.get('external_whatsapp_number', '').strip()
                
                if not external_first_name or not external_last_name:
                    return Response({"error": "Nome e cognome sono obbligatori per utenti esterni"}, status=400)
                
                external_name = f"{external_first_name} {external_last_name}"
            else:
                return Response({"error": "Profile not found"}, status=404)

        # Duplicate checks
        if profile and Subscription.objects.filter(profile=profile, event=event).exists():
            return Response({"error": "Already subscribed to this event"}, status=400)
        if external_name and Subscription.objects.filter(external_name=external_name, event=event).exists():
            return Response({"error": "Already subscribed to this event as external"}, status=400)

        # --- Handle file uploads for 'l' type fields BEFORE validation ---
        link_fields = [f['name'] for f in event.form_fields if f.get('type') == 'l']
        for fname in link_fields:
            uploaded = request.FILES.get(fname)
            if uploaded:
                _validate_form_upload(uploaded)
                try:
                    link = _upload_form_file_to_drive(uploaded, event.id, fname, event.name, event.date)
                except Exception as up_err:
                    logger.error(f"Upload failed for field {fname}: {up_err}")
                    return Response({"error": f"Upload failed for field {fname}"}, status=500)
                form_data[fname] = link

        # Validate only form field data (now includes generated links)
        errors = validate_field_data(event.fields, form_data, 'form')
        if errors:
            return Response({"error": "Validation error", "fields": errors}, status=400)

        # Validate selected services
        normalized_selected, sel_errors = _build_selected_services(event, raw_selected_services)
        if sel_errors:
            return Response({"error": "Invalid selected services", "details": sel_errors}, status=400)

        # Determine form list (always use form list; capacity not enforced here)
        form_list = event.lists.filter(name='Form List').first()
        if not form_list:
            return Response({"error": "Form list not configured for this event"}, status=400)

        sub = Subscription.objects.create(
            profile=profile,
            external_name=external_name,
            event=event,
            list=form_list,  # assigned_list
            form_data=form_data,
            form_notes=form_notes,
            additional_data={'form_email': email},
            selected_services=normalized_selected,
            created_by_form=True,
            external_first_name=external_first_name,
            external_last_name=external_last_name,
            external_has_esncard=external_has_esncard,
            external_esncard_number=external_esncard_number,
            external_whatsapp_number=external_whatsapp_number
        )

        # --- SumUp integration (widget-only) ---
        payment_error = None
        total_cost = (event.cost or Decimal('0')) + (event.deposit or Decimal('0')) + _services_total(normalized_selected)

        if event.allow_online_payment and total_cost > 0:
            try:
                checkout_id, _ = create_sumup_checkout(sub, total_cost, currency="EUR")
                sub.sumup_checkout_id = checkout_id
                sub.save(update_fields=['sumup_checkout_id'])
            except Exception as e:
                payment_error = "online_payment_unavailable"
                print(f"[ERROR] Failed SumUp checkout for subscription {sub.pk}: {e}")
                logger.error(f"Failed SumUp checkout for subscription {sub.pk}: {e}")

        online_payment_required = bool(event.allow_online_payment and total_cost > 0 and not payment_error)
        payment_required = online_payment_required or total_cost > 0

        assigned_label = ''

        # Determine available list for only online payments (main, else waiting)
        if online_payment_required:
            event_lists = EventList.objects.filter(events=event)
            main_list = event_lists.filter(is_main_list=True).first()
            waiting_list = event_lists.filter(is_waiting_list=True).first()

            def has_space(lst):
                if not lst:
                    return False
                if lst.capacity == 0:
                    return True
                return lst.subscription_count < lst.capacity

            if has_space(main_list):
                assigned_label = "Main List"
            elif has_space(waiting_list):
                assigned_label = "Waiting List"
            else:
                return Response({"error": "No available spot for subscription. All lists are full."}, status=400)

        _send_form_subscription_email(sub, assigned_label, online_payment_required, payment_required)

        return Response({
            "success": True,
            "subscription_id": sub.pk,
            "assigned_list": assigned_label,
            "payment_required": bool(event.allow_online_payment and total_cost > 0 and not payment_error),
            "checkout_id": sub.sumup_checkout_id,
            "payment_error": payment_error
        }, status=200)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=404)
    except Exception as e:
        print(f"[ERROR] Event form submit error: {str(e)}")
        logging.error(str(e))
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def subscription_payment_status(_, pk):
    """
    Simplified: derive status from local transactions / flags only (no remote sync each call).
    """
    try:
        sub = Subscription.objects.select_related('event').get(pk=pk)
    except Subscription.DoesNotExist:
        return Response({"error": "Subscription not found"}, status=404)

    from treasury.models import Transaction as T
    cost_needed = bool(sub.event.cost and Decimal(sub.event.cost) > 0)
    dep_needed = bool(sub.event.deposit and Decimal(sub.event.deposit) > 0)
    services_needed = _services_total(sub.selected_services or []) > 0

    quota_paid = cost_needed and T.objects.filter(subscription=sub, type=T.TransactionType.SUBSCRIPTION).exists()
    dep_paid = dep_needed and T.objects.filter(subscription=sub, type=T.TransactionType.CAUZIONE).exists()
    services_paid = services_needed and T.objects.filter(subscription=sub, type=T.TransactionType.SERVICE).exists()

    quota_status = 'paid' if quota_paid else ('pending' if cost_needed else 'n/a')
    deposit_status = 'paid' if dep_paid else ('pending' if dep_needed else 'n/a')
    services_status = 'paid' if services_paid else ('pending' if services_needed else 'n/a')

    if sub.additional_data.get('payment_failed'):
        overall = 'failed'
    elif not cost_needed and not dep_needed and not services_needed:
        overall = 'none'
    elif (not cost_needed or quota_paid) and (not dep_needed or dep_paid) and (not services_needed or services_paid):
        overall = 'paid'
    elif sub.sumup_checkout_id:
        overall = 'pending'
    else:
        overall = 'none'

    return Response({
        "subscription_id": sub.pk,
        "overall_status": overall,
        "quota_status": quota_status,
        "deposit_status": deposit_status,
        "services_status": services_status,
        "sumup_checkout_id": sub.sumup_checkout_id,
        "sumup_transaction_id": sub.sumup_transaction_id,
    }, status=200)


@api_view(['POST'])
def subscription_process_payment(request, pk):
    """
    Finalize/confirm SumUp payment.
    Token is OPTIONAL (widget usually already charged). If omitted we just confirm & create transactions.
    """
    try:
        sub = Subscription.objects.select_related('event').get(pk=pk)
    except Subscription.DoesNotExist:
        return Response({"error": "Subscription not found"}, status=404)

    payload = request.data or {}
    widget_payload = payload.get('widget_payload') or {}

    candidates = [
        payload.get('token'),
        widget_payload.get('token'),
        widget_payload.get('id'),
        widget_payload.get('payment_token'),
    ]
    pi = widget_payload.get('paymentInstrument') or widget_payload.get('payment_instrument')
    if isinstance(pi, dict):
        candidates.append(pi.get('token') or pi.get('id'))
    card_obj = widget_payload.get('card')
    if isinstance(card_obj, dict):
        candidates.append(card_obj.get('token') or card_obj.get('id'))
    token = next((c for c in candidates if isinstance(c, str) and c.strip()), None)

    # Proceed even if token is None
    status_flag, remote = _process_sumup_checkout(sub, token)

    if status_flag == 'PAID':
        _ensure_sumup_transactions(sub)

    return Response(
        {"status": status_flag, **remote},
        status=200 if status_flag not in ['ERROR'] else 500
    )


@api_view(["POST"])
def sumup_webhook(request):
    """
    Public webhook endpoint called by SumUp.
    Expected JSON may include: { "id": "...", "event_type": "...", "checkout_id": "...", ... }
    We fetch the checkout status once to confirm payment and then create local transactions.
    Always return 200 to acknowledge.
    """
    data = request.data or {}
    checkout_id = data.get("checkout_id") or data.get("id") or data.get("checkout")
    if not checkout_id:
        return Response({"status": "ignored", "reason": "missing_checkout_id"}, status=200)

    sub = Subscription.objects.filter(sumup_checkout_id=checkout_id).first()
    if not sub:
        return Response({"status": "ignored", "reason": "unknown_subscription"}, status=200)

    # If already has payment transactions assume processed
    already_paid = Transaction.objects.filter(
        subscription=sub,
        type__in=[
            Transaction.TransactionType.SUBSCRIPTION,
            Transaction.TransactionType.CAUZIONE,
            Transaction.TransactionType.SERVICE
        ]
    ).exists()

    try:
        access_token = get_sumup_access_token()
        r = requests.get(
            f"https://api.sumup.com/v0.1/checkouts/{checkout_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=12
        )
        if r.status_code != 200:
            logger.warning(f"Webhook fetch failed {r.status_code} for checkout {checkout_id}")
            return Response({"status": "pending", "reason": "fetch_failed"}, status=200)
        payload = r.json()
        remote_status = (payload.get("status") or "").upper()
        txs = payload.get("transactions") or []
        success = remote_status == "PAID" or any((t.get("status") or "").upper() == "SUCCESSFUL" for t in txs)
        failed = remote_status in ("FAILED", "CANCELED")

        if success and not already_paid:
            # capture transaction id (first successful)
            successful_tx = next((t for t in txs if (t.get("status") or "").upper() == "SUCCESSFUL"), None)
            if successful_tx and not sub.sumup_transaction_id:
                sub.sumup_transaction_id = successful_tx.get("id")
                sub.save(update_fields=["sumup_transaction_id"])
            _ensure_sumup_transactions(sub)
            return Response({"status": "paid"}, status=200)
        if failed:
            ad = sub.additional_data or {}
            if not ad.get("payment_failed"):
                ad["payment_failed"] = True
                sub.additional_data = ad
                sub.save(update_fields=["additional_data"])
            return Response({"status": "failed", "remote_status": remote_status}, status=200)
        return Response({"status": "pending", "remote_status": remote_status}, status=200)
    except Exception as e:
        logger.error(f"Webhook exception for checkout {checkout_id}: {e}")
        return Response({"status": "error", "detail": str(e)}, status=200)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def subscription_edit_formfields(request, pk):
    """
    Edit form fields or additional data of a subscription.
    Expects JSON:
      {
        "form_data": {...},          # optional, partial update of form fields
        "additional_data": {...}     # optional, partial update of additional data
      }
    """
    if not get_action_permissions(request, 'subscription_detail_PATCH'):
        return Response({'error': 'Non hai i permessi per modificare questa iscrizione.'}, status=403)
    try:
        sub = Subscription.objects.select_related('event').get(pk=pk)
    except Subscription.DoesNotExist:
        return Response({"error": "Subscription not found"}, status=404)

    payload = request.data or {}
    # Accept JSON strings (from multipart or mis-sent payloads)
    raw_form = payload.get("form_data", {}) or {}
    raw_add = payload.get("additional_data", {}) or {}

    if isinstance(raw_form, str):
        try:
            raw_form = json.loads(raw_form) or {}
        except Exception:
            raw_form = {}
    if isinstance(raw_add, str):
        try:
            raw_add = json.loads(raw_add) or {}
        except Exception:
            raw_add = {}

    if not isinstance(raw_form, dict) and not isinstance(raw_add, dict):
        return Response({"error": "No valid data to update"}, status=400)

    event = sub.event
    existing_form = sub.form_data or {}
    existing_add = sub.additional_data or {}

    # Index fields by name per field_type
    fields = event.fields or []
    form_fields = {f.get('name'): f for f in fields if f.get('field_type') == 'form'}
    add_fields = {f.get('name'): f for f in fields if f.get('field_type') == 'additional'}

    def coerce_value(ftype, v):
        if ftype == 'b':
            if isinstance(v, bool):
                return v
            if isinstance(v, str):
                s = v.strip().lower()
                if s in ('true', '1', 'yes', 'y', 'on'):
                    return True
                if s in ('false', '0', 'no', 'n', 'off', ''):
                    return False
            return bool(v)
        if ftype == 'm':
            return v if isinstance(v, list) else ([] if v in (None, '', False) else [v])
        # keep numbers/strings as-is; validator will enforce
        return v if v is not None else ''

    # Build merged dicts with minimal coercion on changed keys
    merged_form = dict(existing_form)
    for k, v in (raw_form.items() if isinstance(raw_form, dict) else []):
        fdef = form_fields.get(k) or {}
        merged_form[k] = coerce_value(fdef.get('type'), v)

    merged_add = dict(existing_add)
    for k, v in (raw_add.items() if isinstance(raw_add, dict) else []):
        fdef = add_fields.get(k) or {}
        merged_add[k] = coerce_value(fdef.get('type'), v)

    # Validate only event-declared fields (exclude backend-only flags from validation)
    validatable_form = {k: merged_form[k] for k in merged_form.keys() if k in form_fields}
    validatable_add = {k: merged_add[k] for k in merged_add.keys() if k in add_fields}

    form_errors = validate_field_data(fields, validatable_form, 'form') or {}
    add_errors = validate_field_data(fields, validatable_add, 'additional') or {}

    if form_errors or add_errors:
        combined = []
        def push(err):
            if not err:
                return
            if isinstance(err, list):
                combined.extend(err)
            elif isinstance(err, dict):
                for v in err.values():
                    if isinstance(v, list):
                        combined.extend(v)
                    else:
                        combined.append(str(v))
            else:
                combined.append(str(err))
        push(form_errors)
        push(add_errors)
        return Response({"error": "Validation error", "fields": combined}, status=400)

    # Persist only the parts that were provided (keep backend-only keys intact)
    to_update = []
    if isinstance(raw_form, dict) and raw_form:
        sub.form_data = merged_form
        to_update.append('form_data')
    if isinstance(raw_add, dict) and raw_add:
        sub.additional_data = merged_add
        to_update.append('additional_data')

    if not to_update:
        return Response({"error": "No changes provided"}, status=400)

    sub.save(update_fields=to_update)

    return Response({
        "form_data": sub.form_data if 'form_data' in to_update else existing_form,
        "additional_data": sub.additional_data if 'additional_data' in to_update else existing_add
    }, status=200)


# ============================================================================
# Many-to-Many Shared Lists Endpoints
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def link_event_to_lists(request):
    """
    Link an event to all lists from another event (Many-to-Many).

    POST /api/events/link-lists/

    Body:
    {
        "source_event_id": 5,  # Event to copy lists from
        "target_event_id": 8   # Event to add lists to
    }

    Returns:
    {
        "message": "Successfully linked 3 lists from Event A to Event B",
        "linked_lists": [
            {"id": 18, "name": "Main List", "capacity": 100},
            {"id": 19, "name": "Waiting List", "capacity": 20}
        ]
    }
    """
    if not get_action_permissions(request, 'link_event_to_lists_POST'):
        return Response({'error': 'Non hai i permessi per linkare liste agli eventi.'}, status=403)
    
    source_id = request.data.get('source_event_id')
    target_id = request.data.get('target_event_id')

    if not source_id or not target_id:
        return Response({
            'error': 'Both source_event_id and target_event_id are required'
        }, status=400)

    try:
        source_event = Event.objects.get(id=source_id)
        target_event = Event.objects.get(id=target_id)
    except Event.DoesNotExist:
        return Response({
            'error': 'One or both events not found'
        }, status=404)

    # Get all lists from source event
    source_lists = source_event.lists.all()

    if not source_lists.exists():
        return Response({
            'error': f'Source event "{source_event.name}" has no lists to share'
        }, status=400)

    # Link all source lists to target event
    linked_lists = []
    for event_list in source_lists:
        # Add target event to the list's events (Many-to-Many)
        event_list.events.add(target_event)
        linked_lists.append({
            'id': event_list.id,
            'name': event_list.name,
            'capacity': event_list.capacity,
            'available_capacity': event_list.available_capacity
        })

    return Response({
        'message': f'Successfully linked {len(linked_lists)} lists from "{source_event.name}" to "{target_event.name}"',
        'linked_lists': linked_lists
    }, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_events_for_sharing(request):
    """
    Get list of events that have lists available for sharing.

    GET /api/events/available-for-sharing/

    Returns:
    [
        {
            "id": 5,
            "name": "Event A",
            "lists_count": 3,
            "lists": [
                {"id": 18, "name": "Main List", "capacity": 100}
            ]
        }
    ]
    """
    if not get_action_permissions(request, 'available_events_for_sharing_GET'):
        return Response({'error': 'Non hai i permessi per visualizzare gli eventi disponibili per la condivisione.'}, status=403)
    
    # Get all events that have at least one list
    events_with_lists = Event.objects.prefetch_related('lists').annotate(
        lists_count=Count('lists')
    ).filter(lists_count__gt=0).order_by('-date')

    result = []
    for event in events_with_lists:
        lists_data = []
        for event_list in event.lists.all():
            lists_data.append({
                'id': event_list.id,
                'name': event_list.name,
                'capacity': event_list.capacity,
                'subscription_count': event_list.subscription_count,
                'available_capacity': event_list.available_capacity,
                'is_main_list': event_list.is_main_list,
                'is_waiting_list': event_list.is_waiting_list
            })

        result.append({
            'id': event.id,
            'name': event.name,
            'date': event.date,
            'lists_count': len(lists_data),
            'lists': lists_data
        })

    return Response(result, status=200)
