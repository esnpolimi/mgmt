from jsonschema import validate
from events.models import Event, Subscription
from profiles.models import Profile
from rest_framework import serializers

# Serializer to create events
class EventCreationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        exclude = ['id','created_at','updated_at','enabled']

    
# Serializer to view subscriptions
class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = '__all__'

# Serializer to view event details
class EventDetailViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'

    subscriptions = SubscriptionSerializer(source='subscription_set',many=True)

# Serializer to view event
class EventListViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'

# Serializer to edit event
class EventEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        exclude = ['id','created_at','updated_at','enabled']

# Serializer for validation of subscription additional/form data, given the event's additional/form fields.
# Can be adjusted for editing mode and office visibility

class SubscriptionJSONDataValidator(serializers.Serializer):
    def __init__(self,*args,fields,office=False,editing=False,**kwargs):
        self.fields_schema = {  
            "type" : "object",
            "patternProperties" :{
                "^t_.*$" : {
                    "type":"object",
                    "properties":{
                        "length":{
                            "type":"integer",
                            "minimum":1
                        },
                        "office_view":{"type":"boolean"},
                        "office_edit":{"type":"boolean"},
                    },
                    "additionalProperties":False,   
                },
                "^i_.*$" : {
                    "type":"object",
                    "properties":{
                        "office_view":{"type":"boolean"},
                        "office_edit":{"type":"boolean"},
                    },
                    "additionalProperties":False,
                },
                "^f_.*$" : {
                    "type":"object",
                    "properties":{
                        "office_view":{"type":"boolean"},
                        "office_edit":{"type":"boolean"},
                    },
                    "additionalProperties":False,
                },
                "^(c_|m_).*$" : {
                    "type":"object",
                    "properties":{
                        "choices":{
                             "type":"object",
                             "patternProperties":{
                                 ".*": {"type":"string"} # color
                             },
                             "additionalProperties":False
                         },
                         "office_view":{"type":"boolean"},
                         "office_edit":{"type":"boolean"},
                    },
                    "additionalProperties":False,
                },
            },
            "additionalProperties":False
        }
        validate(fields,schema=self.fields_schema)

        for field_name in fields.keys():
            if not office or ( editing and fields[field_name]['office_edit'] ) or ((not editing) and fields[field_name]['office_view'] ):
                if field_name[0] == 't':
                    self.fields[field_name[2:]] = serializers.CharField(max_length=fields[field_name]['length'])
                elif field_name[0] == 'i':
                    self.fields[field_name[2:]] = serializers.IntegerField()
                elif field_name[0] == 'f':
                    self.fields[field_name[2:]] = serializers.FloatField()
                elif field_name[0] == 'c':
                    self.fields[field_name[2:]] = serializers.ChoiceField(choices=tuple([(c,c) for c in fields[field_name]['choices'].keys()]))
                elif field_name[0] == 'm':
                    self.fields[field_name[2:]] = serializers.MultipleChoiceField(choices=tuple([(c,c) for c in fields[field_name]['choices'].keys()]))

        super().__init__(*args,**kwargs)

# Serializer to create subscription through form
class FormSubscriptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['event','event_data','form_data']

    profile = serializers.SlugRelatedField(queryset=Profile.objects.all(),slug_field='email')
    
    def validate(self, attrs):
        super().validate(attrs)
        form_data_validator = SubscriptionJSONDataValidator(data=self.fields['form_data'], fields=self.fields['event'].form_fields)
        form_data_validator.validate()

# Serializer to create subscription manually
class ManualSubscriptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['profile','event','event_data','additional_data']

    def validate(self, attrs):
        super().validate(attrs)
        additional_data_validator = SubscriptionJSONDataValidator(data=self.fields['additional_data'], fields=self.fields['event'].additional_fields)
        additional_data_validator.validate()

# Serializer to fully edit subscription 
class SubscriptionFullEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['event_data','additional_data','form_data']

    def validate(self,attrs):
        super().validate(attrs)
        form_data_validator = SubscriptionJSONDataValidator(data=self.fields['form_data'], fields=self.fields['event'].form_fields)
        additional_data_validator = SubscriptionJSONDataValidator(data=self.fields['additional_data'], fields=self.fields['event'].additional_fields)
        form_data_validator.validate()
        additional_data_validator.validate()

# Serializer for editing a subscription, disabling fields not editable by office
class SubscriptionOfficeEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ['event_data','additional_data','form_data']

        def validate(self,attrs):
            form_data_validator = SubscriptionJSONDataValidator(data=self.fields['form_data'], fields=self.fields['event'].form_fields, office=True,editing=True)
            additional_data_validator = SubscriptionJSONDataValidator(data=self.fields['additional_data'], fields=self.fields['event'].additional_fields, office=True,editing=True)
            form_data_validator.validate()
            additional_data_validator.validate()


    