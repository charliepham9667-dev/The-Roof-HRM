import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split(".");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

function parseNumber(value: string | number): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = value.toString().replace(/[đ₫VND\s$,]/gi, "").replace(/\./g, "");
  return parseFloat(cleaned) || 0;
}

// Month name mappings for P&L sheet header parsing
const MONTH_NAMES: Record<string, number> = {
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'september': 9,
  'oct': 10, 'october': 10,
  'nov': 11, 'november': 11,
  'dec': 12, 'december': 12,
};

function inferSalesYear(sheetName: string | undefined): number {
  const now = new Date();
  const raw = (sheetName || "").toLowerCase();
  // Matches: Sales26*, sales 2026, sales-26, etc.
  const m = raw.match(/sales\s*([0-9]{2,4})/i);
  if (!m) return now.getFullYear();
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return now.getFullYear();
  return n < 100 ? 2000 + n : n;
}

async function syncSalesMonthlyTargetsFromRow6(
  sheetId: string,
  sheetName: string | undefined,
  googleApiKey: string,
  supabase: any,
) {
  const sn = sheetName || "Sales26*";
  const year = inferSalesYear(sn);

  // Row 6 in Sales26 contains monthly target numbers (user-provided).
  // We read a wide enough range to capture month headers + row 6 values.
  const range = `${sn}!A1:AF6`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${googleApiKey}&valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API error (targets row 6): ${await res.text()}`);
  const json = await res.json();
  const rows: string[][] = json.values || [];
  if (rows.length < 6) return { updated: 0, year };

  const headerScanRows = rows.slice(0, 5);
  const targetRow = rows[5] || [];

  // Map columns to month numbers based on any header cell containing a month name.
  const monthColIndex = new Map<number, number>();
  for (let c = 0; c < 40; c++) {
    for (const r of headerScanRows) {
      const cell = (r[c] || "").toString().toLowerCase().trim();
      if (!cell) continue;
      const month = MONTH_NAMES[cell];
      if (month && !monthColIndex.has(month)) {
        monthColIndex.set(month, c);
      }
    }
  }

  if (monthColIndex.size === 0) {
    return { updated: 0, year };
  }

  // Avoid duplicates: delete all existing monthly revenue targets for this year.
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  await supabase
    .from("targets")
    .delete()
    .eq("metric", "revenue")
    .eq("period", "monthly")
    .gte("period_start", start)
    .lte("period_start", end);

  const inserts: any[] = [];
  for (const [month, colIdx] of monthColIndex.entries()) {
    const raw = targetRow[colIdx];
    const target = parseNumber(raw || 0);
    if (!target) continue;
    inserts.push({
      metric: "revenue",
      target_value: Math.round(target),
      period: "monthly",
      period_start: `${year}-${String(month).padStart(2, "0")}-01`,
      period_end: null,
    });
  }

  if (inserts.length === 0) return { updated: 0, year };

  const { error: insertError } = await supabase.from("targets").insert(inserts);
  if (insertError) throw insertError;

  return { updated: inserts.length, year };
}

// Parse month column header like "Jan 26", "Feb-26 Actual", "Mar 25"
function parseMonthHeader(header: string): { month: number; year: number; isActual: boolean } | null {
  if (!header) return null;
  const str = header.toString().toLowerCase().trim();
  
  // Match patterns like "jan 26", "feb-26 actual", "mar 25", "apr-25 actual"
  const match = str.match(/^([a-z]{3,9})[\s\-]?(\d{2,4})(?:\s*(actual))?/i);
  if (!match) return null;
  
  const monthName = match[1].toLowerCase();
  let year = parseInt(match[2]);
  const isActual = str.includes('actual');
  
  // Convert 2-digit year to 4-digit
  if (year < 100) year = 2000 + year;
  
  const month = MONTH_NAMES[monthName];
  if (!month) return null;
  
  return { month, year, isActual };
}

// P&L row identifiers to look for - checking column C (Description) and B
// Updated to match actual sheet format with Vietnamese labels
const PNL_ROW_IDENTIFIERS = {
  // Revenue categories (for breakdown)
  grossSales: ['1. gross sales', 'gross sales'],
  revenueWine: ['wine'],
  revenueSpirits: ['spirits'],
  revenueCocktails: ['cocktails'],
  revenueShisha: ['shisha'],
  revenueBeer: ['beer'],
  revenueFood: ['food'],
  revenueBalloons: ['balloons'],
  revenueOther: ['other (coke', 'other'],
  discounts: ['discounts'],
  foc: ['foc'],
  netSales: ['1.1 net sales', 'net sales'],
  serviceCharge: ['svc'],
  // COGS
  cogs: ['2. cost of goods', 'cost of goods (24% goal)', 'cost of goods', '2. cogs', 'cogs'],
  cogsWine: ['wine'],
  cogsSpirits: ['spirits'],
  cogsCocktails: ['cocktails'],
  cogsShisha: ['shisha'],
  cogsBeer: ['beer'],
  cogsFood: ['food'],
  cogsBalloons: ['balloons'],
  cogsOther: ['others'],
  // Labor - with Vietnamese support
  laborCost: ['3. direct labor', 'direct labor cost', 'chi phí nhân công'],
  laborSalary: ['salary', 'lương'],
  laborCasual: ['casual', 'extra shift', 'nhân viên thời vụ', 'ca làm thêm'],
  laborInsurance: ['social insurance', 'bảo hiểm xã hội'],
  labor13th: ['13th salary', 'lương tháng 13'],
  laborHoliday: ['public holiday', 'ngày lễ công cộng'],
  laborSvc: ['svc'],
  // Fixed costs
  fixedCosts: ['4. fixed operating', 'fixed operating cost'],
  fixedRental: ['rental', 'thuê'],
  fixedMaintenance: ['property maintenance', 'maintenance', 'bảo trì'],
  fixedAdmin: ['administrative', 'hành chính'],
  // OPEX
  opex: ['5. operating expenses', 'operating expenses'],
  opexConsumables: ['consumable', 'vật tư tiêu hao'],
  opexMarketing: ['marketing'],
  opexEvents: ['event'],
  // Other
  reserveFund: ['6. reserve fund', 'reserve fund', 'quỹ dự phòng'],
  totalExpenses: ['total company expenses', 'tổng chi phí'],
  grossProfit: ['gross operating profit', 'lợi nhuận gộp'],
  ebit: ['ebit'],
};

// Track which section we're in to disambiguate (e.g., Wine under Revenue vs COGS)
type SheetSection = 'revenue' | 'cogs' | 'labor' | 'fixed' | 'opex' | 'other';

// Check if row matches an identifier - now checks column C (index 2) as primary
function matchesIdentifier(row: string[], identifiers: string[]): boolean {
  // Column C (index 2) contains the Description in this sheet
  const colB = (row[1] || '').toString().toLowerCase().trim();
  const colC = (row[2] || '').toString().toLowerCase().trim();
  const combined = `${colB} ${colC}`.toLowerCase();
  
  for (const id of identifiers) {
    const idLower = id.toLowerCase();
    if (colC.includes(idLower) || colB.includes(idLower) || combined.includes(idLower)) {
      return true;
    }
  }
  return false;
}

// Determine section from row content OR from column A prefix (1.x, 2.x, 3.x, etc.)
function determineSection(row: string[]): SheetSection | null {
  const colA = (row[0] || '').toString().trim();
  const colB = (row[1] || '').toString().toLowerCase().trim();
  const colC = (row[2] || '').toString().toLowerCase().trim();
  const combined = `${colB} ${colC}`;
  
  // First check column A prefix - this is the most reliable indicator
  // Format: "1.x" = revenue, "2.x" = cogs, "3.x" = labor, "4.x" = fixed, "5.x" = opex
  if (colA.match(/^1\.\d/)) return 'revenue';
  if (colA.match(/^2\.\d/)) return 'cogs';
  if (colA.match(/^3\.\d/)) return 'labor';
  if (colA.match(/^4\.\d/)) return 'fixed';
  if (colA.match(/^5\.\d/)) return 'opex';
  
  // Also check section headers in column B/C for header rows
  if (combined.includes('gross sales') || combined.match(/^1\.?\s*gross/) || colB.match(/^1\.?\s*gross/) || colC.match(/^1\.?\s*gross/)) return 'revenue';
  if (combined.includes('cost of goods') || combined.includes('cogs') || combined.match(/^2\.?\s*(cost|cogs)/) || colB.match(/^2\.?\s*(cost|cogs)/) || colC.match(/^2\.?\s*(cost|cogs)/)) return 'cogs';
  if (combined.includes('direct labor') || combined.includes('chi phí nhân công') || combined.match(/^3\.?\s*(direct|labor)/i)) return 'labor';
  if (combined.includes('fixed operating') || combined.match(/^4\.?\s*fixed/)) return 'fixed';
  if (combined.includes('operating expenses') || combined.match(/^5\.?\s*operating/)) return 'opex';
  
  return null;
}

// Parse CSV text into 2D array
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++;
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      if (char === '\r') i++; // Skip \n after \r
    } else if (char === '\r' && !insideQuotes) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  
  // Handle last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  
  return rows;
}

// P&L Sync Handler
async function handlePnlSync(
  sheetId: string, 
  sheetName: string, 
  googleApiKey: string,
  supabase: any,
  csvUrl?: string,
  yearOverride?: number // Force all data to this year (handles inconsistent headers)
): Promise<Response> {
  let rows: string[][] = [];
  
  // If CSV URL provided, fetch from there (bypasses Google API cache)
  if (csvUrl) {
    console.log(`P&L Sync: Fetching from CSV URL: ${csvUrl}`);
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`CSV fetch error: ${res.status} ${res.statusText}`);
    const csvText = await res.text();
    rows = parseCSV(csvText);
    console.log(`P&L Sync: Parsed ${rows.length} rows from CSV`);
  } else {
    // Fallback to Google Sheets API
    const range = `${sheetName || "PnL 2026"}!A1:AZ100`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${googleApiKey}&valueRenderOption=FORMATTED_VALUE`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets API error: ${await res.text()}`);
    
    const data = await res.json();
    rows = data.values || [];
  }
  if (rows.length === 0) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: "No data found in sheet" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  console.log(`P&L Sync: Fetched ${rows.length} rows from ${sheetName}`);
  
  // Find header row (row with month names) - usually row 1 or 2
  // In this sheet, months start from column H (index 7)
  let headerRow: string[] = [];
  let headerRowIndex = -1;
  
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    // Check if any cell looks like a month header - start from column F (index 5) to be safe
    for (let j = 5; j < Math.min(row.length, 20); j++) {
      const parsed = parseMonthHeader(row[j]);
      if (parsed) {
        headerRow = row;
        headerRowIndex = i;
        console.log(`P&L Sync: Found header at row ${i}, first month at col ${j}: "${row[j]}"`);
        break;
      }
    }
    if (headerRowIndex >= 0) break;
  }
  
  if (headerRowIndex < 0) {
    // Return debugging info
    const firstFiveRows = rows.slice(0, 5).map((row: string[], idx: number) => ({
      rowIndex: idx,
      cells: row.slice(0, 20).map((cell: string, cellIdx: number) => ({ col: cellIdx, value: cell }))
    }));
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Could not find header row with month columns. Expected headers like 'Jan 25', 'Feb-25 Actual', etc.",
      debug: {
        totalRows: rows.length,
        firstFiveRows,
        hint: "Check that your P&L sheet has month headers (e.g., 'Jan 25', 'Jan-25 Actual') in the first 5 rows."
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  // Parse month columns from header (starting from column F/index 5, actual months may be at H/index 7)
  interface MonthColumn {
    index: number;
    month: number;
    year: number;
    isActual: boolean;
    header: string;
  }
  
  const monthColumns: MonthColumn[] = [];
  for (let i = 5; i < headerRow.length; i++) {
    const parsed = parseMonthHeader(headerRow[i]);
    if (parsed) {
      monthColumns.push({
        index: i,
        month: parsed.month,
        // Use yearOverride if provided (handles inconsistent headers in spreadsheet)
        year: yearOverride || parsed.year,
        isActual: parsed.isActual,
        header: headerRow[i],
      });
    }
  }
  
  if (yearOverride) {
    console.log(`P&L Sync: Using year override: ${yearOverride}`);
  }
  
  console.log(`P&L Sync: Found ${monthColumns.length} month columns`);
  
  // Detailed column mapping for debug
  const columnMapping = monthColumns.map(c => ({
    colIndex: c.index,
    colLetter: String.fromCharCode(65 + c.index), // A, B, C...
    header: c.header,
    year: c.year,
    month: c.month,
    isActual: c.isActual
  }));
  console.log('Column mapping:', JSON.stringify(columnMapping.slice(0, 10)));
  
  if (monthColumns.length === 0) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: "No valid month columns found in header row.",
      debug: {
        headerRowIndex,
        headerRowCells: headerRow.slice(0, 25),
        hint: "Month headers should be like 'Jan 25', 'Jan-25 Actual'. The format 'Jan 25' or 'Jan-25' with optional 'Actual' suffix is expected."
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  // Initialize data structure for each month/year
  interface PnlMonthData {
    year: number;
    month: number;
    // Revenue breakdown
    grossSales: number;
    revenueWine: number;
    revenueSpirits: number;
    revenueCocktails: number;
    revenueShisha: number;
    revenueBeer: number;
    revenueFood: number;
    revenueBalloons: number;
    revenueOther: number;
    discounts: number;
    foc: number;
    netSales: number;
    serviceCharge: number;
    // COGS breakdown
    cogs: number;
    cogsWine: number;
    cogsSpirits: number;
    cogsCocktails: number;
    cogsShisha: number;
    cogsBeer: number;
    cogsFood: number;
    cogsBalloons: number;
    cogsOther: number;
    // Labor breakdown
    laborCost: number;
    laborSalary: number;
    laborCasual: number;
    laborInsurance: number;
    labor13th: number;
    laborHoliday: number;
    laborSvc: number;
    // Fixed costs
    fixedCosts: number;
    fixedRental: number;
    fixedMaintenance: number;
    fixedAdmin: number;
    // OPEX
    opex: number;
    opexConsumables: number;
    opexMarketing: number;
    opexEvents: number;
    // Other
    reserveFund: number;
    totalExpenses: number;
    grossProfit: number;
    depreciation: number;
    otherIncome: number;
    otherExpenses: number;
    ebit: number;
    isActual: boolean;
  }
  
  const monthDataMap = new Map<string, PnlMonthData>();
  
  // Initialize all month columns
  for (const col of monthColumns) {
    const key = `${col.year}-${col.month}-${col.isActual}`;
    if (!monthDataMap.has(key)) {
      monthDataMap.set(key, {
        year: col.year,
        month: col.month,
        // Revenue breakdown
        grossSales: 0,
        revenueWine: 0,
        revenueSpirits: 0,
        revenueCocktails: 0,
        revenueShisha: 0,
        revenueBeer: 0,
        revenueFood: 0,
        revenueBalloons: 0,
        revenueOther: 0,
        discounts: 0,
        foc: 0,
        netSales: 0,
        serviceCharge: 0,
        // COGS breakdown
        cogs: 0,
        cogsWine: 0,
        cogsSpirits: 0,
        cogsCocktails: 0,
        cogsShisha: 0,
        cogsBeer: 0,
        cogsFood: 0,
        cogsBalloons: 0,
        cogsOther: 0,
        // Labor breakdown
        laborCost: 0,
        laborSalary: 0,
        laborCasual: 0,
        laborInsurance: 0,
        labor13th: 0,
        laborHoliday: 0,
        laborSvc: 0,
        // Fixed costs
        fixedCosts: 0,
        fixedRental: 0,
        fixedMaintenance: 0,
        fixedAdmin: 0,
        // OPEX
        opex: 0,
        opexConsumables: 0,
        opexMarketing: 0,
        opexEvents: 0,
        // Other
        reserveFund: 0,
        totalExpenses: 0,
        grossProfit: 0,
        depreciation: 0,
        otherIncome: 0,
        otherExpenses: 0,
        ebit: 0,
        isActual: col.isActual,
      });
    }
  }
  
  // Process each data row with section tracking
  // Track current section to disambiguate (e.g., Wine under Revenue vs COGS)
  let currentSection: SheetSection = 'revenue';
  let debugRawValues: any = null;
  const sectionChanges: Array<{row: number, from: string, to: string, trigger: string}> = [];
  
  // Debug: check first row after header (likely GROSS SALES)
  const grossSalesRow = rows[headerRowIndex + 1];
  const grossSalesDebug = grossSalesRow ? {
    rowIndex: headerRowIndex + 1,
    rowLength: grossSalesRow.length,
    colA: (grossSalesRow[0] || '').toString().substring(0, 30),
    colB: (grossSalesRow[1] || '').toString().substring(0, 40),
    colC: (grossSalesRow[2] || '').toString().substring(0, 30),
    janActualRaw: grossSalesRow[monthColumns[1]?.index],
    janActualParsed: parseNumber(grossSalesRow[monthColumns[1]?.index] || 0),
  } : null;
  
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    
    // Check for section headers
    const newSection = determineSection(row);
    if (newSection && newSection !== currentSection) {
      sectionChanges.push({
        row: i,
        from: currentSection,
        to: newSection,
        trigger: `colB="${(row[1] || '').toString().substring(0, 50)}" colC="${(row[2] || '').toString().substring(0, 50)}"`
      });
      currentSection = newSection;
      console.log(`P&L Sync: Entered section "${currentSection}" at row ${i}`);
    }
    
    // Get category label from columns A, B, C, and D (spreadsheet has mixed layouts)
    const colA = (row[0] || '').toString().toLowerCase().trim();
    const colB = (row[1] || '').toString().toLowerCase().trim();
    const colC = (row[2] || '').toString().toLowerCase().trim();
    const colD = (row[3] || '').toString().toLowerCase().trim();
    // Combine all columns for more robust matching
    const allColumns = `${colA} ${colB} ${colC} ${colD}`.toLowerCase();
    const categoryLabel = colC || colB || colA; // Primary label for logging
    if (!colA && !colB && !colC) continue;
    
    // Debug: capture first 5 data rows AND key rows
    if (!debugRawValues) {
      debugRawValues = {
        firstRows: [],
        keyRows: [],
        cogsAreaRows: [],
        laborRows: [],
        fixedRows: [],
        opexRows: [],
        grossSalesRow: grossSalesDebug
      };
    }
    
    // Capture ALL labor section rows to debug column structure
    if (currentSection === 'labor' && debugRawValues?.laborRows && debugRawValues.laborRows.length < 10) {
      debugRawValues.laborRows.push({
        rowIndex: i,
        colA: (row[0] || '').toString().substring(0, 20),
        colB: (row[1] || '').toString().substring(0, 40),
        colC: (row[2] || '').toString().substring(0, 40),
        colD: (row[3] || '').toString().substring(0, 40),
        colE: (row[4] || '').toString().substring(0, 20),
        allColumns: allColumns.substring(0, 80),
        rowLength: row.length,
        // Show raw values for budget and actual columns
        janBudget_H: row[7],
        janActual_I: row[8],
        marBudget_L: row[11],
        marActual_M: row[12],
      });
    }
    
    // Capture ALL fixed costs section rows to debug column structure
    if (currentSection === 'fixed' && debugRawValues?.fixedRows && debugRawValues.fixedRows.length < 15) {
      debugRawValues.fixedRows.push({
        rowIndex: i,
        colB: (row[1] || '').toString().substring(0, 40),
        colC: (row[2] || '').toString().substring(0, 50),
        colD: (row[3] || '').toString().substring(0, 50),
        allColumns: allColumns.substring(0, 100),
        marBudget_L: row[11],
        marActual_M: row[12],
      });
    }
    
    // Capture ALL OPEX section rows to debug column structure
    if (currentSection === 'opex' && debugRawValues?.opexRows && debugRawValues.opexRows.length < 20) {
      debugRawValues.opexRows.push({
        rowIndex: i,
        colB: (row[1] || '').toString().substring(0, 40),
        colC: (row[2] || '').toString().substring(0, 50),
        allColumns: allColumns.substring(0, 100),
        marBudget_L: row[11],
        marActual_M: row[12],
      });
    }
    // Capture first 5 data rows to see structure
    if (i <= headerRowIndex + 5 && debugRawValues?.firstRows) {
      debugRawValues.firstRows.push({
        rowIndex: i,
        colA: (row[0] || '').toString().substring(0, 20),
        colB: (row[1] || '').toString().substring(0, 30),
        colC: (row[2] || '').toString().substring(0, 20),
        categoryLabel: categoryLabel.substring(0, 30),
        rowLength: row.length
      });
    }
    // Capture key financial rows
    const isGrossSales = categoryLabel.includes('gross sales') || categoryLabel.match(/^1\.?\s*gross/);
    const isNetSales = categoryLabel.includes('net sales');
    const isEbit = categoryLabel === 'ebit' || categoryLabel === 'ebi';
    const isWine = categoryLabel === 'wine';
    const isCOGSTotal = categoryLabel.includes('cost of goods') || categoryLabel.includes('cogs') || categoryLabel.match(/^2\.?\s*(cost|cogs)/);
    const isSalary = allColumns.includes('salary') || allColumns.includes('lương');
    const isLaborSection = currentSection === 'labor';
    
    if ((isGrossSales || isNetSales || isEbit || isWine || (isSalary && isLaborSection)) && debugRawValues?.keyRows) {
      // Show all columns from F onwards to find the right value
      const showAllCols = isEbit || isWine || isSalary;
      const allCols = showAllCols ? row.slice(5, 15).map((v: any, idx: number) => ({
        colIdx: idx + 5,
        colLetter: String.fromCharCode(65 + idx + 5), // F, G, H, I, J...
        raw: v,
        parsed: parseNumber(v || 0)
      })) : undefined;
      
      debugRawValues.keyRows.push({
        rowIndex: i,
        colB: (row[1] || '').toString().substring(0, 40),
        colC: (row[2] || '').toString().substring(0, 40),
        colD: (row[3] || '').toString().substring(0, 40),
        categoryLabel: categoryLabel.substring(0, 30),
        section: currentSection,
        type: isGrossSales ? 'GROSS_SALES' : (isNetSales ? 'NET_SALES' : (isEbit ? 'EBIT' : (isSalary ? 'SALARY' : 'WINE'))),
        janBudgetColIndex: monthColumns[0]?.index,
        janBudgetRaw: row[monthColumns[0]?.index],
        janBudgetParsed: parseNumber(row[monthColumns[0]?.index] || 0),
        janActualColIndex: monthColumns[1]?.index,
        janActualRaw: row[monthColumns[1]?.index],
        janActualParsed: parseNumber(row[monthColumns[1]?.index] || 0),
        marBudgetColIndex: monthColumns[4]?.index,
        marBudgetRaw: row[monthColumns[4]?.index],
        marBudgetParsed: parseNumber(row[monthColumns[4]?.index] || 0),
        ...(allCols && { allColumns: allCols })
      });
    }
    
    // Capture COGS area rows (rows 12-20, approximately where COGS header should be)
    if (i >= 12 && i <= 20 && debugRawValues?.cogsAreaRows) {
      debugRawValues.cogsAreaRows.push({
        rowIndex: i,
        section: currentSection,
        colA: (row[0] || '').toString().substring(0, 30),
        colB: (row[1] || '').toString().substring(0, 40),
        colC: (row[2] || '').toString().substring(0, 30),
        categoryLabel: categoryLabel.substring(0, 40),
        isCOGSTotal,
        janActualRaw: row[monthColumns[1]?.index],
        janActualParsed: parseNumber(row[monthColumns[1]?.index] || 0),
      });
    }
    
    // Extract values for each month column
    for (const col of monthColumns) {
      const value = parseNumber(row[col.index] || 0);
      const key = `${col.year}-${col.month}-${col.isActual}`;
      const data = monthDataMap.get(key);
      
      if (data && value !== 0) {
        // Map based on section and category - use allColumns for robust matching
        // Revenue section items (top of sheet)
        if (currentSection === 'revenue') {
          if (allColumns.includes('gross sales') || colA.match(/^1\.?\s*gross/)) {
            data.grossSales = value;
          } else if (colB === 'wine' || allColumns.includes('wine')) {
            data.revenueWine = value;
          } else if (colB === 'spirits' || allColumns.includes('spirit')) {
            data.revenueSpirits = value;
          } else if (colB === 'cocktails' || allColumns.includes('cocktail')) {
            data.revenueCocktails = value;
          } else if (colB === 'shisha' || allColumns.includes('shisha')) {
            data.revenueShisha = value;
          } else if (colB === 'beer' || allColumns.includes('beer')) {
            data.revenueBeer = value;
          } else if (colB === 'food' || allColumns.includes('food')) {
            data.revenueFood = value;
          } else if (colB === 'balloons' || allColumns.includes('balloon')) {
            data.revenueBalloons = value;
          } else if (allColumns.includes('other (coke') || (colB.includes('other') && !allColumns.includes('cogs'))) {
            data.revenueOther = value;
          } else if (colB === 'discounts' || allColumns.includes('discount')) {
            data.discounts = value;
          } else if (colB === 'foc' || allColumns.includes('foc')) {
            data.foc = value;
          } else if (allColumns.includes('net sales') || colA.match(/^1\.1/)) {
            data.netSales = value;
          } else if (colB === 'svc' && !allColumns.includes('labor')) {
            data.serviceCharge = value;
          }
        }
        // COGS section
        else if (currentSection === 'cogs') {
          if (allColumns.includes('cost of goods') || colA.match(/^2\.?\s*$/) || allColumns.match(/^2\.?\s*(cost|cogs)/i)) {
            data.cogs = value;
          } else if (colB === 'wine' || colC === 'wine') {
            data.cogsWine = value;
          } else if (colB === 'spirits' || colC === 'spirits') {
            data.cogsSpirits = value;
          } else if (colB === 'cocktails' || colC === 'cocktails') {
            data.cogsCocktails = value;
          } else if (colB === 'shisha' || colC === 'shisha') {
            data.cogsShisha = value;
          } else if (colB === 'beer' || colC === 'beer') {
            data.cogsBeer = value;
          } else if (colB === 'food' || colC === 'food') {
            data.cogsFood = value;
          } else if (colB === 'balloons' || colC === 'balloons') {
            data.cogsBalloons = value;
          } else if (colB === 'others' || allColumns.includes('other')) {
            data.cogsOther = value;
          }
        }
        // Labor section - use allColumns for better matching
        // IMPORTANT: Check specific items FIRST before generic "salary" to avoid overwrites
        else if (currentSection === 'labor') {
          // Check section total first
          if (allColumns.includes('direct labor') || allColumns.includes('chi phí nhân công') || colA.match(/^3\.?\s*$/)) {
            data.laborCost = value;
          } 
          // Check 13th salary BEFORE generic salary (contains "salary" in name)
          else if (allColumns.includes('13th salary') || allColumns.includes('lương tháng 13') || allColumns.includes('tháng 13') || colB === '3.4') {
            data.labor13th = value;
          }
          // Check casual/extra shift
          else if (allColumns.includes('casual') || allColumns.includes('extra shift') || allColumns.includes('thời vụ') || allColumns.includes('ca làm thêm') || colB === '3.2') {
            data.laborCasual = value;
          }
          // Check social insurance (note: spreadsheet has typo "insurence")
          else if (allColumns.includes('social insur') || allColumns.includes('bảo hiểm xã hội') || colB === '3.3') {
            data.laborInsurance = value;
          }
          // Check public holiday
          else if (allColumns.includes('public holiday') || allColumns.includes('ngày lễ') || colB === '3.5') {
            data.laborHoliday = value;
          }
          // Check SVC in labor section
          else if ((colC === 'svc' || colB === '3.6') && currentSection === 'labor') {
            data.laborSvc = value;
          }
          // NOW check generic salary (3.1) - only if none of the above matched
          else if ((allColumns.includes('salary') || allColumns.includes('lương')) && colB === '3.1') {
            data.laborSalary = value;
          }
        }
        // Fixed costs section
        // NOTE: Row numbers are in colB (e.g., "4.1", "4.2"), not colA (which is empty)
        // IMPORTANT: Only match exact row numbers to avoid sub-items (4.2.1, 4.2.2) overwriting parent values
        else if (currentSection === 'fixed') {
          // Check if this is a sub-item (contains second decimal like 4.1.1, 4.2.1, etc.)
          const isSubItem = colB.match(/^4\.\d\.\d/);
          
          // Section total
          if (allColumns.includes('fixed operating') || allColumns.includes('chi phí hoạt động cố định')) {
            data.fixedCosts = value;
          } 
          // 4.1 Rental & Utilities - EXACT match only, not sub-items
          else if (colB === '4.1') {
            data.fixedRental = value;
          }
          // 4.2 Property Maintenance & Security - EXACT match only, not sub-items
          else if (colB === '4.2') {
            data.fixedMaintenance = value;
          }
          // 4.3 Administrative Costs - EXACT match only, not sub-items
          else if (colB === '4.3') {
            data.fixedAdmin = value;
          }
        }
        // OPEX section
        // NOTE: Row numbers are in colB (e.g., "5.1", "5.2"), not colA
        // IMPORTANT: Only match exact row numbers to avoid sub-items (5.1.1, 5.2.1) overwriting parent values
        else if (currentSection === 'opex') {
          // Section total
          if (allColumns.includes('operating expenses') || allColumns.includes('chi phí hoạt động')) {
            data.opex = value;
          }
          // 5.1 Consumable & Supplies - EXACT match only
          else if (colB === '5.1') {
            data.opexConsumables = value;
          }
          // 5.2 Marketing & Advertisement - EXACT match only
          else if (colB === '5.2') {
            data.opexMarketing = value;
          }
          // 5.3 Event & Entertainment - EXACT match only
          else if (colB === '5.3') {
            data.opexEvents = value;
          }
        }
        
        // These can appear in any section or at the end - CHECK INDEPENDENTLY (not else-if)
        // Use allColumns for robust matching
        
        // COGS total - check independently since section detection may fail
        if ((allColumns.includes('cost of goods') || colA.match(/^2\.?\s*$/) || allColumns.match(/^2\.?\s*(cost|cogs)/i)) && value > 0 && !colA.match(/^2\.\d/)) {
          data.cogs = value;
          console.log(`P&L Sync: Found COGS total: ${value} from row "${colA}|${colB}"`);
        }
        
        // Reserve fund section
        if (allColumns.includes('reserve fund') || allColumns.includes('quỹ dự trữ') || colA.match(/^6\.?\s*$/)) {
          data.reserveFund = value;
        }
        
        // Labor total - check independently (only for total row, not breakdown)
        if ((allColumns.includes('direct labor') || colA.match(/^3\.?\s*$/)) && value > 0 && !colA.match(/^3\.\d/)) {
          data.laborCost = value;
          console.log(`P&L Sync: Found Labor total: ${value} from row "${colA}|${colB}"`);
        }
        
        // Fixed costs total - check independently
        if ((allColumns.includes('fixed operating') || colA.match(/^4\.?\s*$/)) && value > 0 && !colA.match(/^4\.\d/)) {
          data.fixedCosts = value;
          console.log(`P&L Sync: Found Fixed total: ${value} from row "${colA}|${colB}"`);
        }
        
        // OPEX total - check independently
        if ((allColumns.includes('operating expenses') || colA.match(/^5\.?\s*$/)) && value > 0 && !colA.match(/^5\.\d/)) {
          data.opex = value;
          console.log(`P&L Sync: Found OPEX total: ${value} from row "${colA}|${colB}"`);
        }
        
        // Summary rows at the end of the sheet
        if (allColumns.includes('total company expenses') || allColumns.includes('tổng chi phí')) {
          data.totalExpenses = value;
        }
        if (allColumns.includes('gross operating profit') || allColumns.includes('lợi nhuận gộp')) {
          data.grossProfit = value;
        }
        if (colB === 'ebit' || allColumns.includes('ebit')) {
          data.ebit = value;
          console.log(`P&L Sync: Found EBIT: ${value} from row "${colA}|${colB}"`);
        }
        if (allColumns.includes('depreciation') || allColumns.includes('khấu hao')) {
          data.depreciation = value;
        }
        if (allColumns.includes('other income') || allColumns.includes('thu nhập khác')) {
          data.otherIncome = value;
        }
        if (allColumns.includes('other expenses') || allColumns.includes('chi phí khác')) {
          data.otherExpenses = value;
        }
      }
    }
  }
  
  // Upsert data to pnl_monthly table
  let processed = 0;
  let errors: string[] = [];
  
  // Debug: Get actual data for multiple months including labor breakdown
  const getMonthDebug = (key: string) => {
    const d = monthDataMap.get(key);
    if (!d) return null;
    return {
      grossSales: d.grossSales,
      netSales: d.netSales,
      cogs: d.cogs,
      // Labor breakdown - critical for debugging
      laborCost: d.laborCost,
      laborSalary: d.laborSalary,
      laborCasual: d.laborCasual,
      laborInsurance: d.laborInsurance,
      labor13th: d.labor13th,
      laborHoliday: d.laborHoliday,
      laborSvc: d.laborSvc,
      // Fixed costs breakdown
      fixedCosts: d.fixedCosts,
      fixedRental: d.fixedRental,
      fixedMaintenance: d.fixedMaintenance,
      fixedAdmin: d.fixedAdmin,
      // OPEX breakdown
      opex: d.opex,
      opexConsumables: d.opexConsumables,
      opexMarketing: d.opexMarketing,
      opexEvents: d.opexEvents,
      // Totals
      totalExpenses: d.totalExpenses,
      grossProfit: d.grossProfit,
      ebit: d.ebit,
    };
  };
  
  const debugSample = {
    mar2025Budget: getMonthDebug('2025-3-false'),
    mar2025Actual: getMonthDebug('2025-3-true'),
    jan2025Budget: getMonthDebug('2025-1-false'),
    jan2025Actual: getMonthDebug('2025-1-true'),
    // Show all keys in the map for debugging
    allMonthKeys: Array.from(monthDataMap.keys()),
  };
  
  for (const data of monthDataMap.values()) {
    // Skip if no meaningful data - check if ANY revenue or expense data exists
    const hasRevenueData = data.grossSales > 0 || data.netSales > 0 || 
                           data.revenueWine > 0 || data.revenueSpirits > 0 || 
                           data.revenueFood > 0 || data.revenueCocktails > 0;
    const hasExpenseData = data.cogs > 0 || data.laborCost > 0 || data.totalExpenses > 0;
    
    if (!hasRevenueData && !hasExpenseData) {
      continue;
    }
    
    // If we have revenue breakdown but no grossSales, calculate it
    if (data.grossSales === 0) {
      data.grossSales = data.revenueWine + data.revenueSpirits + data.revenueCocktails + 
                        data.revenueShisha + data.revenueBeer + data.revenueFood + 
                        data.revenueBalloons + data.revenueOther;
    }
    
    // Calculate OPEX total from individual values (more reliable than reading from spreadsheet)
    const calculatedOpex = data.opexConsumables + data.opexMarketing + data.opexEvents;
    if (calculatedOpex > 0 && (data.opex === 0 || calculatedOpex > data.opex * 2)) {
      // If calculated is significantly different from read value, use calculated
      console.log(`P&L Sync: Recalculating OPEX for ${data.year}-${data.month}: ${data.opex} -> ${calculatedOpex}`);
      data.opex = calculatedOpex;
    }
    
    // Calculate Fixed costs total from individual values
    const calculatedFixed = data.fixedRental + data.fixedMaintenance + data.fixedAdmin;
    if (calculatedFixed > 0 && (data.fixedCosts === 0 || calculatedFixed > data.fixedCosts * 2)) {
      console.log(`P&L Sync: Recalculating Fixed for ${data.year}-${data.month}: ${data.fixedCosts} -> ${calculatedFixed}`);
      data.fixedCosts = calculatedFixed;
    }
    
    // Calculate percentages
    const cogsPercentage = data.netSales > 0 ? (data.cogs / data.netSales) * 100 : 0;
    const laborPercentage = data.netSales > 0 ? (data.laborCost / data.netSales) * 100 : 0;
    const grossMargin = data.netSales > 0 ? (data.grossProfit / data.netSales) * 100 : 0;
    const ebitMargin = data.netSales > 0 ? (data.ebit / data.netSales) * 100 : 0;
    
    const upsertData = {
      year: data.year,
      month: data.month,
      // Revenue breakdown
      gross_sales: Math.round(data.grossSales),
      revenue_wine: Math.round(data.revenueWine),
      revenue_spirits: Math.round(data.revenueSpirits),
      revenue_cocktails: Math.round(data.revenueCocktails),
      revenue_shisha: Math.round(data.revenueShisha),
      revenue_beer: Math.round(data.revenueBeer),
      revenue_food: Math.round(data.revenueFood),
      revenue_balloons: Math.round(data.revenueBalloons),
      revenue_other: Math.round(data.revenueOther),
      discounts: Math.round(data.discounts),
      foc: Math.round(data.foc),
      net_sales: Math.round(data.netSales),
      service_charge: Math.round(data.serviceCharge),
      // COGS breakdown
      cogs: Math.round(data.cogs),
      cogs_wine: Math.round(data.cogsWine),
      cogs_spirits: Math.round(data.cogsSpirits),
      cogs_cocktails: Math.round(data.cogsCocktails),
      cogs_shisha: Math.round(data.cogsShisha),
      cogs_beer: Math.round(data.cogsBeer),
      cogs_food: Math.round(data.cogsFood),
      cogs_balloons: Math.round(data.cogsBalloons),
      cogs_other: Math.round(data.cogsOther),
      // Labor breakdown
      labor_cost: Math.round(data.laborCost),
      labor_salary: Math.round(data.laborSalary),
      labor_casual: Math.round(data.laborCasual),
      labor_insurance: Math.round(data.laborInsurance),
      labor_13th_month: Math.round(data.labor13th),
      labor_holiday: Math.round(data.laborHoliday),
      labor_svc: Math.round(data.laborSvc),
      // Fixed costs
      fixed_costs: Math.round(data.fixedCosts),
      fixed_rental: Math.round(data.fixedRental),
      fixed_maintenance: Math.round(data.fixedMaintenance),
      fixed_admin: Math.round(data.fixedAdmin),
      // OPEX
      opex: Math.round(data.opex),
      opex_consumables: Math.round(data.opexConsumables),
      opex_marketing: Math.round(data.opexMarketing),
      opex_events: Math.round(data.opexEvents),
      // Other
      reserve_fund: Math.round(data.reserveFund),
      total_expenses: Math.round(data.totalExpenses),
      gross_profit: Math.round(data.grossProfit),
      // Note: depreciation, other_income, other_expenses columns need migration 008
      // depreciation: Math.round(data.depreciation),
      // other_income: Math.round(data.otherIncome),
      // other_expenses: Math.round(data.otherExpenses),
      // EBIT: Skip if it's the known cached bad value from Google Sheets for Jan 2025
      // The correct value is -131,441,604 but Google returns cached -161,057,604
      ...(!(data.year === 2025 && data.month === 1 && data.isActual && Math.abs(data.ebit + 161057604) < 1000) && { ebit: Math.round(data.ebit) }),
      // Percentages
      cogs_percentage: Math.round(cogsPercentage * 100) / 100,
      labor_percentage: Math.round(laborPercentage * 100) / 100,
      gross_margin: Math.round(grossMargin * 100) / 100,
      ebit_margin: Math.round(ebitMargin * 100) / 100,
      // Metadata
      data_type: data.isActual ? 'actual' : 'budget',
      synced_at: new Date().toISOString(),
    };
    
    // Skip Jan 2025 budget entirely - Google Sheets API returns cached incorrect values
    // We've manually corrected the budget values, don't overwrite them
    if (data.year === 2025 && data.month === 1 && !data.isActual) {
      console.log(`P&L Sync: Skipping Jan 2025 budget - using manually corrected values`);
      processed++;
      continue;
    }
    
    console.log(`P&L Sync: Attempting upsert for ${data.year}-${data.month} (${data.isActual ? 'actual' : 'budget'})`);
    
    const { error: insertError, data: insertResult } = await supabase.from("pnl_monthly").upsert(
      upsertData,
      { onConflict: "year,month,data_type" }
    ).select();
    
    if (insertError) {
      console.error(`P&L Sync: Insert error for ${data.year}-${data.month}: ${insertError.message} (code: ${insertError.code})`);
      if (errors.length < 5) {
        errors.push(`Insert error for ${data.year}-${data.month}: ${insertError.message} (code: ${insertError.code})`);
      }
    } else {
      console.log(`P&L Sync: Successfully upserted ${data.year}-${data.month}, rows:`, insertResult?.length || 0);
      processed++;
    }
  }
  
  // Verify data was saved by querying with service role
  const { data: verifyData, error: verifyError } = await supabase
    .from("pnl_monthly")
    .select("year,month,data_type,gross_sales")
    .limit(3);
  
  console.log(`P&L Sync: Verification query - found ${verifyData?.length || 0} rows, error: ${verifyError?.message || 'none'}`);
  
  // Log sync to sync_logs
  await supabase.from("sync_logs").insert({
    sync_type: 'pnl',
    sheet_name: sheetName,
    status: errors.length > 0 ? 'partial' : 'success',
    rows_processed: processed,
    error_message: errors.length > 0 ? errors.join('; ') : null,
  });
  
  // Collect sample of matched categories for debugging
  const categoriesFound: string[] = [];
  for (let i = headerRowIndex + 1; i < Math.min(rows.length, headerRowIndex + 50); i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    for (const [key, identifiers] of Object.entries(PNL_ROW_IDENTIFIERS)) {
      if (matchesIdentifier(row, identifiers)) {
        if (!categoriesFound.includes(key)) {
          categoriesFound.push(key);
        }
        break;
      }
    }
  }

  return new Response(JSON.stringify({
    success: processed > 0,
    processed,
    totalMonths: monthDataMap.size,
    monthColumns: monthColumns.map(c => c.header),
    categoriesFound,
    errors: errors.length > 0 ? errors : undefined,
    dbVerification: {
      rowsFound: verifyData?.length || 0,
      error: verifyError?.message || null,
      sample: verifyData?.slice(0, 2) || [],
    },
    debug: {
      hint: processed === 0 ? "No data was inserted. Check that P&L categories match expected labels." : "Data inserted successfully",
      totalRows: rows.length,
      sampleMonthData: debugSample,
      rawValuesSample: debugRawValues,
      sectionChanges: sectionChanges.slice(0, 6), // Show first 6 section changes
      // Show ALL column details for debugging
      monthColumnDetails: monthColumns.map(c => ({
        header: c.header,
        colLetter: String.fromCharCode(65 + c.index),
        index: c.index,
        year: c.year,
        month: c.month,
        isActual: c.isActual
      })),
      // Summary of actual vs budget columns
      actualColumns: monthColumns.filter(c => c.isActual).map(c => `${c.month}/${c.year}`),
      budgetColumns: monthColumns.filter(c => !c.isActual).map(c => `${c.month}/${c.year}`),
      // Raw header row from Google Sheets API (columns F onwards)
      rawHeaderRow: headerRow.slice(5, 35).map((h: string, i: number) => ({
        colLetter: String.fromCharCode(70 + i), // F, G, H...
        index: i + 5,
        header: h
      })),
    },
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { sheetId, sheetName, syncType = 'sales', action, year, month, dataType, updates, csvUrl, yearOverride } = body;
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle debug query to inspect stored data
    if (action === 'debug_query') {
      const targetYear = year || 2025;
      const targetMonth = month || 3;
      const targetDataType = dataType || 'budget';
      
      const { data: rows, error: queryError } = await supabase
        .from("pnl_monthly")
        .select('*')
        .eq('year', targetYear)
        .eq('month', targetMonth)
        .eq('data_type', targetDataType);
      
      if (queryError) throw queryError;
      
      const row = rows?.[0];
      if (!row) {
        return new Response(JSON.stringify({
          success: false,
          message: `No data found for ${targetYear}-${targetMonth} (${targetDataType})`,
          query: { year: targetYear, month: targetMonth, dataType: targetDataType }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Return detailed breakdown of stored values
      return new Response(JSON.stringify({
        success: true,
        query: { year: targetYear, month: targetMonth, dataType: targetDataType },
        data: {
          // Labor breakdown
          labor_cost: row.labor_cost,
          labor_salary: row.labor_salary,
          labor_casual: row.labor_casual,
          labor_insurance: row.labor_insurance,
          labor_13th_month: row.labor_13th_month,
          labor_holiday: row.labor_holiday,
          labor_svc: row.labor_svc,
          // OPEX breakdown
          opex: row.opex,
          opex_consumables: row.opex_consumables,
          opex_marketing: row.opex_marketing,
          opex_events: row.opex_events,
          // Fixed costs breakdown
          fixed_costs: row.fixed_costs,
          fixed_rental: row.fixed_rental,
          fixed_maintenance: row.fixed_maintenance,
          fixed_admin: row.fixed_admin,
          // Revenue
          gross_sales: row.gross_sales,
          net_sales: row.net_sales,
          // COGS
          cogs: row.cogs,
          // Totals
          total_expenses: row.total_expenses,
          gross_profit: row.gross_profit,
          ebit: row.ebit,
          // Metadata
          synced_at: row.synced_at,
        },
        raw: row,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle manual corrections (upsert - insert if not exists, update if exists)
    if (action === 'correct') {
      if (!year || !month || !updates) {
        throw new Error("year, month, and updates are required for corrections");
      }
      
      const targetDataType = dataType || 'actual';
      
      // First, check if the row exists
      const { data: existingRows, error: selectError } = await supabase
        .from("pnl_monthly")
        .select('id, cogs, ebit, gross_sales')
        .eq('year', year)
        .eq('month', month)
        .eq('data_type', targetDataType);
      
      if (selectError) throw selectError;
      
      let result;
      let beforeData = null;
      
      if (!existingRows || existingRows.length === 0) {
        // INSERT new row
        const insertData = {
          year,
          month,
          data_type: targetDataType,
          synced_at: new Date().toISOString(),
          // Set defaults for required fields
          gross_sales: 0,
          net_sales: 0,
          cogs: 0,
          labor_cost: 0,
          fixed_costs: 0,
          opex: 0,
          total_expenses: 0,
          gross_profit: 0,
          ebit: 0,
          ...updates  // Override with provided values
        };
        
        const { data: insertedRows, error: insertError } = await supabase
          .from("pnl_monthly")
          .insert(insertData)
          .select('id, cogs, ebit, gross_sales');
        
        if (insertError) throw insertError;
        result = insertedRows?.[0];
        console.log(`Inserted new row for ${year}-${month} (${targetDataType}):`, result);
      } else {
        // UPDATE existing row
        const rowId = existingRows[0].id;
        beforeData = { cogs: existingRows[0].cogs, ebit: existingRows[0].ebit, gross_sales: existingRows[0].gross_sales };
        console.log(`Updating row ${rowId} with:`, updates);
        
        const { data: updatedRows, error: updateError } = await supabase
          .from("pnl_monthly")
          .update(updates)
          .eq('id', rowId)
          .select('id, cogs, ebit, gross_sales');
        
        if (updateError) throw updateError;
        result = updatedRows?.[0];
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: beforeData ? `Updated ${year}-${month} (${targetDataType})` : `Inserted ${year}-${month} (${targetDataType})`,
        rowId: result?.id,
        before: beforeData,
        after: result,
        updates
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sheetId) throw new Error("sheetId is required");

    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!googleApiKey) throw new Error("GOOGLE_API_KEY not configured. Set it in Edge Function secrets.");

    // Route to appropriate sync handler
    if (syncType === 'pnl') {
      return await handlePnlSync(sheetId, sheetName, googleApiKey, supabase, csvUrl, yearOverride);
    }

    // Default: Sales sync (existing logic)
    const range = `${sheetName || "Sales26*"}!A16:AF386`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${googleApiKey}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets API error: ${await res.text()}`);

    const { values: rows = [] } = await res.json();
    let processed = 0;
    let skipped = 0;
    let errors: string[] = [];
    
    console.log(`Fetched ${rows.length} rows from sheet`);

    for (const row of rows) {
      // Sales26* sheet has 2 empty columns at start, so date is at index 2
      // Check both index 0 and index 2 for date
      let dateStr = (row[0] || "").toString().trim();
      let dateIndex = 0;
      
      // If column A is empty, check column C (index 2)
      if (!dateStr || dateStr.match(/^[A-Za-z]{3,}$/)) {
        dateStr = (row[2] || "").toString().trim();
        dateIndex = 2;
      }
      
      // Skip KW rows (week summaries), month labels, and empty rows
      if (dateStr.startsWith("KW") || dateStr.match(/^[A-Za-z]{3,}$/) || !dateStr) {
        skipped++;
        continue;
      }
      
      const date = parseDate(dateStr);
      if (!date) {
        // Log first few non-parseable rows for debugging
        if (errors.length < 5) {
          errors.push(`Cannot parse date: "${dateStr}"`);
        }
        skipped++;
        continue;
      }

      // Column mapping:
      // H(7)=TotalRevenue, AC(28)=Pax, AD(29)=GoogleReviews, AE(30)=GoogleStars
      // Sales25*: AD(29)=AvgSpend | Sales26*: AF(31)=AvgSpend
      const totalRevenue = parseNumber(row[7] || 0);   // Column H - Daily Total Revenue VND
      const pax = parseInt(row[28] || "0") || 0;       // Column AC - Pax
      const isSales25 = (sheetName || "").toLowerCase().includes("25");
      const avgSpend = parseNumber(row[isSales25 ? 29 : 31] || 0);  // AD for Sales25, AF for Sales26
      
      // Google Reviews data (Sales26* only - columns AD and AE)
      const googleReviewCount = !isSales25 ? (parseInt(row[29] || "0") || 0) : 0;  // Column AD
      const googleRatingStr = !isSales25 ? (row[30] || "").toString().replace("*", "") : "0";  // Column AE
      const googleRating = parseFloat(googleRatingStr) || 0;

      // Skip rows with no meaningful data
      if (totalRevenue === 0 && pax === 0) {
        skipped++;
        continue;
      }

      // Build upsert object
      const upsertData: Record<string, unknown> = {
        date,
        revenue: Math.round(totalRevenue),
        pax,
        avg_spend: Math.round(avgSpend),
      };
      
      // Add Google review data if available
      if (googleRating > 0) upsertData.google_rating = googleRating;
      if (googleReviewCount > 0) upsertData.google_review_count = googleReviewCount;

      const { error: insertError } = await supabase.from("daily_metrics").upsert(
        upsertData, 
        { onConflict: "date" }
      );

      if (insertError) {
        if (errors.length < 5) {
          errors.push(`Insert error for ${date}: ${insertError.message}`);
        }
      } else {
        processed++;
      }
    }

    // Also sync monthly targets (Sales26 row 6) into `targets` table.
    // This powers Monthly Performance "This month" + 3/6/12m target bars.
    let monthlyTargets = { updated: 0, year: inferSalesYear(sheetName) };
    try {
      monthlyTargets = await syncSalesMonthlyTargetsFromRow6(sheetId, sheetName, googleApiKey, supabase);
    } catch (e) {
      console.log(`Sales target sync skipped/failed: ${(e as Error)?.message || e}`);
    }

    // Find rows with actual revenue data for debugging
    let sampleWithData = null;
    let processedDates: string[] = [];
    
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const r = rows[i];
      let dateStr = (r[0] || "").toString().trim();
      let dateIndex = 0;
      
      if (!dateStr || !dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
        dateStr = (r[2] || "").toString().trim();
        dateIndex = 2;
      }
      
      if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
        const offset = dateIndex;
        const rev = parseNumber(r[3 + offset] || 0);
        if (rev > 0 && !sampleWithData) {
          sampleWithData = { row: i, date: dateStr, offset, data: r.slice(0, 25) };
        }
        if (processedDates.length < 5 && rev > 0) {
          processedDates.push(`${dateStr}: rev=${rev}`);
        }
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      processed,
      skipped,
      totalRows: rows.length,
      errors: errors.length > 0 ? errors : undefined,
      monthlyTargets,
      sampleRow: rows.length > 0 ? rows[0]?.slice(0, 10) : null,
      sampleWithData,
      processedDates
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
