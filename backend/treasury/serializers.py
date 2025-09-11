import os

from django.conf import settings
from django.contrib.auth.models import Group
from django.db import transaction
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from rest_framework import serializers

from profiles.models import Profile
from treasury.models import ESNcard, Transaction, Account, ReimbursementRequest


# --- Shared Drive upload helper for receipts (transactions + reimbursements) ---
def upload_receipt_to_drive(receipt_file, user, instance_time, prefix):
    if not receipt_file:
        return None
    GOOGLE_DRIVE_FOLDER_ID = settings.GOOGLE_DRIVE_FOLDER_ID
    SERVICE_ACCOUNT_FILE = settings.GOOGLE_SERVICE_ACCOUNT_FILE
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=['https://www.googleapis.com/auth/drive']
    )
    service = build('drive', 'v3', credentials=credentials)
    receipt_file.seek(0)
    mimetype = getattr(receipt_file, 'content_type', 'application/octet-stream')
    media = MediaIoBaseUpload(receipt_file, mimetype=mimetype)
    ext = os.path.splitext(receipt_file.name)[1].lower()
    filename = f"{prefix}_{user.profile.name}_{user.profile.surname}_{instance_time.strftime('%Y%m%d_%H%M%S')}{ext}"
    metadata = {'name': filename, 'parents': [GOOGLE_DRIVE_FOLDER_ID]}
    uploaded = service.files().create(
        body=metadata,
        media_body=media,
        fields='id',
        supportsAllDrives=True
    ).execute()
    service.permissions().create(
        fileId=uploaded['id'],
        body={'role': 'reader', 'type': 'anyone'},
        supportsAllDrives=True
    ).execute()
    return f"https://drive.google.com/file/d/{uploaded['id']}/view?usp=sharing"


# Centralized allowed mimetypes / extensions for receipt uploads
ALLOWED_RECEIPT_MIMETYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/bmp',
    'image/webp',
    'image/tiff',
    'image/heic',
    'image/heif'
]
ALLOWED_RECEIPT_EXTENSIONS = [
    '.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif', '.heic', '.heif'
]

def validate_receipt_file(file):
    if not file:
        return file
    # Mimetype check (if provided by the backend/form)
    if hasattr(file, 'content_type') and file.content_type not in ALLOWED_RECEIPT_MIMETYPES:
        raise serializers.ValidationError("Il file deve essere un'immagine o un PDF.")
    # Extension check
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ALLOWED_RECEIPT_EXTENSIONS:
        raise serializers.ValidationError("Il file deve essere un'immagine o un PDF.")
    return file


# Serializer for ESNcard emission/renewal
class ESNcardEmissionSerializer(serializers.ModelSerializer):
    profile_id = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.all(),
        source='profile'
    )
    esncard_number = serializers.CharField(source='number')
    account_id = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.all(),
        write_only=True  # This field won't be used for model creation
    )
    amount = serializers.DecimalField(
        max_digits=9,
        decimal_places=2,
        write_only=True,
        required=False
    )

    class Meta:
        model = ESNcard
        fields = ['profile_id', 'esncard_number', 'account_id', 'amount']

    def create(self, validated_data):
        # Remove fields that don't belong to ESNcard model
        validated_data.pop('account_id', None)
        validated_data.pop('amount', None)
        return ESNcard.objects.create(**validated_data)


# Serializer to view ESNcard
class ESNcardSerializer(serializers.ModelSerializer):
    expiration = serializers.DateField(format="%Y-%m-%d", read_only=True)  # Format date as string
    is_valid = serializers.ReadOnlyField()

    class Meta:
        model = ESNcard
        fields = ['id', 'number', 'expiration', 'is_valid', 'created_at']
        read_only_fields = ['id', 'expiration', 'is_valid', 'created_at']

    @staticmethod
    def validate_number(value):
        if len(value) < 8 or len(value) > 14:
            raise serializers.ValidationError("Il numero ESNcard deve essere compreso tra 8 e 14 caratteri.")
        return value


# Serializer to create transactions
class TransactionCreateSerializer(serializers.ModelSerializer):
    receiptFile = serializers.FileField(write_only=True, required=False, allow_null=True, allow_empty_file=True)
    receipt_link = serializers.URLField(read_only=True)

    class Meta:
        model = Transaction
        fields = ['subscription', 'account', 'executor', 'amount', 'description', 'type',
                  'event_reference_manual', 'receiptFile', 'receipt_link']

    @staticmethod
    def validate_receiptFile(file):
        return validate_receipt_file(file)

    def create(self, validated_data):
        receipt_file = validated_data.pop('receiptFile', None)
        with transaction.atomic():
            tx = Transaction.objects.create(**validated_data)
            if receipt_file:
                link = upload_receipt_to_drive(receipt_file, self.context['request'].user, tx.created_at, "transazione")
                tx.receipt_link = link
                tx.save(update_fields=['receipt_link'])
        return tx


# Serializer to view transactions
class TransactionViewSerializer(serializers.ModelSerializer):
    executor = serializers.SerializerMethodField()
    account = serializers.SerializerMethodField()
    event_reference_manual = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = '__all__'

    @staticmethod
    def get_executor(obj):
        if obj.executor and getattr(obj.executor, 'profile', None):
            return {
                "id": obj.executor.profile.id,
                "email": obj.executor.profile.email,
                "name": f"{obj.executor.profile.name} {obj.executor.profile.surname}"
            }
        elif obj.executor:
            # Fallback if profile missing
            return {
                "id": None,
                "email": getattr(obj.executor, 'email', ''),
                "name": 'Pagamento Onlinee'
            }
        return None

    @staticmethod
    def get_account(obj):
        return {
            "id": obj.account.id,
            "name": f"{obj.account.name}"
        }

    @staticmethod
    def get_event_reference_manual(obj):
        return obj.event_reference_manual.id if obj.event_reference_manual else None


# ---- Finance visibility helpers (moved restriction logic to treasury) ----
def _primary_group(user):
    g = user.groups.first()
    return g.name if g else None


def _is_board(user):
    return user.groups.filter(name="Board").exists()


def user_can_view_account_balance(user, account):
    """
    Board: can see all balances.
    Attivi: can see all except SumUp.
    Aspiranti: only if flag can_view_casse_import (granted) and not SumUp.
    Others: none.
    """
    if not user or not hasattr(user, "groups"):
        return False
    if _is_board(user):
        return True
    if account.name == "SumUp":
        return False
    pg = _primary_group(user)
    if pg == "Attivi":
        return True
    # Granted Aspiranti (flag set previously)
    if getattr(user, "can_view_casse_import", False):
        return True
    return False


class AccountDetailedViewSerializer(serializers.ModelSerializer):
    changed_by = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = '__all__'

    @staticmethod
    def get_changed_by(obj):
        return {
            "id": obj.changed_by.profile.id,
            "email": obj.changed_by.profile.email,
            "name": f"{obj.changed_by.profile.name} {obj.changed_by.profile.surname}"
        }

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request_user = self.context.get('request').user
        # Mask balance if user not allowed
        if not user_can_view_account_balance(request_user, instance):
            representation['balance'] = None
        # Visibility of visible_to_groups only for Board (unchanged logic)
        board_group = Group.objects.filter(name="Board").first()
        if not (board_group and board_group in request_user.groups.all()):
            representation.pop('visible_to_groups', None)
        return representation


class AccountListViewSerializer(serializers.ModelSerializer):
    changed_by = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ['id', 'name', 'status', 'balance', 'changed_by']

    @staticmethod
    def get_changed_by(obj):
        return {
            "id": obj.changed_by.profile.id,
            "email": obj.changed_by.profile.email,
            "name": f"{obj.changed_by.profile.name} {obj.changed_by.profile.surname}"
        }

    def get_balance(self, obj):
        user = self.context.get('request').user
        return obj.balance if user_can_view_account_balance(user, obj) else None


# Serializer to create accounts
class AccountCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['name', 'visible_to_groups']


# Serializer to edit accounts
class AccountEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['name', 'status', 'visible_to_groups', 'changed_by']


class ReimbursementRequestSerializer(serializers.ModelSerializer):
    receiptFile = serializers.FileField(write_only=True, required=False, allow_null=True, allow_empty_file=True)
    is_reimbursed = serializers.SerializerMethodField()
    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all(), required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = ReimbursementRequest
        fields = ['id', 'user', 'amount', 'payment', 'description', 'receipt_link', 'created_at', 'receiptFile',
                  'is_reimbursed', 'account']
        read_only_fields = ['id', 'user', 'created_at', 'receipt_link']

    @staticmethod
    def validate_receiptFile(file):
        return validate_receipt_file(file)

    @staticmethod
    def _upload_receipt_to_drive(receipt_file, user, instance_creation_time):
        # Reuse shared helper (prefix 'rimborso')
        return upload_receipt_to_drive(receipt_file, user, instance_creation_time, "rimborso")

    def create(self, validated_data):
        user = self.context['request'].user
        # Explicitly remove receiptFile from validated_data if it's None
        receipt_file = validated_data.pop('receiptFile', None)
        # Remove user from validated_data if present
        validated_data.pop('user', None)

        with transaction.atomic():
            instance = ReimbursementRequest.objects.create(
                user=user,
                **validated_data
            )
            if receipt_file:
                # Use instance.created_at for filename (now available)
                receipt_link = self._upload_receipt_to_drive(receipt_file, user, instance.created_at)
                instance.receipt_link = receipt_link
                instance.save(update_fields=['receipt_link'])
        return instance

    def update(self, instance, validated_data):
        receipt_file = validated_data.pop('receiptFile', None)
        description = validated_data.get('description')
        receipt_link = validated_data.get('receipt_link')
        account = validated_data.get('account', None)
        amount = validated_data.get('amount', None)

        old_reimbursed = instance.is_reimbursed
        with transaction.atomic():
            # Field updates
            if description is not None:
                instance.description = description
            if amount is not None:
                instance.amount = amount
            if receipt_file:
                new_receipt_link = self._upload_receipt_to_drive(receipt_file, instance.user, instance.created_at)
                instance.receipt_link = new_receipt_link
            elif receipt_link is not None:
                instance.receipt_link = receipt_link

            # Handle account change (even if already reimbursed)
            if account is not None:
                account_changed = instance.account_id != (account.id if account else None)
                instance.account = account

                # If already reimbursed and account changed -> move the existing transaction
                if account_changed and instance.reimbursement_transaction:
                    tx = Transaction.objects.select_for_update().get(pk=instance.reimbursement_transaction.pk)
                    new_account = Account.objects.select_for_update().get(pk=account.pk)
                    if new_account.status == "closed":
                        raise serializers.ValidationError("La nuova cassa selezionata è chiusa.")
                    # tx.amount is negative (money leaving the cassa). Check future balance.
                    future_balance = new_account.balance + tx.amount  # tx.amount < 0
                    if future_balance < 0:
                        raise serializers.ValidationError("Saldo insufficiente nella nuova cassa per spostare il rimborso.")
                    # Move transaction (Transaction.save adjusts both accounts' balances)
                    tx.account = new_account
                    tx.save(update_fields=['account'])

            # Create reimbursement transaction if not yet reimbursed
            if not instance.is_reimbursed and instance.account and not instance.reimbursement_transaction:
                if instance.amount is None:
                    raise serializers.ValidationError("Importo mancante per effettuare il rimborso.")
                account_obj = Account.objects.select_for_update().get(pk=instance.account.pk)
                if account_obj.status == "closed":
                    raise serializers.ValidationError("La cassa selezionata è chiusa.")
                reimbursement_amount = instance.amount
                if account_obj.balance - reimbursement_amount < 0:
                    raise serializers.ValidationError("Il saldo della cassa non può andare in negativo.")
                tx = Transaction.objects.create(
                    type=Transaction.TransactionType.REIMBURSEMENT,
                    executor=instance.user,
                    account=account_obj,
                    amount=-reimbursement_amount,
                    description=f"Rimborso richiesta #{instance.id}: {instance.description}"
                )
                instance.reimbursement_transaction = tx
            elif old_reimbursed and not instance.is_reimbursed:
                # (Unreachable with current model logic, retained for completeness)
                if not self.context['request'].user.is_superuser:
                    raise serializers.ValidationError("Solo un superuser può annullare un rimborso.")
                if instance.reimbursement_transaction:
                    instance.reimbursement_transaction.delete()
                    instance.reimbursement_transaction = None

            instance.save()
        return instance

    @staticmethod
    def get_is_reimbursed(obj):
        return obj.is_reimbursed


class ReimbursementRequestViewSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    is_reimbursed = serializers.SerializerMethodField()
    account = serializers.SerializerMethodField()

    class Meta:
        model = ReimbursementRequest
        fields = ['id', 'user', 'amount', 'payment', 'description', 'receipt_link', 'created_at', 'is_reimbursed',
                  'account']

    @staticmethod
    def get_user(obj):
        try:
            profile = getattr(obj.user, 'profile', None)
            if profile:
                return {
                    "id": getattr(profile, 'id', None),
                    "email": getattr(profile, 'email', ''),
                    "name": f"{getattr(profile, 'name', '')} {getattr(profile, 'surname', '')}".strip() or None
                }
        except AttributeError:
            pass

        return {
            "email": getattr(obj.user, 'email', ''),
            "name": None
        }

    @staticmethod
    def get_account(obj):
        if obj.account:
            return {"id": obj.account.id, "name": obj.account.name}
        return None

    @staticmethod
    def get_is_reimbursed(obj):
        return obj.is_reimbursed


class TransactionUpdateSerializer(serializers.ModelSerializer):
    receiptFile = serializers.FileField(write_only=True, required=False, allow_null=True, allow_empty_file=True)
    remove_receipt = serializers.BooleanField(write_only=True, required=False, default=False)
    receipt_link = serializers.URLField(read_only=True)

    class Meta:
        model = Transaction
        fields = ['account', 'amount', 'description', 'receiptFile', 'remove_receipt', 'receipt_link']

    @staticmethod
    def validate_receiptFile(file):
        return validate_receipt_file(file)

    def update(self, instance, validated_data):
        receipt_file = validated_data.pop('receiptFile', None)
        remove = validated_data.pop('remove_receipt', False)

        # Basic updatable fields
        for f in ['account', 'amount', 'description']:
            if f in validated_data:
                setattr(instance, f, validated_data[f])

        if receipt_file:
            link = upload_receipt_to_drive(receipt_file, self.context['request'].user, instance.created_at, "transazione")
            instance.receipt_link = link
        elif remove:
            instance.receipt_link = ''  # blank permitted

        instance.save()
        return instance
