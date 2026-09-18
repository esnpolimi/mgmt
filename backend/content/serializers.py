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
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    no_surname = serializers.BooleanField(required=False)
    is_international = serializers.BooleanField()
    home_university = serializers.CharField(max_length=300)
    course_of_study = serializers.CharField(max_length=300)

    def validate(self, attrs):
        """Validate the Polimi email format, allowing a single name segment without a surname."""
        value = attrs['email'].lower()
        no_surname = attrs.get('no_surname', False)
        if no_surname and attrs.get('last_name', '').strip():
            raise serializers.ValidationError({'last_name': 'Last name must be empty when no_surname is selected.'})
        if not no_surname and not attrs.get('last_name', '').strip():
            raise serializers.ValidationError({'last_name': 'Last name is required.'})

        pattern = (
            r"^[a-z][a-z0-9'\-]*@mail\.polimi\.it$"
            if no_surname
            else r"^[a-z][a-z0-9'\-]*(\.[a-z][a-z0-9'\-]*)+@mail\.polimi\.it$"
        )
        if not re.match(pattern, value):
            email_format = 'name@mail.polimi.it' if no_surname else 'name.surname@mail.polimi.it'
            raise serializers.ValidationError(
                f'Email must follow the format {email_format} – '
                'no capital letters, no personal code (e.g. "12345678@mail.polimi.it" is not accepted).'
            )
        attrs['email'] = value
        return attrs
