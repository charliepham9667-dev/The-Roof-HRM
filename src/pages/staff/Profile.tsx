import { useState } from 'react';
import { User, Mail, Phone, Calendar, Shield, Save, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function Profile() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const [isEditing, setIsEditing] = useState(false);

  if (!profile) return null;

  const roleLabels: Record<string, string> = {
    owner: 'Owner',
    manager: 'Manager',
    staff: 'Staff',
  };

  const managerLabels: Record<string, string> = {
    bar: 'Bar Manager',
    floor: 'Floor Manager',
    marketing: 'Marketing Manager',
  };

  const displayRole = profile.role === 'manager' && profile.managerType 
    ? managerLabels[profile.managerType] 
    : roleLabels[profile.role];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account information</p>
      </div>

      {/* Profile Card */}
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-2xl font-semibold text-primary-foreground">
            {profile.fullName?.split(' ').map(n => n[0]).join('') || '?'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{profile.fullName}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-sm text-primary">
              <Shield className="h-3 w-3" />
              {displayRole}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 py-3 border-b border-border">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-foreground">{profile.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-border">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm text-foreground">{profile.phone || 'Not set'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-border">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Hire Date</p>
              <p className="text-sm text-foreground">
                {profile.hireDate 
                  ? new Date(profile.hireDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  : 'Not set'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={`text-sm ${profile.isActive ? 'text-success' : 'text-error'}`}>
                {profile.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-foreground/70 hover:bg-muted transition-colors"
        >
          <Save className="h-4 w-4" />
          Edit Profile
        </button>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error hover:bg-error/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>

      {/* Edit Modal Placeholder */}
      {isEditing && (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-8 text-center shadow-card">
          <p className="text-muted-foreground">Profile editing coming soon...</p>
          <button 
            onClick={() => setIsEditing(false)}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
