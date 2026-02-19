import { useState } from 'react';
import { PieChart, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';

interface Category {
  id: string;
  name: string;
  revenue: number;
  percentage: number;
  change: number;
  subcategories: { name: string; revenue: number; percentage: number }[];
}

const categories: Category[] = [
  {
    id: '1',
    name: 'Beverages',
    revenue: 456000000,
    percentage: 57.4,
    change: 12.3,
    subcategories: [
      { name: 'Cocktails', revenue: 228000000, percentage: 50 },
      { name: 'Beer', revenue: 91200000, percentage: 20 },
      { name: 'Wine', revenue: 68400000, percentage: 15 },
      { name: 'Spirits', revenue: 45600000, percentage: 10 },
      { name: 'Soft Drinks', revenue: 22800000, percentage: 5 },
    ],
  },
  {
    id: '2',
    name: 'Food',
    revenue: 238000000,
    percentage: 30.0,
    change: 8.5,
    subcategories: [
      { name: 'Appetizers', revenue: 71400000, percentage: 30 },
      { name: 'Main Course', revenue: 95200000, percentage: 40 },
      { name: 'Desserts', revenue: 47600000, percentage: 20 },
      { name: 'Sides', revenue: 23800000, percentage: 10 },
    ],
  },
  {
    id: '3',
    name: 'Events & Bookings',
    revenue: 80000000,
    percentage: 10.1,
    change: 25.0,
    subcategories: [
      { name: 'Private Events', revenue: 48000000, percentage: 60 },
      { name: 'VIP Tables', revenue: 24000000, percentage: 30 },
      { name: 'Special Packages', revenue: 8000000, percentage: 10 },
    ],
  },
  {
    id: '4',
    name: 'Merchandise',
    revenue: 20000000,
    percentage: 2.5,
    change: -5.2,
    subcategories: [
      { name: 'Branded Items', revenue: 12000000, percentage: 60 },
      { name: 'Gift Cards', revenue: 8000000, percentage: 40 },
    ],
  },
];

const formatVND = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B đ`;
  if (value >= 1000000) return `${Math.round(value / 1000000)}M đ`;
  return `${value.toLocaleString()} đ`;
};

const colors = ['bg-primary', 'bg-info', 'bg-success', 'bg-purple-500', 'bg-warning'];

export function CategoryDrilldown() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('1');
  const totalRevenue = categories.reduce((sum, c) => sum + c.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Category Drill-down</h1>
        <p className="text-sm text-muted-foreground mt-1">Revenue breakdown by category - January 2026</p>
      </div>

      {/* Total Revenue Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatVND(totalRevenue)}
          trend={12.5}
          subtitle="vs last month"
        />
        
        {/* Category Breakdown Visual */}
        <div className="md:col-span-3 rounded-card border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-medium text-muted-foreground mb-3">Revenue by Category</p>
          
          {/* Visual Bar */}
          <div className="flex h-4 rounded-full overflow-hidden">
            {categories.map((category, i) => (
              <div
                key={category.id}
                className={`${colors[i]} transition-all`}
                style={{ width: `${category.percentage}%` }}
                title={`${category.name}: ${category.percentage}%`}
              />
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4">
            {categories.map((category, i) => (
              <div key={category.id} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${colors[i]}`} />
                <span className="text-xs text-muted-foreground">{category.name} ({category.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Cards */}
      <div className="space-y-4">
        {categories.map((category, i) => (
          <div key={category.id} className="rounded-card border border-border bg-card overflow-hidden shadow-card">
            <button
              onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
              className="flex items-center justify-between w-full p-4 hover:bg-background transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-lg ${colors[i]} flex items-center justify-center`}>
                  <PieChart className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{category.subcategories.length} subcategories</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{formatVND(category.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{category.percentage}% of total</p>
                </div>
                <div className={`flex items-center gap-1 ${category.change >= 0 ? 'text-success' : 'text-error'}`}>
                  {category.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="text-sm font-medium">{Math.abs(category.change)}%</span>
                </div>
                <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expandedCategory === category.id ? 'rotate-90' : ''}`} />
              </div>
            </button>
            
            {expandedCategory === category.id && (
              <div className="border-t border-border p-4 bg-background">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {category.subcategories.map((sub) => (
                    <div key={sub.name} className="rounded-card border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-foreground">{sub.name}</span>
                        <span className="text-xs text-muted-foreground">{sub.percentage}%</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">{formatVND(sub.revenue)}</p>
                      <div className="h-1.5 rounded-full bg-border mt-2">
                        <div className={`h-1.5 rounded-full ${colors[i]}`} style={{ width: `${sub.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
