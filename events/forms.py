from django import forms
from django.core.exceptions import ValidationError
from jsonschema import validate
from events.models import Subscription, Event


class ProfileLookUpForm(forms.Form):
    email = forms.EmailField(max_length=256)
    event = forms.ModelChoiceField(queryset=Event.objects.all())


class EventCreationForm(forms.ModelForm):
    class Meta:
        model = Event
        exclude = ['id', 'created_at', 'updated_at', 'deleted_at', 'enabled']


class JSONFieldsValidationForm(forms.Form):

    def __init__(self, *args, fields, office=False, editing=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields_schema = {
            "type": "object",
            "patternProperties": {
                "^t_.*$": {
                    "type": "object",
                    "properties": {
                        "length": {
                            "type": "integer",
                            "minimum": 1
                        },
                        "office_view": {"type": "boolean"},
                        "office_edit": {"type": "boolean"},
                    },
                    "additionalProperties": False,
                },
                "^i_.*$": {
                    "type": "object",
                    "properties": {
                        "office_view": {"type": "boolean"},
                        "office_edit": {"type": "boolean"},
                    },
                    "additionalProperties": False,
                },
                "^f_.*$": {
                    "type": "object",
                    "properties": {
                        "office_view": {"type": "boolean"},
                        "office_edit": {"type": "boolean"},
                    },
                    "additionalProperties": False,
                },
                "^(c_|m_).*$": {
                    "type": "object",
                    "properties": {
                        "choices": {
                            "type": "object",
                            "patternProperties": {
                                ".*": {"type": "string"}  # color
                            },
                            "additionalProperties": False
                        },
                        "office_view": {"type": "boolean"},
                        "office_edit": {"type": "boolean"},
                    },
                    "additionalProperties": False,
                },
            },
            "additionalProperties": False
        }
        validate(fields, schema=self.fields_schema)

        for field_name in fields.keys():
            if not office or (editing and fields[field_name]['office_edit']) or ((not editing) and fields[field_name]['office_view']):
                if field_name[0] == 't':
                    self.fields[field_name[2:]] = forms.CharField(max_length=fields[field_name]['length'])
                elif field_name[0] == 'i':
                    self.fields[field_name[2:]] = forms.IntegerField()
                elif field_name[0] == 'f':
                    self.fields[field_name[2:]] = forms.FloatField()
                elif field_name[0] == 'c':
                    self.fields[field_name[2:]] = forms.ChoiceField(choices=tuple([(c, c) for c in fields[field_name]['choices'].keys()]))
                elif field_name[0] == 'm':
                    self.fields[field_name[2:]] = forms.MultipleChoiceField(choices=tuple([(c, c) for c in fields[field_name]['choices'].keys()]))


class FormSubscriptionForm(forms.ModelForm):
    class Meta:
        model = Subscription
        fields = ['event', 'form_data']

    email = forms.EmailField(max_length=256)

    def clean(self):
        super().clean()

        form = JSONFieldsValidationForm(self.cleaned_data['form_data'], fields=self.cleaned_data['event'].form_fields)
        if not form.is_valid():
            raise ValidationError({'form_data': form.errors})


class ManualSubscriptionForm(forms.ModelForm):
    class Meta:
        model = Subscription
        fields = ['profile', 'event', 'event_data', 'additional_data']

    def clean(self):
        cleaned_data = super(ManualSubscriptionForm, self).clean()

        if not self.cleaned_data['additional_data'] is None:
            form = JSONFieldsValidationForm(self.cleaned_data['additional_data'], fields=self.cleaned_data['event'].additional_fields)
            if not form.is_valid():
                self.add_error('form', {'additional_data': form.errors})

        return cleaned_data

    # self.fields_schema = {
#             "type" : "object",
#             "patternProperties" :{
#                 ".*" : {
#                     "type":"object",
#                     "properties":{
#                         "type":{"enum":["text","number","choice","checkbox"]},
#                         "choices":{
#                             "type":"object",
#                             "patternProperties":{
#                                 ".*": {"type":"string"} # color
#                             },
#                             "additionalProperties":False
#                         },
#                         "visible_by_office":{"type":"boolean"},
#                         "editable_by_office":{"type":"boolean"},
#                     },
#                     "additionalProperties":False,   
#                 }
#             },
#             "additionalProperties":False
#         }
