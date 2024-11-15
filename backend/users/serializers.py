from rest_framework import serializers

from profiles.serializers import ProfileListViewSerializer
from .models import User

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


