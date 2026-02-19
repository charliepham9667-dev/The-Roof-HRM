/**
 * Formatters for The Roof HRM
 * Currency in VND, dates in Vietnamese format
 */

// Format currency in Vietnamese Dong (₫)
// e.g., 848000000 -> "848M đ"
export function formatCurrency(amount: number, options?: { compact?: boolean; showSymbol?: boolean }): string {
  const { compact = true, showSymbol = true } = options || {};
  
  const symbol = showSymbol ? ' đ' : '';
  
  if (compact) {
    if (amount >= 1_000_000_000) {
      return `${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B${symbol}`;
    }
    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M${symbol}`;
    }
    if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(1).replace(/\.0$/, '')}K${symbol}`;
    }
  }
  
  return new Intl.NumberFormat('vi-VN').format(amount) + symbol;
}

// Format percentage
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Format date in Vietnamese format (DD/MM/YYYY)
export function formatDate(dateStr: string | Date, options?: {
  format?: 'short' | 'medium' | 'long';
  includeTime?: boolean;
}): string {
  const { format = 'medium', includeTime = false } = options || {};
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  
  const formatOptions: Intl.DateTimeFormatOptions = {};
  
  switch (format) {
    case 'short':
      formatOptions.day = '2-digit';
      formatOptions.month = '2-digit';
      break;
    case 'medium':
      formatOptions.day = 'numeric';
      formatOptions.month = 'short';
      formatOptions.year = 'numeric';
      break;
    case 'long':
      formatOptions.weekday = 'long';
      formatOptions.day = 'numeric';
      formatOptions.month = 'long';
      formatOptions.year = 'numeric';
      break;
  }
  
  if (includeTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
  }
  
  return date.toLocaleDateString('vi-VN', formatOptions);
}

// Format time (HH:mm)
export function formatTime(timeStr: string | Date): string {
  const date = typeof timeStr === 'string' ? new Date(timeStr) : timeStr;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Format relative time (e.g., "2 hours ago", "3 days ago")
export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  
  return formatDate(date, { format: 'short' });
}

// Format number with abbreviation
export function formatNumber(num: number, decimals: number = 0): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

// Format duration in hours and minutes
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Format phone number (Vietnamese format)
export function formatPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Vietnamese format: 0xxx xxx xxx
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  
  // International format: +84 xxx xxx xxx
  if (digits.length === 11 && digits.startsWith('84')) {
    return `+84 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  
  return phone;
}
