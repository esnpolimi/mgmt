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
    class Meta:
        model = ESNcard
        exclude = ['profile']

    expiration = serializers.ReadOnlyField()
    is_valid = serializers.ReadOnlyField()


# Serializer to create transactions
class TransactionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['subscription', 'account', 'executor', 'amount', 'description']


# Serializer to view transactions
class TransactionViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'


# Serializer to view accounts
class AccountDetailedViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'


class AccountListViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'name', 'status']


# Serializer to create accounts
class AccountCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['name']


# Serializer to edit accounts
class AccountEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['name', 'status']
