from rest_framework import serializers
from profiles.serializers import ProfileListViewSerializer
from .models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        print(f"Authenticating user: {user}")
        token = super().get_token(user)
        token['user_id'] = user.profile.email

        return token


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        exclude = ['password']


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserWithProfileAndGroupsSerializer(serializers.ModelSerializer):
    profile = ProfileListViewSerializer(read_only=True)  # Nested serializer for profile details
    groups = serializers.StringRelatedField(many=True)  # Fetch group names directly

    class Meta:
        model = User
        fields = ['profile', 'groups']  # Include profile and groups


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
