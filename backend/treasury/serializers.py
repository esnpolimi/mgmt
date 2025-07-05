import os

from django.contrib.auth.models import Group
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from rest_framework import serializers
from django.conf import settings
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

    class Meta:
        model = ReimbursementRequest
        fields = ['id', 'user', 'amount', 'payment', 'description', 'receipt_link', 'created_at', 'receiptFile']
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

    def create(self, validated_data):
        user = self.context['request'].user
        # Explicitly remove receiptFile from validated_data if it's None
        receipt_file = validated_data.pop('receiptFile', None)

        receipt_link = ""
        if receipt_file:
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
            receipt_filename = f"ricevuta_{user.profile.name}_{user.profile.surname}_{validated_data['created_at'].strftime('%Y%m%d_%H%M%S')}{ext}"
            receipt_link = upload_to_drive(receipt_file, receipt_filename)

        instance = ReimbursementRequest.objects.create(
            user=user,
            receipt_link=receipt_link,
            **validated_data
        )
        return instance

    def update(self, instance, validated_data):
        # Do NOT allow updating the file/image
        validated_data.pop('receiptFile', None)
        # Only allow updating description and receipt_link
        if 'description' in validated_data:
            instance.description = validated_data['description']
        if 'receipt_link' in validated_data:
            instance.receipt_link = validated_data['receipt_link']
        instance.save()
        return instance


class ReimbursementRequestViewSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = ReimbursementRequest
        fields = ['id', 'user', 'amount', 'payment', 'description', 'receipt_link', 'created_at']

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
