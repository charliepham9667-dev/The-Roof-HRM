import { useState } from 'react';
import { ListChecks, Sun, Moon, Clock } from 'lucide-react';
import { TaskChecklist } from '../../components/staff';

type TabType = 'opening' | 'closing' | 'midshift' | 'all';

const tabs: { value: TabType; label: string; icon: any }[] = [
  { value: 'opening', label: 'Opening', icon: Sun },
  { value: 'closing', label: 'Closing', icon: Moon },
  { value: 'midshift', label: 'Mid-Shift', icon: Clock },
  { value: 'all', label: 'All Tasks', icon: ListChecks },
];

export function Tasks() {
  const [activeTab, setActiveTab] = useState<TabType>('opening');

  // Auto-select tab based on time
  const hour = new Date().getHours();
  const suggestedTab = hour < 16 ? 'opening' : hour < 22 ? 'midshift' : 'closing';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Task Checklists</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete your daily tasks to ensure smooth operations
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          const isSuggested = tab.value === suggestedTab && !isActive;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isSuggested
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {isSuggested && (
                <span className="rounded-full bg-primary/30 px-1.5 py-0.5 text-[10px]">
                  Now
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Checklists */}
      <TaskChecklist taskType={activeTab === 'all' ? undefined : activeTab} />
    </div>
  );
}
