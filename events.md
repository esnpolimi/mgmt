

- **Event**
    - Name
    - tables
    - Profile data
    - With form 
    - Form open
    - Form data
    - Additional data
    - RE
    - RS 

Profile data is not directly editable (?)
Additional / form data must be in the following format:

```
{
    "name":"field_name",
    "type":"text, number, choice, checkbox"
    "choices":[{"name":"A","color":""}, ... ]
}
```

- **Table**. A table contains subscription objects. It also has the following properties
    - Id
    - Name
    - Max entries
    - Visible by office 
    - Editable by office

- **Subscription**. Corresponds to a row in the tables
    - Profile (FK)
    - Event (FK)
    - Color
    - Type (form or office)
    - Table
    - Additional data
    - Form data
