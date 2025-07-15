from datetime import date, datetime

from django.contrib.auth.models import Group
from rest_framework import serializers
from profiles.serializers import ProfileListViewSerializer
from .models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

import logging

logger = logging.getLogger(__name__)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        logger.info(f"Authenticating user: {user}")
        token = super().get_token(user)
        token['user_id'] = user.profile.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['refresh'] = str(self.get_token(self.user))
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        exclude = ['password']


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserWithProfileAndGroupsSerializer(serializers.ModelSerializer):
    profile = ProfileListViewSerializer(read_only=True)
    group = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['profile', 'group']

    @staticmethod
    def get_group(obj):
        first_group = obj.groups.first()
        return first_group.name if first_group else None


# Serializer for React, fetched at login time
class UserReactSerializer(serializers.ModelSerializer):
    groups = serializers.StringRelatedField(many=True)
    permissions = serializers.SerializerMethodField()
    profile = ProfileListViewSerializer(read_only=True)

    class Meta:
        model = User
        exclude = ['password', 'user_permissions']

    @classmethod
    def get_permissions(cls, obj):
        """ Get all permissions assigned to the user. """
        user_permissions = obj.user_permissions.values_list('codename', flat=True)
        group_permissions = obj.groups.values_list('permissions__codename', flat=True)
        return list(set(user_permissions).union(set(group_permissions)))

    def to_representation(self, instance):
        """ Convert date fields to ISO 8601 strings. """
        representation = super().to_representation(instance)
        for key, value in representation.items():
            if isinstance(value, (date, datetime)):
                representation[key] = value.isoformat()
        return representation


class GroupListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name']


class UserGroupEditSerializer(serializers.ModelSerializer):
    group = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = User
        fields = ['group']

    def update(self, instance, validated_data):
        group_name = validated_data.pop('group', None)
        if group_name is not None:
            try:
                group = Group.objects.get(name=group_name)
                instance.groups.set([group])
            except Group.DoesNotExist:
                raise serializers.ValidationError({'group': 'Il gruppo specificato non esiste.'})
        return super().update(instance, validated_data)
