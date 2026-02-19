import { ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, AlertCircle } from 'lucide-react';

const formatVND = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B đ`;
  if (value >= 1000000) return `${Math.round(value / 1000000)}M đ`;
  return `${value.toLocaleString()} đ`;
};

const cashFlowData = {
  openingBalance: 1250000000,
  closingBalance: 1485000000,
  netChange: 235000000,
  inflows: [
    { category: 'Sales Revenue', amount: 794000000 },
    { category: 'Event Bookings', amount: 80000000 },
    { category: 'Other Income', amount: 15000000 },
  ],
  outflows: [
    { category: 'Inventory Purchases', amount: 238000000 },
    { category: 'Payroll', amount: 186000000 },
    { category: 'Rent & Utilities', amount: 95000000 },
    { category: 'Marketing', amount: 45000000 },
    { category: 'Operating Expenses', amount: 72000000 },
    { category: 'Tax Payments', amount: 18000000 },
  ],
};

const upcomingPayments = [
  { id: '1', name: 'Rent Payment', amount: 95000000, dueDate: '2026-02-01', status: 'upcoming' },
  { id: '2', name: 'Supplier Invoice - Heineken', amount: 45000000, dueDate: '2026-02-03', status: 'upcoming' },
  { id: '3', name: 'Staff Payroll', amount: 186000000, dueDate: '2026-02-05', status: 'upcoming' },
  { id: '4', name: 'Insurance Premium', amount: 12000000, dueDate: '2026-02-10', status: 'upcoming' },
];

const totalInflow = cashFlowData.inflows.reduce((sum, i) => sum + i.amount, 0);
const totalOutflow = cashFlowData.outflows.reduce((sum, o) => sum + o.amount, 0);

export function CashFlow() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Cash Flow</h1>
        <p className="text-sm text-muted-foreground mt-1">Money movement analysis - January 2026</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Wallet className="h-4 w-4" />
            <span className="text-xs">Opening Balance</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatVND(cashFlowData.openingBalance)}</p>
        </div>
        <div className="rounded-card border border-success/30 bg-success/10 p-4 shadow-card">
          <div className="flex items-center gap-2 text-success mb-2">
            <ArrowDownLeft className="h-4 w-4" />
            <span className="text-xs">Total Inflow</span>
          </div>
          <p className="text-xl font-bold text-success">{formatVND(totalInflow)}</p>
        </div>
        <div className="rounded-card border border-error/30 bg-error/10 p-4 shadow-card">
          <div className="flex items-center gap-2 text-error mb-2">
            <ArrowUpRight className="h-4 w-4" />
            <span className="text-xs">Total Outflow</span>
          </div>
          <p className="text-xl font-bold text-error">{formatVND(totalOutflow)}</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Closing Balance</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatVND(cashFlowData.closingBalance)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inflows */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownLeft className="h-5 w-5 text-success" />
            <h2 className="text-lg font-semibold text-foreground">Cash Inflows</h2>
          </div>
          <div className="space-y-3">
            {cashFlowData.inflows.map((item) => (
              <div key={item.category} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{item.category}</span>
                <span className="text-sm font-medium text-success">+{formatVND(item.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-semibold text-foreground">Total Inflow</span>
              <span className="text-sm font-bold text-success">{formatVND(totalInflow)}</span>
            </div>
          </div>
        </div>

        {/* Outflows */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="h-5 w-5 text-error" />
            <h2 className="text-lg font-semibold text-foreground">Cash Outflows</h2>
          </div>
          <div className="space-y-3">
            {cashFlowData.outflows.map((item) => (
              <div key={item.category} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{item.category}</span>
                <span className="text-sm font-medium text-error">-{formatVND(item.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-semibold text-foreground">Total Outflow</span>
              <span className="text-sm font-bold text-error">{formatVND(totalOutflow)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Payments */}
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Upcoming Payments</h2>
          <span className="text-xs text-muted-foreground">Next 30 days</span>
        </div>
        <div className="space-y-3">
          {upcomingPayments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between rounded-lg bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-warning/20 p-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{payment.name}</p>
                  <p className="text-xs text-muted-foreground">Due: {payment.dueDate}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">{formatVND(payment.amount)}</p>
                <button className="text-xs text-primary hover:underline">Mark Paid</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
