from rest_framework import serializers
from .models import ContentSection, ContentLink


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
