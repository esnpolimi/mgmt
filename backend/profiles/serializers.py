from rest_framework import serializers
from django_countries.serializer_fields import CountryField
from rest_framework.fields import SerializerMethodField
from profiles.models import Profile, Document
from treasury.serializers import ESNcardSerializer
from users.models import User
from django.contrib.auth.models import Group


# Serializers are classes that take an object from the database and
# turn it into json (or other formats) in order to be sent through the API.
# Serializers can also do the opposite: they turn API data into database objects.
# There are different serializers for different use cases. For example some fields cannot 
# be edited, but just viewed. 
# Recommended read: https://www.django-rest-framework.org/api-guide/serializers/

# Serializer to view documents
# Takes the document object and turns it into json, excluding the profile fields
class DocumentViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        exclude = ['profile']


# Serializer to create documents
# Takes the data from API and creates an object
class DocumentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'enabled']


# Serializer to edit documents
class DocumentEditSerializer(serializers.ModelSerializer):

    class Meta:
        model = Document
        fields = '__all__'


# Serializer to view a profile in detail (i.e. including all esncards, documents and matricole),
class ProfileDetailViewSerializer(serializers.ModelSerializer):
    esncards = SerializerMethodField()
    documents = SerializerMethodField()
    country = CountryField()
    latest_esncard = ESNcardSerializer(read_only=True)
    latest_document = DocumentViewSerializer(read_only=True)
    group = SerializerMethodField()

    class Meta:
        model = Profile
        fields = '__all__'
        read_only_views = ['id', 'created_at', 'updated_at', 'enabled', 'esncards', 'documents',
                           'latest_esncard', 'latest_document']

    @staticmethod
    def get_esncards(obj):
        enabled_esncards = obj.esncard_set.filter(enabled=True)
        return ESNcardSerializer(enabled_esncards, many=True).data

    @staticmethod
    def get_documents(obj):
        enabled_documents = obj.document_set.filter(enabled=True)
        return DocumentViewSerializer(enabled_documents, many=True).data

    @staticmethod
    def get_group(obj):
        try:
            user = User.objects.get(profile=obj)
            group_obj = user.groups.first()
            return group_obj.name if group_obj else None
        except User.DoesNotExist:
            return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('group') is None:
            data.pop('group')
        return data


# Serializer to view a profile overview (i.e. including just the latest esncard, document, matricola)
class ProfileListViewSerializer(serializers.ModelSerializer):
    group = serializers.SerializerMethodField()
    country = CountryField()
    latest_esncard = ESNcardSerializer()
    latest_document = DocumentViewSerializer()

    class Meta:
        model = Profile
        fields = '__all__'

    @staticmethod
    def get_group(obj):
        if getattr(obj, 'is_esner', False):
            try:
                user = User.objects.get(profile=obj)
                group_obj = user.groups.first()
                return group_obj.name if group_obj else None
            except User.DoesNotExist:
                return None
        return None


# Serializer for editing a profile (except for specified fields)
class ProfileFullEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        exclude = ['id', 'created_at', 'updated_at', 'enabled', 'email']


class ProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        exclude = ['id', 'created_at', 'updated_at', 'enabled', 'email_is_verified']


class UserGroupEditSerializer(serializers.ModelSerializer):
    group = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['group']

    def update(self, instance, validated_data):
        group_name = validated_data.get('group')
        if group_name:
            group_obj, _ = Group.objects.get_or_create(name=group_name)
            instance.groups.clear()
            instance.groups.add(group_obj)
        return instance
