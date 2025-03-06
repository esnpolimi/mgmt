This repository contains the code that implements the REST API for the ESN management platform. It is written in
python, using [Django](https://www.djangoproject.com) and [Django Rest Framework](https://www.django-rest-framework.org/).
The code is divided into 4 apps that handle different functionalities
of the management platform.

- **profiles**: manages the registration of new profiles (erasmus or esners), adding or editing documents or matricole,
  releasing esncards, retrieving data and search through it.

- **events**: manages events, i.e. creation, editing, registering a profile to an event, etc.

- **treasury**: manages transactions (created when a payment is issued, for example when registering to an event or
  releasing an esncard) and accounts (i.e. casse)

- **users**: handles authentication

These modules are not isolated, but each one can access each other. It could not be otherwise, as, for example, events
depend on profiles and on transactions.
The structure of every app is as follows:

- models.py contains the models, i.e. classes representing objects that are then automatically translated by django in
  database tables.

- serializers.py contains serializers, i.e. classes acting as a bridge between the database and the API. For example,
  they can:
    - retrieve objects from the database and serialize it to JSON
    - convert JSON into a database object
    - edit fields of database object given JSON that describes them

- views.py contains the functions that handle request to the different endpoints. They take as input the request,
  process it (for example using serializers) and return a response (for example json from a serializer)

- urls.py binds the functions in views.py to the endpoints paths

# Profile endpoints

### Create profile

`POST /profiles`

Creates a profile with related document and matricola. `verified` field is initialized to false.

#### **Parameters:**

| name                 | type   | mandatory | description                    |
|----------------------|--------|-----------|--------------------------------|
| email                | string | yes       |                                |
| name                 | string | yes       |                                |
| surname              | string | yes       |
| gender               | string | yes       | Must be either 'M', 'F' or 'O' |
| country              | string | yes       | Must be a vaid country         |
| course               | string | yes       |                                |
| phone                | string | yes       |                                |
| whatsapp             | string | yes       |                                |
| person_code          | int    | yes       |                                |
| domicile             | string | yes       |                                |
| residency            | string | yes       |                                |
| matricola_number     | int    | yes       |
| matricola_expiration | date   | yes       |
| document_type        | string | yes       |
| document_number      | string | yes       |
| document_expiration  | date   | yes       |

### Fetch all profiles *

`GET /profiles`

Returns all profiles without linked documents, matricole or ESNcards.

### Fetch specified profile *

`GET /profiles/<str:pk>`

If existing, returns detailed profile corresponding to the primary key (pk), including list of the profile's documents,
matricole and ESNcards.

### Update specified profile *

`PATCH /profiles/<str:pk>`

If existing, updates the profile corresponding to the primary key (pk) using the values of the parameters passed.

#### **Parameters**

| name        | type   | mandatory | description                  |
|-------------|--------|-----------|------------------------------|
| name        | string | no        |                              |
| surname     | string | no        |
| gender      | string | no        | Must be either 'M',F' or 'O' |
| country     | string | no        | Must be a valid country      |
| course      | string | no        |                              |
| phone       | string | no        |                              |
| whatsapp    | string | no        |                              |
| person_code | int    | no        |                              |
| domicile    | string | no        |                              |
| residency   | string | no        |                              |

### Delete specified profile *

`DELETE /profiles/<str:pk>`

If existing, deletes profile corresponding to the pk.

### Verify email

`GET /profiles/verify/<str:email>/<str:token>`

Verifies email address. `verified` field is set to true

# Document endpoints

### Create document

`POST /documents/`

Creates a new document associated to the specified profile.

#### **Parameters**

| name       | type      | mandatory | description                                   |
|------------|-----------|-----------|-----------------------------------------------|
| email      | string    | yes       | email corresponding to the associated profile |
| type       | string    | yes       | document type                                 |
| number     | string    | yes       | document number                               |
| expiration | timestamp | yes       | expiration date                               |

### Update document

`PATCH /documents/<str:pk>`

Updates the fields of the specified document.

| name       | type      | mandatory | description     |
|------------|-----------|-----------|-----------------|
| type       | string    | no        | document type   |
| number     | string    | no        | document number |
| expiration | timestamp | no        | expiration date |

### Delete document

`DELETE /documents/<str:pk>`

Deletes the specified document.

# Matricola endpoints

### Create matricola

`POST /matricole/`

Creates a new matricola associated to the specified profile.

#### **Parameters**

| name       | type      | mandatory | description                                   |
|------------|-----------|-----------|-----------------------------------------------|
| email      | string    | yes       | email corresponding to the associated profile |
| number     | string    | yes       | document number                               |
| expiration | timestamp | yes       | expiration date                               |

### Update matricola

`PATCH /matricole/<str:pk>`

Updates the fields of the specified matricola.

| name       | type      | mandatory | description     |
|------------|-----------|-----------|-----------------|
| number     | string    | no        | document number |
| expiration | timestamp | no        | expiration date |

### Delete matricola

`DELETE /matricole/<str:pk>`

Deletes the specified

# ESNcard endpoints

### Create ESNcard

`POST /esncards`

Creates a new ESNcard associated to the specified profile.

#### **Parameters**

| name       | type      | mandatory | description                                   |
|------------|-----------|-----------|-----------------------------------------------|
| email      | string    | yes       | email corresponding to the associated profile |
| number     | string    | yes       | document number                               |
| expiration | timestamp | yes       | expiration date                               |

### Update ESNcard

`PATCH /esncards/<str:pk>`

Updates the fields of the specified ESNcard.

#### **Parameters**

| name       | type      | mandatory | description     |
|------------|-----------|-----------|-----------------|
| number     | string    | no        | document number |
| expiration | timestamp | no        | expiration date |

# User endpoints

### Create user

`POST /users`

Creates a user and its associated profile, document and matricola. Profile's `verified` field is initialized to false.

#### **Parameters:**

| name                 | type   | mandatory | description                  |
|----------------------|--------|-----------|------------------------------|
| email                | string | yes       |                              |
| password             | string | yes       | unhashed password            |
| name                 | string | no        |                              |
| surname              | string | no        |
| gender               | string | no        | Must be either 'M',F' or 'O' |
| country              | string | no        | Must be a vaid country       |
| course               | string | no        |                              |
| phone                | string | no        |                              |
| whatsapp             | string | no        |                              |
| person_code          | int    | no        |                              |
| domicile             | string | no        |                              |
| residency            | string | no        |                              |
| matricola_number     | int    | yes       |
| matricola_expiration | date   | yes       |
| document_type        | string | yes       |
| document_number      | string | yes       |
| document_expiration  | date   | yes       |

### Change password *

`PATCH /users/password_change`

Changes the password of authenticated user.

#### **Parameters**

| name     | type   | mandatory | description       |
|----------|--------|-----------|-------------------|
| password | string | yes       | unhashed password |

# Event endpoints

### Create event

`POST /events/`

Creates a new event.

#### **Parameters**

| name         | type   | mandatory | description |
|--------------|--------|-----------|-------------|
| name         | string | yes       |             |
| date         | date   | yes       |             |
| description  | string | yes       |             |
| fee          | float  | yes       |
| variable_fee | bool   | yes       |             |

### Fetch event list

`GET /events/`

Returns undetailed events list. #TODO Define pagination.

### Fetch single event

`GET /events/<int:pk>`

Returns the specified event details.

### Edit event

`PATCH /events/<int:pk>`

Edits the specified event.

#### **Parameters**

| name         | type   | mandatory | description |
|--------------|--------|-----------|-------------|
| name         | string | no        |             |
| date         | date   | no        |             |
| description  | string | no        |             |
| fee          | float  | no        |
| variable_fee | bool   | no        |             |

### Delete event

`DELETE /events/<int:pk>`

Deletes the specified event.

# Subscription endpoints

### Create subscription

`POST /subscriptions`

Creates a subscription of the specified profile to the specified event.

#### **Parameters**

| name     | type   | mandatory | description |
|----------|--------|-----------|-------------|
| email    | string | yes       |             |
| event_id | int    | yes       |             |

### Fetch subscriptions

`GET /subscriptions/<int:event_pk>`

Fetches all subscriptions of given event. Not detailed.

### Fetch specific subscription

`GET /subscriptions/<int:event_pk>/<str:profile_pk>`

Fetches specified subscription. Detailed.

#### **Parameters**

| name     | type | mandatory | description |
|----------|------|-----------|-------------|
| event_id | int  | yes       |             |

### Update subscription

`PATCH /subscriptions/<int:event_pk>/<str:profile_pk>`

Updates specific subscription.

| name              | type   | mandatory | description |
|-------------------|--------|-----------|-------------|
| refund            | float  | no        |
| refund_authorized | bool   | no        |
| status            | string | no        |
| tags              | json   | no        |

### Delete subscription

`DELETE /subscriptions/<int:event_pk>/<str:profile_pk>`

Deletes subscription. Possible only if there are no transactions related to the subscription.

# Account (cassa)

### Fetch accounts

`GET /accounts`

Fetches all the existing accounts.

# Transaction endpoints

### Create transaction

`POST /transactions`

Generates a generic deposit/withdrawal transaction.

#### **Parameters**

| name     | type   | mandatory | description |
|----------|--------|-----------|-------------|
| account  | string | yes       |             |
| email    | string | yes       |
| email    | string | yes       |
| account  | string | yes       |
| event_id | string | no        |
| amount   | float  | yes       |
| reason   | string | yes       |

### Fetch transactions

`GET /transactions`

Returns transaction. #TODO Specify pagination

### Fetch specific transactions

`GET /transactions/<int:pk>`

Returns details of specified transaction.

### Update transaction

`PATCH /transactions/<int:pk>`

(Un)binds transaction to specific event.

#### **Parameters**

| name     | type   | mandatory | description |
|----------|--------|-----------|-------------|
| event_id | string | yes       |             |