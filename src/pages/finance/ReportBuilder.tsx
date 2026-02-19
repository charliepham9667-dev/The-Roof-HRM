import { useState } from 'react';
import { FileText, Download, Calendar, Filter, Plus, Clock, CheckCircle } from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  lastRun: string;
  schedule: string | null;
}

const templates: ReportTemplate[] = [
  {
    id: '1',
    name: 'Daily Sales Summary',
    description: 'Revenue, pax count, and average spend breakdown by hour',
    lastRun: '2 hours ago',
    schedule: 'Daily at 6:00 AM',
  },
  {
    id: '2',
    name: 'Weekly P&L Report',
    description: 'Full profit and loss statement with category breakdown',
    lastRun: '3 days ago',
    schedule: 'Weekly on Monday',
  },
  {
    id: '3',
    name: 'Staff Performance Report',
    description: 'Individual staff metrics, hours worked, and efficiency scores',
    lastRun: '1 week ago',
    schedule: null,
  },
  {
    id: '4',
    name: 'Inventory Movement',
    description: 'Stock levels, usage rates, and reorder recommendations',
    lastRun: '5 days ago',
    schedule: 'Weekly on Friday',
  },
  {
    id: '5',
    name: 'Customer Insights',
    description: 'Review analysis, sentiment trends, and feedback summary',
    lastRun: '2 days ago',
    schedule: null,
  },
];

const recentReports = [
  { id: '1', name: 'Daily Sales Summary - Jan 27', date: '2026-01-27', status: 'ready' },
  { id: '2', name: 'Daily Sales Summary - Jan 26', date: '2026-01-26', status: 'ready' },
  { id: '3', name: 'Weekly P&L Report - Week 4', date: '2026-01-27', status: 'ready' },
  { id: '4', name: 'Customer Insights - Jan', date: '2026-01-25', status: 'ready' },
];

export function ReportBuilder() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Report Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and schedule custom reports</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          New Report
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button className="rounded-card border border-border bg-card p-4 text-left shadow-card hover:border-primary transition-colors">
          <FileText className="h-5 w-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Sales Report</p>
          <p className="text-xs text-muted-foreground">Generate now</p>
        </button>
        <button className="rounded-card border border-border bg-card p-4 text-left shadow-card hover:border-primary transition-colors">
          <Calendar className="h-5 w-5 text-info mb-2" />
          <p className="text-sm font-medium text-foreground">Schedule Report</p>
          <p className="text-xs text-muted-foreground">Set up automation</p>
        </button>
        <button className="rounded-card border border-border bg-card p-4 text-left shadow-card hover:border-primary transition-colors">
          <Filter className="h-5 w-5 text-purple-400 mb-2" />
          <p className="text-sm font-medium text-foreground">Custom Query</p>
          <p className="text-xs text-muted-foreground">Advanced filters</p>
        </button>
        <button className="rounded-card border border-border bg-card p-4 text-left shadow-card hover:border-primary transition-colors">
          <Download className="h-5 w-5 text-success mb-2" />
          <p className="text-sm font-medium text-foreground">Export Data</p>
          <p className="text-xs text-muted-foreground">CSV, Excel, PDF</p>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Report Templates */}
        <div className="lg:col-span-2 rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Report Templates</h2>
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedTemplate === template.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background hover:border-muted-foreground'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {template.lastRun}
                      </span>
                      {template.schedule && (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <Calendar className="h-3 w-3" />
                          {template.schedule}
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
                    Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Reports</h2>
          <div className="space-y-3">
            {recentReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-success/20 p-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{report.name}</p>
                    <p className="text-xs text-muted-foreground">{report.date}</p>
                  </div>
                </div>
                <button className="text-primary hover:underline text-xs">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
