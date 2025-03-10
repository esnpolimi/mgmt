import re
from jsonschema import validate

from django.db import models
from django.core.exceptions import ValidationError
from simple_history.models import HistoricalRecords
from profiles.models import Profile, BaseEntity


tables_schema = {
    "type" : "object",
    "patternProperties" : {
        ".*":{"type":"number"} #capacity
    },
    "additionalProperties":False
}

profile_fields_schema = {
    "type" : "array",
    "items" : {"enum" : ["email","name","surname","birthdate","country","phone","whatsapp","course","domicile","matricola","document","person_code","esncard"]}
}

fields_schema = {  
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
 #           "additionalProperties":False
        }


event_data_schema = {
    "type":"object",
    "properties":{
        "table":{"type":"string"},
        "type":{"enum":["form","office"]},
        "color":{"type":"string"},
    } 
}


def validate_hex_color(hex_str):
    if not (re.search(r'^#[A-Fa-f0-9]{8}$', hex_str) or hex_str == ''):
        raise ValidationError("Invalid hex color code")

class Event(BaseEntity):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=128, unique=True)
    date = models.DateField(null=True)
    description = models.TextField(max_length=2048,null=True)
    enable_form = models.BooleanField(default=False)
    
    tables = models.JSONField()
    profile_fields = models.JSONField(default=list,blank=True,null=True)
    form_fields = models.JSONField(default=dict,blank=True,null=True)
    additional_fields = models.JSONField(default=dict,blank=True,null=True)

    def clean(self):
        super(Event, self).clean()

        #Validate profile fields
        validate(instance=self.tables, schema=tables_schema)
        if not self.profile_fields is None:
            validate(instance=self.profile_fields, schema=profile_fields_schema)
            if len(self.profile_fields) != len(set(self.profile_fields)):
                raise ValidationError("Profile fields names must be unique")

        #Validate form fields
        if not self.form_fields is None:
            validate(instance=self.form_fields, schema=fields_schema)
            for field_name in self.form_fields.keys():
                if field_name[0] == 'c' or field_name[0] == 'm':
                    for choice_name in self.form_fields[field_name]["choices"].keys():
                        validate_hex_color(self.form_fields[field_name]["choices"][choice_name])

        #Validate additional fields
        if not self.additional_fields is None:
            validate(instance=self.additional_fields, schema=fields_schema)
            for field_name in self.additional_fields.keys():
                if field_name[0] == 'c' or field_name[0] == 'm':
                    for choice_name in self.additional_fields[field_name]["choices"].keys():
                        validate_hex_color(self.additional_fields[field_name]["choices"][choice_name])
        
        #Validate tables capacity 
        for key in self.tables.keys():
            if self.tables[key]<= 0:
                raise ValidationError('Table capacity must be greater than zero')
        
                

  
class Subscription(BaseEntity):

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    enable_refund = models.BooleanField(default=False)
    history = HistoricalRecords()

    event_data = models.JSONField()
    form_data = models.JSONField(null=True, blank=True)
    additional_data = models.JSONField(null=True,blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['profile', 'event'], name='unique_profile_event_combination'
            )
        ]

 
    def clean(self):
        super(Subscription, self).clean()

        if self.event_data is not None:
            validate(instance=self.event_data, schema=event_data_schema)
            validate_hex_color(self.event_data["color"])
            # Validate table name
            if not self.event_data["table"] in self.event.tables:
                raise ValidationError("Table does not exist")
        # Validate color
    

        
        # form_data_form = DynamicForm(self.form_data,fields=self.event.form_fields)
        # additional_data_form = DynamicForm(self.additional_data,fields=self.event.additional_fields)

        # if not form_data_form.is_valid():
        #     raise ValidationError(form_data_form.errors)
        
        # if not additional_data_form.is_valid():
        #     raise ValidationError(additional_data_form.errors)
        


#form_fields_schema = {
#     "type" : "object",
#     "patternProperties" :{
#         ".*" : {
#             "type":"object",
#             "properties":{
#                 "type":{"enum":["text","number","choice","checkbox"]},
#                 "choices":{
#                     "type":"object",
#                     "patternProperties":{
#                         ".*": {"type":"string"} # color
#                     },
#                     "additionalProperties":"false"
#                 },
#                 "visible_by_office":{"type":"boolean"},
#                 "editable_by_office":{"type":"boolean"},
#             },
#             "additionalProperties":"false",   
#         }
#     },
#     "additionalProperties":"false"
# }

# additional_fields_schema = {
#     "type" : "object",
#     "patternProperties" :{
#         ".*" : {
#             "type":"object",
#             "properties":{
#                 "type":{"enum":["text","number","choice","checkbox"]},
#                 "choices":{
#                     "type":"object",
#                     "patternProperties":{
#                         ".*": {"type":"string"} # color
#                     },
#                     "additionalProperties":"false"
#                 },
#                 "visible_by_office":{"type":"boolean"},
#                 "editable_by_office":{"type":"boolean"},
#             } ,
#             "additionalProperties":"false",  
#         }
#     },
#     "additionalProperties":"false"
# }

    # def clean(self):
    #     super(Subscription, self).clean()

    #     # Validate json schema
    #     validate(instance=self.event_data, schema=event_data_schema)
    #     validate(instance=self.form_data, schema=form_data_schema)
    #     validate(instance=self.additional_data, schema=additional_data_schema)

    #     # Validate color
    #     validate_hex_color(self.json_data["color"])

    #     # Validate table name
    #     if not self.event_data["table"] in self.event.tables:
    #         raise ValidationError("Table does not exist")
        
    #     # Validate additional data types
    #     for field_name in self.event.additional_fields.keys():
    #         if not field_name in self.additional_data:
    #             raise ValidationError("Missing field value: " + field_name)
            
    #         type = self.event.additional_fields[field_name]["type"]
    #         val = self.additional_data[field_name]
    #         match type:
    #             case "string":
    #                 if not isinstance(val, str):
    #                     raise ValidationError("Invalid value for field " + field_name)
    #             case "number":
    #                 try:
    #                     float(val)
    #                 except:
    #                     raise ValidationError("Invalid value for field " + field_name)
    #             case "choice":
    #                 if not val in self.event.additional_fields[field_name]["choices"]:
    #                     raise ValidationError("Invalid value for field " + field_name)
    #             case "checkbox":
    #                 try:
    #                     if not set(val).issubset(set(self.event.additional_fields[field_name]["choices"])):
    #                         ValidationError("Invalid value for field " + field_name)
    #                 except:
    #                     ValidationError("Invalid value for field " + field_name)
        
    #     # Validate form data types
    #     for field_name in self.event.form_fields.keys():
    #         if not field_name in self.form_data:
    #             raise ValidationError("Missing form field value: " + field_name)
            
    #         type = self.event.form_fields[field_name]["type"]
    #         val = self.form_data[field_name]
    #         match type:
    #             case "string":
    #                 if not isinstance(val, str):
    #                     raise ValidationError("Invalid value for field " + field_name)
    #             case "number":
    #                 try:
    #                     float(val)
    #                 except:
    #                     raise ValidationError("Invalid value for field " + field_name)
    #             case "choice":
    #                 if not val in self.event.form_fields[field_name]["choices"]:
    #                     raise ValidationError("Invalid value for field " + field_name)
    #             case "checkbox":
    #                 try:
    #                     if not set(val).issubset(set(self.event.form_fields[field_name]["choices"])):
    #                         ValidationError("Invalid value for field " + field_name)
    #                 except:
    #                     ValidationError("Invalid value for field " + field_name)

        

#form_data_schema = {
#     "type":"object",
#     "patternProperties":{
#         ".*":{
#             "anyOf":[
#                 {"type":"string"},
#                 {"type":"number"},
#                 {"type":"array", "items":{"type":"string"}},
#             ]
#         },
#     "additionalProperties":"false",
#     }
# }

# additional_data_schema = {
#     "type":"object",
#     "patternProperties":{
#         ".*":{
#             "anyOf":[
#                 {"type":"string"},
#                 {"type":"number"},
#                 {"type":"array","items":{"type":"string"}},
#             ]
#         }
#     },
#     "additionalProperties":"false"
# }

# event_data_schema = {
#     "type" : "object",
#     "properties": {
#         "tables":{
#             "type" : "object",
#             "patternProperties" : {
#                 ".*":{
#                     "type":"object",
#                     "properties":{
#                         "capacity":{"type":"number"},
#                         "visible_by_office":{"type":"boolean"},
#                         "editable_by_office":{"type":"boolean"}
#                     }
#                 }
#             },
#             "additionalProperties":"false"
#         },
#         "profile_fields":{
#             "type" : "array",
#             "items" : {"enum" : ["email","name","surname","birthdate","country","phone","whatsapp","course","domicile","matricola","document","person_code","esncard"]}
#         },
#         "form_fields":{
#             "type" : "object",
#             "patternProperties" :{
#                 ".*" : {
#                     "type":"object",
#                     "properties":{
#                         "type":{"enum":["text","number","choice","checkbox"]},
#                         "choices":{
#                             "type":"object",
#                             "patternProperties":{
#                                 ".*": {"type":"string"}#color
#                             },
#                             "additionalProperties":"false"
#                         }
#                     }   
#                 }
#             },
#             "additionalProperties":"false"
#         },
#         "additional_fields":{
#             "type" : "object",
#             "patternProperties" :{
#                 ".*" : {
#                     "type":"object",
#                     "properties":{
#                         "type":{"enum":["text","number","choice","checkbox"]},
#                         "choices":{
#                             "type":"object",
#                             "patternProperties":{
#                                 ".*": {"type":"string"}#color
#                             },
#                             "additionalProperties":"false"
#                         }
#                     }   
#                 }
#             },
#             "additionalProperties":"false"
#         },
#     }
# }

# subscription_data_schema = {
#     "type":"object",
#     "properties":{
#         "table":{"type":"string"},
#         "type":{"enum":["form","office"]},
#         "color":{"type":"string"},
#         "additional_data":{
#             "type":"object",
#             "patternProperties":{
#                 ".*":{
#                     "anyOf":[
#                         {"type":"string"},
#                         {"type":"number"},
#                         {"type":"array",
#                          "items":{"type":"string"}},
#                     ]
#                 }
#             },
#             "additionalProperties":"false"
#         },
#         "form_data":{
#             "type":"object",
#             "patternProperties":{
#                 ".*":{
#                     "anyOf":[
#                         {"type":"string"},
#                         {"type":"number"},
#                         {"type":"array",
#                          "items":{"type":"string"}},
#                     ]
#                 },
#                 "additionalProperties":"false",
#             }
#         }
#     }
# }