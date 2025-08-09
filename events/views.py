import logging
from datetime import timedelta
from decimal import Decimal
from io import BytesIO

import sentry_sdk
from babel.dates import format_date
from django.core.exceptions import ValidationError, PermissionDenied, ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
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

from events.models import Event, Subscription, EventList
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from events.models import Event, Subscription
from events.serializers import (
    EventsListSerializer, EventCreationSerializer,
    SubscriptionCreateSerializer, SubscriptionUpdateSerializer,
    EventWithSubscriptionsSerializer, SubscriptionSerializer, PrintableLiberatoriaSerializer, LiberatoriaProfileSerializer
)
from treasury.models import Transaction

logger = logging.getLogger(__name__)


def get_action_permissions(request, action, default_perm=None):
    """
    Returns True if the user has the required permission for the action.
    You can customize this mapping per view/action.
    """
    # Example: define permissions per action
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
    }
    perm = perms_map.get(action, default_perm)

    # Special case: allow Board group for liberatorie actions
    if action in ['generate_liberatorie_pdf_POST', 'printable_liberatorie_GET']:
        if request.user.groups.filter(name='Board').exists():
            return True

    if perm:
        return request.user.has_perm(perm)
    return True  # If no specific permission, allow


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def events_list(request):
    if not get_action_permissions(request, 'events_list_GET'):
        return Response({'error': 'Non hai i permessi per visualizzare gli eventi.'}, status=403)
    try:
        events = Event.objects.all().order_by('-created_at')
        search = request.GET.get('search', '').strip()
        if search:
            events = events.filter(Q(name__icontains=search))

        status_param = request.GET.get('status', '').strip()
        if status_param:
            status_list = [s.strip() for s in status_param.split(',') if s.strip()]
            if status_list:
                events = [e for e in events if e.status in status_list]

        date_from = request.GET.get('dateFrom')
        if date_from:
            events = events.filter(date__gte=date_from)
        date_to = request.GET.get('dateTo')
        if date_to:
            events = events.filter(date__lte=parse_datetime(date_to) + timedelta(days=1))
        # --- End new filters ---
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

        if request.method == 'GET':
            if not get_action_permissions(request, 'event_detail_GET'):
                return Response({'error': 'Non hai i permessi per visualizzare questo evento.'}, status=403)
            serializer = EventWithSubscriptionsSerializer(event)
            return Response(serializer.data, status=200)

        elif request.method == 'PATCH':
            if not get_action_permissions(request, 'event_detail_PATCH'):
                return Response({'error': 'Non hai i permessi per modificare questo evento.'}, status=403)
            # Check for existing subscriptions
            has_subscriptions = Subscription.objects.filter(event=event).exists()
            data_to_validate = request.data
            logger.info("Event data: ", data_to_validate)
            start_date = parse_datetime(data_to_validate.get('subscription_start_date'))
            end_date = parse_datetime(data_to_validate.get('subscription_end_date'))

            # If event has subscriptions, implement stricter validation
            if has_subscriptions:
                # Not possible to modify start date
                formatted_start = start_date.strftime('%Y-%m-%d %H:%M:%S')
                existing_date = event.subscription_start_date.strftime('%Y-%m-%d %H:%M:%S')
                logger.info(f"Start date: {start_date}, existing: {event.subscription_start_date}")
                logger.info(f"Start date: {formatted_start}, existing: {existing_date}")
                if formatted_start != existing_date:
                    return Response({'error': "Non è possibile modificare le date d'iscrizione se l'evento ha delle iscrizioni"}, status=400)

                # Not possible to change cost
                if data_to_validate.get('cost') != str(event.cost):
                    return Response({'error': "Non è possibile modificare il costo se l'evento ha delle iscrizioni"}, status=400)

                # Not possible to reduce capacity below current subscription count
                for list_data in data_to_validate['lists']:
                    list_id = list_data.get('id')
                    new_capacity = int(list_data.get('capacity', 0))

                    # Skip validation for new lists
                    if not list_id:
                        continue

                    subscription_count = Subscription.objects.filter(event=event, list_id=list_id).count()
                    if subscription_count > new_capacity > 0:
                        return Response({'error': f"Non è possibile impostare una capacità lista minore del numero di iscrizoni presenti ({subscription_count})"}, status=400)

            # Not possible to set end date before now or before start date
            now = timezone.now()  # This is timezone-aware
            current_start = start_date if start_date else event.subscription_start_date
            if end_date < now:
                return Response({'error': "Non è possibile impostare una data fine iscrizioni nel passato"}, status=400)
            if current_start and end_date <= current_start:
                return Response({'error': "Non è possibile impostare una data fine iscrizioni minore di quella di inizio iscrizioni"}, status=400)

            # Continue with serializer validation and saving
            serializer = EventCreationSerializer(instance=event, data=data_to_validate, partial=True)

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
                return Response({'error': "Devi inserire un nominativo esterno se non selezioni un profilo."}, status=400)
            else:
                return Response({'error': "Seleziona un profilo per l'iscrizione."}, status=400)

        serializer = SubscriptionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        with transaction.atomic():
            subscription_data = {key: value for key, value in serializer.validated_data.items()}
            subscription = Subscription(**subscription_data)
            subscription.clean()
            subscription = serializer.save()

            # Only create transactions if status_quota/cauzione are 'paid'
            status_quota = request.data.get('status_quota', 'pending')
            status_cauzione = request.data.get('status_cauzione', 'pending')
            account_id = serializer.account

            # Prepare name for description (profile or external)
            if subscription.profile:
                sub_name = f"{subscription.profile.name} {subscription.profile.surname}"
            elif subscription.external_name:
                sub_name = subscription.external_name
            else:
                sub_name = "Esterno"

            # Quota transaction
            if status_quota == 'paid' and account_id:
                t = Transaction(
                    type=Transaction.TransactionType.SUBSCRIPTION,
                    account_id=account_id,
                    subscription=subscription,
                    executor=request.user,
                    amount=Decimal(subscription.event.cost),
                    description=f"Quota {sub_name} - {subscription.event.name}" + (f" - {subscription.notes}" if subscription.notes else "")
                )
                t.save()

            # Cauzione transaction
            if status_cauzione == 'paid' and account_id and subscription.event.deposit and Decimal(subscription.event.deposit) > 0:
                t_cauzione = Transaction(
                    type=Transaction.TransactionType.CAUZIONE,
                    account_id=account_id,
                    subscription=subscription,
                    executor=request.user,
                    amount=Decimal(subscription.event.deposit),
                    description=f"Cauzione {sub_name} - {subscription.event.name}" + (f" - {subscription.notes}" if subscription.notes else "")
                )
                t_cauzione.save()
            return Response(serializer.data, status=200)
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

        # Check if quota or cauzione is reimbursed
        quota_reimbursed = Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.RIMBORSO_QUOTA).exists()
        cauzione_reimbursed = Transaction.objects.filter(subscription=sub, type=Transaction.TransactionType.RIMBORSO_CAUZIONE).exists()

        if request.method == 'GET':
            if not get_action_permissions(request, 'subscription_detail_GET'):
                return Response({'error': 'Non hai i permessi per visualizzare questa iscrizione.'}, status=403)
            serializer = SubscriptionSerializer(sub)
            return Response(serializer.data, status=200)

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
            if not get_action_permissions(request, 'subscription_detail_PATCH'):
                return Response({'error': 'Non hai i permessi per modificare questa iscrizione.'}, status=403)
            if quota_reimbursed or cauzione_reimbursed:
                return Response({'error': 'Non è possibile modificare una iscrizione con quota o cauzione rimborsata.'}, status=400)
            if request.user.has_perm('events.change_subscription'):
                serializer = SubscriptionUpdateSerializer(instance=sub, data=request.data, partial=True)
                if not serializer.is_valid():
                    return Response(serializer.errors, status=400)

                with transaction.atomic():
                    for attr, value in serializer.validated_data.items():
                        setattr(sub, attr, value)
                    sub.clean()
                    subscription = serializer.save()

                    account_id = serializer.account_id
                    status_quota = request.data.get('status_quota', 'pending')
                    status_cauzione = request.data.get('status_cauzione', 'pending')

                    # Quota transaction
                    quota_tx = Transaction.objects.filter(subscription=subscription, type=Transaction.TransactionType.SUBSCRIPTION).first()
                    cauzione_tx = Transaction.objects.filter(subscription=subscription, type=Transaction.TransactionType.CAUZIONE).first()

                    # --- QUOTA ---
                    if status_quota == 'paid' and account_id:
                        if not quota_tx:
                            # Create transaction if not exists
                            t = Transaction(
                                type=Transaction.TransactionType.SUBSCRIPTION,
                                account_id=account_id,
                                subscription=subscription,
                                executor=request.user,
                                amount=Decimal(subscription.event.cost),
                                description=f"Pagamento per {subscription.event.name}"
                            )
                            t.save()
                        elif quota_tx.account_id != account_id:
                            # Move transaction to new account
                            quota_amount = Decimal(subscription.event.cost)
                            quota_tx.delete()
                            t = Transaction(
                                type=Transaction.TransactionType.SUBSCRIPTION,
                                account_id=account_id,
                                subscription=subscription,
                                executor=request.user,
                                amount=quota_amount,
                                description=f"Pagamento per {subscription.event.name} (spostato da altra cassa)"
                            )
                            t.save()
                    elif status_quota != 'paid' and quota_tx:
                        quota_tx.delete()

                    # --- CAUZIONE ---
                    if status_cauzione == 'paid' and account_id and subscription.event.deposit and Decimal(subscription.event.deposit) > 0:
                        if not cauzione_tx:
                            t_cauzione = Transaction(
                                type=Transaction.TransactionType.CAUZIONE,
                                account_id=account_id,
                                subscription=subscription,
                                executor=request.user,
                                amount=Decimal(subscription.event.deposit),
                                description=f"Cauzione per {subscription.event.name}"
                            )
                            t_cauzione.save()
                        elif cauzione_tx.account_id != account_id:
                            # Move transaction to new account
                            cauzione_amount = Decimal(subscription.event.deposit)
                            cauzione_tx.delete()
                            t_cauzione = Transaction(
                                type=Transaction.TransactionType.CAUZIONE,
                                account_id=account_id,
                                subscription=subscription,
                                executor=request.user,
                                amount=cauzione_amount,
                                description=f"Cauzione per {subscription.event.name} (spostata da altra cassa)"
                            )
                            t_cauzione.save()
                    elif status_cauzione != 'paid' and cauzione_tx:
                        cauzione_tx.delete()

                return Response(serializer.data, status=200)
            else:
                return Response({'error': 'Non hai i permessi per modificare questa iscrizione.'}, status=403)

        elif request.method == "DELETE":
            if not get_action_permissions(request, 'subscription_detail_DELETE'):
                return Response({'error': 'Non hai i permessi per eliminare questa iscrizione.'}, status=403)
            if quota_reimbursed or cauzione_reimbursed:
                return Response({'error': 'Non è possibile eliminare una iscrizione con quota o cauzione rimborsata.'}, status=400)
            if request.user.has_perm('events.delete_subscription'):
                related_transactions = Transaction.objects.filter(
                    subscription=sub,
                    type__in=[Transaction.TransactionType.SUBSCRIPTION, Transaction.TransactionType.CAUZIONE]
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

        if not subscription_ids or not target_list_id:
            return Response({'error': "ID iscrizioni o ID lista di destinazione mancanti"}, status=400)

        # Fetch the target list and validate its existence
        try:
            target_list = EventList.objects.get(id=target_list_id)
        except EventList.DoesNotExist:
            return Response({'error': "Lista di destinazione inesistente"}, status=400)

        # Check if moving the subscriptions would exceed the target list's capacity
        current_count = Subscription.objects.filter(list=target_list).count()
        if target_list.capacity > 0 and current_count + len(subscription_ids) > target_list.capacity:
            return Response({'error': "Numero di iscrizioni in eccesso per la capacità libera nella lista di destinazione"}, status=400)

        # Fetch the subscriptions to be moved
        subscriptions = Subscription.objects.filter(id__in=subscription_ids)

        # Update the list for each subscription
        with transaction.atomic():
            for subscription in subscriptions:
                subscription.list = target_list
                subscription.save()

        return Response({'message': "Iscrizioni spostate con successo"}, status=200)
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

            # --- Personal Details ---
            details = f"""
            <b>Nome/Name:</b> {display_na(profile_data.get('name'))}<br/>
            <b>Cognome/Surname:</b> {display_na(profile_data.get('surname'))}<br/>
            <b>Indirizzo/Address:</b> {display_na(profile_data.get('address'))}<br/>
            <b>ESNcard N°:</b> {display_na(profile_data.get('esncard_number'))}<br/>
            <b>ID/Passport N°:</b> {display_na(profile_data.get('document_number'))}<br/>
            <b>Data di scadenza/Expiration date:</b> {display_na(profile_data.get('document_expiry'))}<br/>
            <b>Data e Luogo di nascita/Date and Place of birth:</b> {display_na(profile_data.get('date_of_birth'))} - {display_na(profile_data.get('place_of_birth'))}<br/>
            <b>Telefono/Telephone:</b> {display_na(profile_data.get('phone'))}<br/>
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
        return Response(serializer.data, status=200)

    except Event.DoesNotExist:
        return Response({'error': "L'evento non esiste"}, status=404)
    except Exception as e:
        logger.error(str(e))
        sentry_sdk.capture_exception(e)
        return Response({'error': 'Errore interno del server.'}, status=500)
