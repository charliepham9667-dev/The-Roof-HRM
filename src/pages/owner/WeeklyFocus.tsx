import { useState } from 'react';
import { Target, CheckCircle, Circle, Plus, TrendingUp, Users, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: string;
  category: 'revenue' | 'service' | 'team' | 'operations';
  isCompleted: boolean;
}

const weeklyGoals: Goal[] = [
  {
    id: '1',
    title: 'Hit 800M đ weekly revenue',
    description: 'Focus on upselling premium cocktails and bottle service',
    progress: 85,
    target: '800M đ',
    category: 'revenue',
    isCompleted: false,
  },
  {
    id: '2',
    title: 'Maintain 4.5+ star rating',
    description: 'Respond to all reviews within 24 hours',
    progress: 100,
    target: '4.5 stars',
    category: 'service',
    isCompleted: true,
  },
  {
    id: '3',
    title: 'Complete staff training sessions',
    description: '3 bartenders need cocktail certification renewal',
    progress: 67,
    target: '3 sessions',
    category: 'team',
    isCompleted: false,
  },
  {
    id: '4',
    title: 'Reduce average wait time to 5 mins',
    description: 'Optimize bar workflow during peak hours',
    progress: 60,
    target: '5 mins',
    category: 'operations',
    isCompleted: false,
  },
];

const priorities = [
  { id: '1', text: 'VIP reservation Saturday - 20 pax private event', done: true },
  { id: '2', text: 'New cocktail menu launch Friday', done: false },
  { id: '3', text: 'Monthly inventory count Thursday', done: false },
  { id: '4', text: 'Team meeting Wednesday 3PM', done: true },
  { id: '5', text: 'DJ booking confirmation for weekend', done: false },
];

const categoryConfig = {
  revenue: { icon: DollarSign, color: 'text-success', bg: 'bg-success/20' },
  service: { icon: Target, color: 'text-info', bg: 'bg-info/20' },
  team: { icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  operations: { icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/20' },
};

export function WeeklyFocus() {
  const [todos, setTodos] = useState(priorities);

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const completedGoals = weeklyGoals.filter(g => g.isCompleted).length;
  const overallProgress = Math.round(weeklyGoals.reduce((sum, g) => sum + g.progress, 0) / weeklyGoals.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Weekly Focus</h1>
          <p className="text-sm text-muted-foreground mt-1">Week of Jan 27 - Feb 2, 2026</p>
        </div>
        <Button className="h-auto px-4 py-2.5 text-sm font-medium">
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {/* Progress Overview */}
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Weekly Progress</h2>
          <span className="text-sm text-muted-foreground">{completedGoals}/{weeklyGoals.length} goals completed</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20">
            <svg className="h-20 w-20 -rotate-90 transform">
              <circle cx="40" cy="40" r="36" className="stroke-border" strokeWidth="6" fill="none" />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="#F5793B"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${(overallProgress / 100) * 226} 226`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-foreground">
              {overallProgress}%
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">Overall weekly goal completion</p>
            <div className="h-2 rounded-full bg-border">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Goals */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Weekly Goals</h2>
          {weeklyGoals.map((goal) => {
            const config = categoryConfig[goal.category];
            const Icon = config.icon;
            return (
              <div
                key={goal.id}
                className={`rounded-card border border-border bg-card p-4 shadow-card ${
                  goal.isCompleted ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-2 ${config.bg}`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-medium ${goal.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {goal.title}
                      </p>
                      {goal.isCompleted && (
                        <CheckCircle className="h-4 w-4 text-success" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{goal.description}</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-1.5 rounded-full bg-border">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              goal.isCompleted ? 'bg-success' : 'bg-primary'
                            }`}
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                      <span className="text-xs font-medium text-foreground">{goal.target}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Priority Tasks */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Priority Tasks</h2>
          <div className="space-y-3">
            {todos.map((todo) => (
              <button
                key={todo.id}
                onClick={() => toggleTodo(todo.id)}
                className="flex items-start gap-3 w-full text-left group"
              >
                {todo.done ? (
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0 group-hover:text-foreground" />
                )}
                <span className={`text-sm ${todo.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {todo.text}
                </span>
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 mt-4 text-sm text-primary hover:underline">
            <Plus className="h-4 w-4" />
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
