import re

from rest_framework import serializers
from .models import ContentSection, ContentLink, WhatsAppConfig


class ContentLinkSerializer(serializers.ModelSerializer):
    description = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = ContentLink
        fields = [
            'id', 'section', 'name', 'description', 'url', 'color',
            'order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContentSectionSerializer(serializers.ModelSerializer):
    links = ContentLinkSerializer(many=True, read_only=True)
    title_display = serializers.CharField(source='get_title_display', read_only=True)

    class Meta:
        model = ContentSection
        fields = [
            'id', 'title', 'title_display', 'order', 'is_active',
            'links', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'title_display', 'created_at', 'updated_at']


class WhatsAppConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppConfig
        fields = ['whatsapp_link', 'updated_at']
        read_only_fields = ['updated_at']


class WhatsAppRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    is_international = serializers.BooleanField()
    home_university = serializers.CharField(max_length=300)
    course_of_study = serializers.CharField(max_length=300)

    def validate_email(self, value):
        """Validate that the email matches name.surname@mail.polimi.it (all lowercase)."""
        value = value.lower()  # always normalise to lowercase
        # Pattern: at least two lowercase letter-segments (letters, digits, hyphens, apostrophes)
        # separated by dots, e.g. mario.rossi@mail.polimi.it, mario2.rossi@mail.polimi.it
        pattern = r"^[a-z][a-z0-9'\-]*(\.[a-z][a-z0-9'\-]*)+@mail\.polimi\.it$"
        if not re.match(pattern, value):
            raise serializers.ValidationError(
                'Email must follow the format name.surname@mail.polimi.it – '
                'no capital letters, no personal code (e.g. "12345678@mail.polimi.it" is not accepted).'
            )
        return value
