from rest_framework import serializers
from django_countries.serializer_fields import CountryField
from rest_framework.fields import SerializerMethodField

from profiles.models import Profile, Document, Matricola
from treasury.serializers import ESNCardSerializer

# Serializers are classes that take an object from the database and
# turn it into json (or other formats) in order to be sent through the API.
# Serializers can also do the opposite: they turn API data into database objects.
# There are different serializers for different use cases. For example some fields cannot 
# be edited, but just viewed. 
#Recommended read: https://www.django-rest-framework.org/api-guide/serializers/

#Serializer to view documents
# Takes the document object and turns it into json, excluding the profile fields
class DocumentViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        exclude = ['profile']

#Serializer to view matricole
# Takes the matricola object and turns it into json, excluding the profile fields
class MatricolaViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Matricola
        exclude = ['profile']

# Serializer to create documents
# Takes the data from API and creates an object
class DocumentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = '__all__'
        read_only_fields = ['id','created_at','updated_at','enabled']

# Serializer to create matricole
class MatricolaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Matricola
        fields = '__all__'
        read_only_fields = ['id','created_at','updated_at','enabled']

# Serializer to edit documents
class DocumentEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = '__all__'

# Serializer to edit matricole
class MatricolaEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Matricola
        exclude = ['number','exchange_end']


# Serializer to view a profile in detail (i.e. including all esncards, documents and matricole),  
class ProfileDetailViewSerializer(serializers.ModelSerializer):
    esncards = SerializerMethodField()
    documents = SerializerMethodField()
    matricole = SerializerMethodField()
    country = CountryField()

    class Meta:
        model = Profile
        fields = '__all__'
        read_only_views = ['id', 'created_at', 'updated_at', 'enabled', 'esncards', 'documents', 'matricole']

    @staticmethod
    def get_esncards(obj):
        enabled_esncards = obj.esncard_set.filter(enabled=True)
        return ESNCardSerializer(enabled_esncards, many=True).data

    @staticmethod
    def get_documents(obj):
        enabled_documents = obj.document_set.filter(enabled=True)
        return DocumentViewSerializer(enabled_documents, many=True).data

    @staticmethod
    def get_matricole(obj):
        enabled_matricole = obj.matricola_set.filter(enabled=True)
        return MatricolaViewSerializer(enabled_matricole, many=True).data

# Serializer to view a profile overview (i.e. including just the latest esncard, document, matricola)
class ProfileListViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'

    country = CountryField()
    latest_esncard = ESNCardSerializer()
    latest_document = DocumentViewSerializer()
    latest_matricola = MatricolaViewSerializer()

# Serializer for editing a profile (except for id, created_at, updated_at and enabled fields).
class ProfileFullEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        exclude = ['id','created_at','updated_at','enabled']

# Serializer for editing a profile's person code.
class ProfileBasicEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['person_code']

class ProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        exclude = ['id','created_at','updated_at','enabled','email_is_verified']
