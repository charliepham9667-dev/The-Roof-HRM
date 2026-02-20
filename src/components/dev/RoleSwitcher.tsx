import { useState, useRef, useEffect } from 'react';
import { Eye, ChevronDown, User, Users, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole, ManagerType } from '../../types';

const roleOptions: { role: UserRole; managerType?: ManagerType; label: string; icon: any }[] = [
  { role: 'owner', label: 'Owner', icon: Crown },
  { role: 'manager', managerType: 'floor', label: 'Floor Manager', icon: Users },
  { role: 'manager', managerType: 'bar', label: 'Bar Manager', icon: Users },
  { role: 'manager', managerType: 'marketing', label: 'Marketing Manager', icon: Users },
  { role: 'staff', label: 'Staff', icon: User },
];

export function RoleSwitcher() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const setViewAs = useAuthStore((s) => s.setViewAs);
  const viewAs = useAuthStore((s) => s.viewAs);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (!profile) return null;

  const canPreviewRoles = profile?.role === 'owner' || import.meta.env.DEV;
  if (!canPreviewRoles) return null;

  const currentView = viewAs || { role: profile.role, managerType: profile.managerType };
  const currentOption = roleOptions.find(
    (o) => o.role === currentView.role &&
    (o.role !== 'manager' || o.managerType === currentView.managerType)
  ) || roleOptions[0];

  const handleSelect = (option: typeof roleOptions[0]) => {
    if (option.role === 'owner') {
      if (profile.role === 'owner') {
        setViewAs(null);
        navigate('/owner/dashboard', { replace: true });
      } else {
        setViewAs({ role: 'owner', managerType: null });
        navigate('/owner/dashboard', { replace: true });
      }
    } else if (option.role === 'manager') {
      setViewAs({ role: option.role, managerType: option.managerType || null });
      navigate('/manager/dashboard', { replace: true });
    } else {
      setViewAs({ role: option.role, managerType: option.managerType || null });
      navigate('/staff/dashboard', { replace: true });
    }
    setIsOpen(false);
  };

  const isViewingAs = viewAs !== null;
  const Icon = currentOption.icon;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
          isViewingAs
            ? 'bg-warning/20 text-warning border border-warning/30'
            : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }`}
      >
        <Eye className="h-4 w-4 shrink-0" />
        <span>View as:</span>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{currentOption.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-full min-w-[200px] rounded-lg bg-card border border-border shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Preview as Role</p>
          </div>
          {roleOptions.map((option) => {
            const OptionIcon = option.icon;
            const isSelected =
              option.role === currentView.role &&
              (option.role !== 'manager' || option.managerType === currentView.managerType);

            return (
              <button
                key={`${option.role}-${option.managerType || ''}`}
                onClick={() => handleSelect(option)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  isSelected
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <OptionIcon className="h-4 w-4" />
                <span>{option.label}</span>
                {isSelected && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                    Active
                  </span>
                )}
              </button>
            );
          })}
          {isViewingAs && (
            <div className="px-3 py-2 border-t border-border">
              <p className="text-xs text-warning">
                Previewing as {currentOption.label}. Select "Owner" to return.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
