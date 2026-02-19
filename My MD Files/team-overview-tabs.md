# Team Overview → Employee Profile Tabs (Draft)

This document drafts the remaining tabs in the Employee Profile screen (`src/pages/team/EmployeeDetail.tsx`) that currently render as placeholders.

## Scope

- Applies to the **employee profile** screen opened from **Team Overview** (`/owner/team-directory` → `/team/:userId`).
- Primary users: **Owner, Manager** (route guarded in `src/App.tsx`).

## Tabs to implement (currently “coming soon”)

### 1) Management notes

- **Goal**: Private notes about an employee (performance coaching, reminders, internal context).
- **UI draft**
  - Timeline/list of notes (newest first)
  - Add note: textarea + Save
  - Edit/delete (optional for v1)
  - Metadata: author, date/time
- **Data model (recommended)**
  - Table: `employee_management_notes`
    - `id uuid pk`
    - `employee_id uuid fk profiles(id)`
    - `author_id uuid fk profiles(id)`
    - `content text`
    - `created_at timestamptz`
    - `updated_at timestamptz`
  - **RLS**: only owner/manager can read/write; staff cannot access.

### 2) Additional information

- **Goal**: Store non-employment personal information.
- **UI draft**
  - Date of birth
  - Address
  - Emergency contact name
  - Emergency contact phone
- **Data model (recommended)**
  - Option A (fastest): extend `profiles` with new nullable columns:
    - `date_of_birth date`, `address text`, `emergency_contact_name text`, `emergency_contact_phone text`
  - Option B (cleaner): table `employee_additional_info` keyed by `employee_id`.

### 3) Documents

Tabs:
- **HR Documents**
- **Medical Documents**
- **Certifications**

- **Goal**: Centralize employee-specific files (contracts, IDs, certs).
- **UI draft**
  - Document list/table:
    - Name, category, uploaded date, uploaded by, notes, actions (download/delete)
  - Upload flow:
    - Choose file + name + optional notes
    - For certifications: optional expiry date
- **Data model (recommended)**
  - Supabase Storage bucket: `employee-documents`
  - Table: `employee_documents`
    - `id uuid pk`
    - `employee_id uuid fk profiles(id)`
    - `category text check in ('hr','medical','certification')`
    - `file_path text` (path in storage)
    - `file_name text`
    - `mime_type text`
    - `size_bytes bigint`
    - `expires_on date null` (useful for certifications)
    - `notes text null`
    - `uploaded_by uuid fk profiles(id)`
    - `created_at timestamptz`
  - **RLS**: owner/manager can CRUD; optionally allow employee read-only access to their own docs later.

### 4) Payments

Tabs:
- **Banking Details**
- **Pay Details**
- **Employee Benefits**

- **Goal**: Keep sensitive payroll-related data in one place.
- **UI draft**
  - Banking: bank name, account name, account number, BSB/SWIFT (region-dependent)
  - Pay: pay type (hourly/salary), base rate, currency, effective date, notes
  - Benefits: list of benefits with optional amount/notes
- **Data model (recommended)**
  - Table: `employee_banking_details` (1:1 with employee)
  - Table: `employee_pay_details` (history-capable, effective dated)
  - Table: `employee_benefits` (0:n)
  - **RLS**: owner only by default; managers optionally read-only based on policy.

## Implementation notes

- Start with **UI drafts** + clear empty states.
- Where the DB table doesn’t exist yet, show a callout: “Not connected yet” to avoid false expectations.

