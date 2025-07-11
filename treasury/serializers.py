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
        exclude = ['profile']


# Serializer to create transactions
class TransactionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['subscription', 'account', 'executor', 'amount', 'description', 'type']


# Serializer to view transactions
class TransactionViewSerializer(serializers.ModelSerializer):
    executor = serializers.SerializerMethodField()
    account = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = '__all__'

    @staticmethod
    def get_executor(obj):
        return {
            "id": obj.executor.profile.id,
            "email": obj.executor.profile.email,
            "name": f"{obj.executor.profile.name} {obj.executor.profile.surname}"
        }

    @staticmethod
    def get_account(obj):
        return {
            "id": obj.account.id,
            "name": f"{obj.account.name}"
        }


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

    def to_representation(self, instance):  # Return account visibilty only to Board group members
        representation = super().to_representation(instance)
        request_user = self.context.get('request').user  # Safely retrieve the request object
        board_group = Group.objects.filter(name="Board").first()

        if board_group and board_group in request_user.groups.all():
            representation['visible_to_groups'] = [
                {"id": group.id, "name": group.name} for group in instance.visible_to_groups.all()
            ]
        else:
            representation.pop('visible_to_groups', None)
        return representation


class AccountListViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'name', 'status']


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
        fields = ['id', 'user', 'amount', 'payment', 'description', 'receipt_link', 'created_at', 'receiptFile', 'is_reimbursed', 'account']
        read_only_fields = ['id', 'user', 'created_at', 'receipt_link']

    @staticmethod
    def validate_receiptFile(file):
        if not file:
            return file

        allowed_mimetypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/bmp', 'image/webp', 'image/tiff']
        allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff']

        # Check mimetype
        if hasattr(file, 'content_type') and file.content_type not in allowed_mimetypes:
            raise serializers.ValidationError("Il file deve essere un'immagine o un PDF.")

        # Check extension
        ext = os.path.splitext(file.name)[1].lower()
        if ext not in allowed_extensions:
            raise serializers.ValidationError("Il file deve essere un'immagine o un PDF.")

        return file

    @staticmethod
    def _upload_receipt_to_drive(receipt_file, user, instance_creation_time):
        GOOGLE_DRIVE_FOLDER_ID = settings.GOOGLE_DRIVE_FOLDER_ID
        SERVICE_ACCOUNT_FILE = settings.GOOGLE_SERVICE_ACCOUNT_FILE

        def upload_to_drive(file, filename):
            credentials = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE,
                scopes=['https://www.googleapis.com/auth/drive']
            )
            service = build('drive', 'v3', credentials=credentials)

            # Wrap Django file object to BytesIO for upload
            file.seek(0)
            media = MediaIoBaseUpload(file, mimetype=file.content_type)
            file_metadata = {
                'name': filename,
                'parents': [GOOGLE_DRIVE_FOLDER_ID]
            }
            uploaded = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()

            # Make the file publicly accessible
            service.permissions().create(
                fileId=uploaded['id'],
                body={'role': 'reader', 'type': 'anyone'}
            ).execute()

            return f"https://drive.google.com/file/d/{uploaded['id']}/view?usp=sharing"

        ext = os.path.splitext(receipt_file.name)[1].lower()
        receipt_filename = f"ricevuta_{user.profile.name}_{user.profile.surname}_{instance_creation_time.strftime('%Y%m%d_%H%M%S')}{ext}"
        return upload_to_drive(receipt_file, receipt_filename)

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

        with transaction.atomic():
            if description is not None:
                instance.description = description

            if amount is not None:
                instance.amount = amount

            if receipt_file:
                new_receipt_link = self._upload_receipt_to_drive(receipt_file, instance.user, instance.created_at)
                instance.receipt_link = new_receipt_link
            elif receipt_link is not None:
                instance.receipt_link = receipt_link

            if account is not None:
                instance.account = account

            # Prevent double reimbursement with select_for_update
            if not instance.is_reimbursed and instance.account:
                account_obj = Account.objects.select_for_update().get(pk=instance.account.pk)
                if account_obj.status == "closed":
                    raise serializers.ValidationError("La cassa selezionata è chiusa.")

                reimbursement_amount = instance.amount if amount is None else amount

                if account_obj.balance - reimbursement_amount < 0:
                    raise serializers.ValidationError("Il saldo della cassa non può andare in negativo.")
                if instance.reimbursement_transaction:
                    raise serializers.ValidationError("Questa richiesta è già stata rimborsata.")
                tx = Transaction.objects.create(
                    type=Transaction.TransactionType.REIMBURSEMENT,
                    executor=instance.user,
                    account=account_obj,
                    amount=-reimbursement_amount,
                    description=f"Rimborso richiesta #{instance.id}: {instance.description}"
                )
                instance.reimbursement_transaction = tx
            elif instance.is_reimbursed:
                # Restrict unmarking to superusers (optional)
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
        fields = ['id', 'user', 'amount', 'payment', 'description', 'receipt_link', 'created_at', 'is_reimbursed', 'account']

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
