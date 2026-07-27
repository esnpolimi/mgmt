# 04 - Treasury Module

## 1. Module Purpose

The treasury module manages application accounting and financial rules:

- accounts and group-based visibility
- transaction ledger with balance updates
- ESNcard issue/update with parameterized fee policy
- ESNcard revocation with refund tracked in ledger
- reimbursement request workflow
- automatic event-flow reimbursements (fee/deposit/services)
- transaction export for operational reporting
- daily Drive report generation (manual + scheduled)

## 2. Domain Model

### 2.1 Settings

Configurable economic parameters:

- esncard_release_fee
- esncard_lost_fee

### 2.2 ESNcard

Main attributes:

- profile
- number (unique)
- expiration (computed)
- membership_year (derived)

### 2.3 Account

Main attributes:

- name (unique)
- status: open|closed
- balance
- changed_by
- visible_to_groups

### 2.4 Transaction

Operational types:

- subscription
- esncard
- rimborso_esncard
- deposit
- withdrawal
- reimbursement
- `cauzione` (event deposit transaction type)
- rimborso_cauzione
- rimborso_quota
- service
- rimborso_service

Accounting invariants:

1. Transaction create/update/delete always realigns account balance.
2. Closed accounts do not accept new mutating operations.
3. For constrained types, negative balance is blocked.
4. Model validation errors on treasury writes are returned to the client as 400 responses.

### 2.5 ReimbursementRequest

Attributes:

- user
- amount
- payment (cash/PayPal/bank transfer)
- description
- receipt_link
- account
- reimbursement_transaction

## 3. API Contract Summary

Base path: /backend/

### 3.1 ESNcard APIs

- POST /esncard_emission/
- PATCH|DELETE /esncard/<pk>/
- GET /esncard_fees/

### 3.2 Transaction APIs

- POST /transaction/
- GET /transactions/
- GET|PATCH|DELETE /transaction/<pk>/
- GET /transactions_export/

### 3.5 Report APIs

- POST /reports/accounts/
- POST /reports/transactions/

### 3.3 Account APIs

- GET /accounts/
- POST /account/
- GET|PATCH /account/<pk>/

### 3.4 Reimbursement APIs

- POST /reimbursement_request/
- GET /reimbursement_requests/
- GET|PATCH|DELETE /reimbursement_request/<pk>/
- GET /reimbursable_deposits/
- POST /reimburse_deposits/
- POST /reimburse_quota/

## 4. Permission Model

Main rules:

1. Account creation: Board.
2. Full account patch: `change_account`.
3. Account status update: also allowed for treasury managers (group/flag).
4. Transaction creation: `add_transaction`.
5. Transaction patch/delete: specific permissions or `can_manage_casse`.
6. ESNcard revocation (`DELETE esncard/<pk>`): Board only.
7. Reimbursement request patch: Board.
8. Reimbursement request delete: Board or dedicated permission.

Account visibility:

- account is visible if user belongs to `visible_to_groups`
- or if account has no associated groups

## 5. Core Business Flows

### 5.1 ESNcard Emission

1. profile and issue-prerequisite validation
2. correct fee calculation (issue/lost/renewal)
3. ESNcard creation
4. `esncard` transaction registration on account

### 5.1bis ESNcard Revocation (Board only)

1. Board-permission validation
2. atomic lock on ESNcard, linked transactions, and account
3. reference-integrity validation (no non-ESNcard types, max 1 linked emission)
4. if a valid ESNcard emission exists:
	- verify account is open and has sufficient balance
	- create `rimborso_esncard` transaction with negative amount
5. delete ESNcard record
6. keep original emission transaction for audit history

### 5.2 Manual Transactions

1. deposit/withdrawal creation
2. account and balance validation
3. optional receipt upload
4. operational notification in non-localhost environments

### 5.3 Reimbursement Request Lifecycle

1. user opens reimbursement request
2. Board reviews and updates state/data
3. linked reimbursement transaction creation
4. account balance realignment

### 5.4 Event Reimbursements

Deposits:

1. bulk `subscription_ids` input
2. original deposit transaction verification
3. duplicate `rimborso_cauzione` block
4. support for external subscribers without profile

Fee/services:

1. original-payment verification
2. duplicate-refund block
3. optional reimbursement for related services
4. available account-balance check

Unified UI Orchestration (single icon):

1. frontend can select multiple items (fee/services/deposit) in one user action
2. backend still uses separate endpoints (`reimburse_quota`, `reimburse_deposits`)
3. flow is not cross-endpoint atomic: partial success is possible
4. on partial success, each item keeps its own state and can be retried
5. per-item error reason is propagated to client for guided retry

## 6. Query, Filters and Export

`transactions` list supports:

- search
- event
- multiple accounts
- multiple types
- dateFrom/dateTo
- limit per dashboard

`transactions_export` produces XLSX with accounting metadata and operational descriptions.

Daily Drive reports:

- two XLSX files stored in `Treasury-Reports/Casse` and `Treasury-Reports/Transazioni`
- filenames use `DD-MM-YYYY.xlsx`
- scheduled job runs at 23:50 Europe/Rome (snapshot at run time)

Note: `rimborso_esncard` is exported with a dedicated description.

## 7. Cross-Module Dependencies

- events: source of truth for `Subscription`/`Event` data used in reimbursements
- profiles/users: actor identity and ownership requirements
- notification/email: operational notifications for sensitive operations

## 8. Operational Risks

1. race conditions in balance updates during concurrent operations
2. event/treasury transaction misalignment on partial failures
3. regressions on edge cases with external subscribers without profile
4. account-visibility policy misalignment with runtime groups
5. ESNcard revocation blocked on insufficient balance or closed account

## 9. Testing Requirements

1. balance consistency on transaction create/update/delete
2. operation block on closed account
3. permission matrix Board/Attivi/Aspiranti with special flags
4. fee/deposit/services reimbursements including duplicate conditions
5. handling external users without profile in deposit reimbursements
6. export with combined filters and non-trivial datasets
7. ESNcard revocation with `rimborso_esncard` creation and balance consistency
8. ESNcard revocation blocks on edge cases (multiple emissions, anomalous references, insufficient balance, closed account)
9. report endpoints (`/reports/accounts/`, `/reports/transactions/`) with permission checks and success/error response shapes, including Drive-upload failures

Test reference: `backend/treasury/tests.py`.

## 10. Canonical Source Files

For AI-agent analysis/verification, use these files as primary references:

- backend/treasury/models.py
- backend/treasury/urls.py
- backend/treasury/views.py
- backend/treasury/serializers.py
