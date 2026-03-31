# Events
Goal: integrate event and subscription management features into a single platform, removing the need to use both a management tool and an Excel sheet. The platform supports payments, reimbursements, and event operations in a more efficient and centralized way.

### Main Features

1. **Event Creation and Management**
   - Each event can include attributes such as name, date, description, RE, and RS.
   - Multiple lists can be configured per event, such as "Main List" and "Waiting List", each with its own name and capacity.

2. **Subscriptions**
   - Each row in a list is linked to a subscription, representing one profile enrolled in one event.
   - A subscription can belong to only one list at a time.

3. **List Columns**
   - **Profile Fields**: Columns containing participant profile data (name, surname, phone number, ESN card, and so on). These columns are immutable and automatically populated from the database.
   - **Form Fields**: Columns populated with answers submitted by participants through a form. These columns can be edited by organizers.
   - **Additional Fields**: Extra columns filled directly by organizers to support event operations (for example notes or rental requests). Each field includes boolean attributes for office visibility and editability.

4. **Row Management**
   - Rows can be moved between lists while respecting capacity limits.
   - Organizers can manually add rows by linking them to an existing profile.

5. **Payment Management**
   - Each row has a button that opens a modal with the list of transactions for that specific event.
   - The modal allows viewing payment/reimbursement history and creating new transactions.
   - An optional additional field called "Status" can be used to manually track payment state (for example "Paid", "Unpaid", "Reimbursed").

### Benefits

- **Centralization**: All information and capabilities are available in one platform.
- **Flexibility**: Custom fields and lists allow tailored event management.
- **Efficiency**: Automated profile data and subscription flows reduce errors and simplify operations.

