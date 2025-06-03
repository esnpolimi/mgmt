from django.contrib.auth.models import Group
from rest_framework import serializers
from treasury.models import ESNcard, Transaction, Account
from profiles.models import Profile


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
