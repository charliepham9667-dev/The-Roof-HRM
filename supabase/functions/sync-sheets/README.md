# Google Sheets Sync Edge Function

This Edge Function syncs P&L data from Google Sheets to the `daily_metrics` table.

## Setup

### 1. Get a Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create an API Key:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the key

### 2. Configure Supabase Secrets

```bash
# Set the Google API Key as a secret
supabase secrets set GOOGLE_API_KEY=your_api_key_here
```

### 3. Make Your Sheet Public

Your Google Sheet must be accessible:
1. Open your sheet
2. Click "Share" → "Change to anyone with link"
3. Set to "Viewer" access

### 4. Deploy the Function

```bash
# From project root
supabase functions deploy sync-sheets
```

## Usage

### From Dashboard

1. Login as Owner
2. Go to Admin → Data Sync
3. Paste your Google Sheets URL
4. Enter the sheet/tab name (e.g., "Pnl 2026")
5. Click "Sync Now"

### API Call

```typescript
const { data, error } = await supabase.functions.invoke('sync-sheets', {
  body: {
    sheetId: 'your-sheet-id',
    sheetName: 'Pnl 2026',
    startRow: 16,  // Optional: default 16
    endRow: 500,   // Optional: default 500
  },
});
```

## Expected Sheet Format

The function expects your sheet to have data in these columns (starting from row 16):

| Column | Field | Example |
|--------|-------|---------|
| B | Date | 01.01.2026 |
| E | Day Revenue | 1,839 |
| F | Night Revenue | 38,927,104 |
| G | Total Revenue | 38,927,104 |
| R | Pax | 108 |
| W | Average Spend | 360,000 |

- Date format: DD.MM.YYYY (European format)
- Numbers can include thousand separators (commas)
- Currency symbols (đ, VND) are automatically stripped

## Troubleshooting

### "GOOGLE_API_KEY not configured"
Run: `supabase secrets set GOOGLE_API_KEY=your_key`

### "Google Sheets API error"
- Check that the API is enabled in Google Cloud Console
- Verify the sheet is shared publicly
- Check the sheet ID is correct

### No data synced
- Verify the sheet name matches exactly
- Check that data starts at row 16
- Ensure dates are in DD.MM.YYYY format
