from rest_framework import serializers
from treasury.models import ESNCard, Transaction, Account
from profiles.models import Profile

# Serializer for ESNcard emission
class ESNCardEmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ESNCard
        fields = ['profile','number']
    
    account = serializers.ChoiceField(choices=Account.objects.all())

# Serializer to view ESNcard
class ESNCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ESNCard
        exclude = ['profile']
    
    expiration = serializers.ReadOnlyField()
    is_valid = serializers.ReadOnlyField()

# Serializer to create transactions
class TransactionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['subscription','account','executor','amount','description']

# Serializer to view transactions
class TransactionViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'

# Serializer to view accounts
class AccountViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'

# Serializer to create accounts
class AccountCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['name']

# Serializer to edit accounts
class AccountEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['name','status']