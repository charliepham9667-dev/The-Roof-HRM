# employee-documents-drive (Google Drive)

This Supabase Edge Function powers the Employee Profile **Documents** tabs by listing and uploading files to Google Drive.

## Setup

### 1) Enable APIs

- Enable **Google Drive API** in Google Cloud Console for your project.

### 2) Configure Supabase secrets

Uses the same OAuth client as the existing Google integration:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional:

- `GOOGLE_DRIVE_EMPLOYEE_DOCS_ROOT_FOLDER_ID` (if you want to force a specific root folder)

### 3) Connect Google Drive

Open:

- `{SUPABASE_URL}/functions/v1/google-drive-auth`

After success, tokens are stored in `app_settings`:

- `google_drive_refresh_token`
- `google_drive_access_token`

## Folder structure created

- Root: `The Roof HRM - Employee Documents`
  - Employee folder: `<employeeId>`
    - `HR Documents`
    - `Medical Documents`
    - `Certifications`

## Actions (POST JSON)

### list

```json
{ "action": "list", "employeeId": "<uuid>", "category": "hr" }
```

### upload

```json
{
  "action": "upload",
  "employeeId": "<uuid>",
  "category": "hr",
  "fileName": "Contract.pdf",
  "mimeType": "application/pdf",
  "contentBase64": "<base64>"
}
```

### delete

```json
{ "action": "delete", "employeeId": "<uuid>", "category": "hr", "fileId": "<driveFileId>" }
```

