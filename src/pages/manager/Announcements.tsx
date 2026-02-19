import { useState } from 'react';
import { 
  Megaphone, 
  Plus, 
  Pin, 
  MessageCircle, 
  Eye,
  Trash2,
  Edit2,
  Send,
  Loader2,
  AlertCircle,
  ChevronDown,
  X
} from 'lucide-react';
import { Button, PageHeader, StatCard } from "@/components/ui"
import { 
  useAnnouncements, 
  useCreateAnnouncement, 
  useDeleteAnnouncement,
  useUpdateAnnouncement 
} from '../../hooks/useAnnouncements';
import { useAuthStore } from '../../stores/authStore';
import type { Announcement, AnnouncementAudience, CreateAnnouncementInput } from '../../types';

const audienceOptions: { value: AnnouncementAudience; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'managers', label: 'Managers Only' },
  { value: 'bartenders', label: 'Bartenders' },
  { value: 'service', label: 'Service Staff' },
  { value: 'hosts', label: 'Hosts' },
];

export function Announcements() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: announcements, isLoading } = useAnnouncements();
  const profile = useAuthStore((s) => s.profile);

  const myAnnouncements = announcements?.filter(a => a.authorId === profile?.id) || [];
  const allAnnouncements = announcements || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Post updates and communicate with your team"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Posts"
          value={allAnnouncements.length}
        />
        <StatCard
          label="My Posts"
          value={myAnnouncements.length}
        />
        <StatCard
          label="Pinned"
          value={allAnnouncements.filter((a) => a.isPinned).length}
        />
      </div>

      {/* Announcements List */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Megaphone className="h-8 w-8 mb-2" />
            <p>No announcements yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Create your first announcement
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {allAnnouncements.map((announcement) => (
              <AnnouncementCard 
                key={announcement.id} 
                announcement={announcement}
                isOwner={announcement.authorId === profile?.id}
                onEdit={() => setEditingId(announcement.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {(showForm || editingId) && (
        <AnnouncementForm 
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          editId={editingId}
        />
      )}
    </div>
  );
}

interface AnnouncementCardProps {
  announcement: Announcement;
  isOwner: boolean;
  onEdit: () => void;
}

function AnnouncementCard({ announcement, isOwner, onEdit }: AnnouncementCardProps) {
  const deleteAnnouncement = useDeleteAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const [showActions, setShowActions] = useState(false);

  const togglePin = () => {
    updateAnnouncement.mutate({
      id: announcement.id,
      isPinned: !announcement.isPinned,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`p-4 ${announcement.isPinned ? 'bg-warning/5' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            {announcement.isPinned && (
              <Pin className="h-4 w-4 text-warning" />
            )}
            <h3 className="font-semibold text-foreground">{announcement.title}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {announcement.audience === 'all' ? 'Everyone' : announcement.audience}
            </span>
          </div>

          {/* Body */}
          <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">
            {announcement.body}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>By {announcement.author?.fullName || 'Unknown'}</span>
            <span>{formatDate(announcement.publishedAt)}</span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {announcement.readCount || 0} read
            </span>
            {announcement.allowReplies && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {announcement.replyCount || 0} replies
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </button>

            {showActions && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowActions(false)} 
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-border bg-card shadow-lg py-1">
                  <button
                    onClick={() => {
                      togglePin();
                      setShowActions(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground/80 hover:bg-muted text-left"
                  >
                    <Pin className="h-4 w-4" />
                    {announcement.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={() => {
                      onEdit();
                      setShowActions(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground/80 hover:bg-muted text-left"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={() => {
                      deleteAnnouncement.mutate(announcement.id);
                      setShowActions(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error hover:bg-error/10 text-left"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface AnnouncementFormProps {
  onClose: () => void;
  editId?: string | null;
}

function AnnouncementForm({ onClose, editId }: AnnouncementFormProps) {
  const { data: announcements } = useAnnouncements();
  const existing = editId ? announcements?.find(a => a.id === editId) : null;

  const [formData, setFormData] = useState<CreateAnnouncementInput>({
    title: existing?.title || '',
    body: existing?.body || '',
    audience: existing?.audience || 'all',
    isPinned: existing?.isPinned || false,
    allowReplies: existing?.allowReplies ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.body.trim()) {
      setError('Message is required');
      return;
    }

    try {
      if (editId) {
        await updateAnnouncement.mutateAsync({ id: editId, ...formData });
      } else {
        await createAnnouncement.mutateAsync(formData);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save announcement');
    }
  };

  const isPending = createAnnouncement.isPending || updateAnnouncement.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-card border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {editId ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="Announcement title..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1">
              Message *
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData(f => ({ ...f, body: e.target.value }))}
              placeholder="Write your announcement..."
              rows={5}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none resize-none"
              required
            />
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1">
              Audience
            </label>
            <div className="relative">
              <select
                value={formData.audience}
                onChange={(e) => setFormData(f => ({ ...f, audience: e.target.value as AnnouncementAudience }))}
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none"
              >
                {audienceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPinned}
                onChange={(e) => setFormData(f => ({ ...f, isPinned: e.target.checked }))}
                className="rounded border-muted-foreground bg-background text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground/80 flex items-center gap-1">
                <Pin className="h-3.5 w-3.5" />
                Pin to top
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowReplies}
                onChange={(e) => setFormData(f => ({ ...f, allowReplies: e.target.checked }))}
                className="rounded border-muted-foreground bg-background text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground/80 flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                Allow replies
              </span>
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {editId ? 'Update' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
