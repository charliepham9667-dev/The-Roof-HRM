import { useState } from 'react';
import { Send, Users, Hash, Plus, Search, Phone, Video, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  unread: number;
  lastMessage: string;
}

const channels: Channel[] = [
  { id: '1', name: 'general', type: 'channel', unread: 3, lastMessage: 'Minh: Stock delivery confirmed' },
  { id: '2', name: 'bar-team', type: 'channel', unread: 0, lastMessage: 'New cocktail recipe shared' },
  { id: '3', name: 'floor-team', type: 'channel', unread: 5, lastMessage: 'Table 12 VIP arriving' },
  { id: '4', name: 'managers', type: 'channel', unread: 1, lastMessage: 'Weekly meeting tomorrow' },
  { id: '5', name: 'Minh Tran', type: 'dm', unread: 0, lastMessage: 'Got it, thanks!' },
  { id: '6', name: 'Linh Nguyen', type: 'dm', unread: 2, lastMessage: 'Can we discuss the schedule?' },
];

const messages: Message[] = [
  {
    id: '1',
    author: 'Minh Tran',
    avatar: 'MT',
    content: 'Hey team, the Heineken delivery just arrived. All 50 cases accounted for.',
    timestamp: '2:30 PM',
    isOwn: false,
  },
  {
    id: '2',
    author: 'You',
    avatar: 'You',
    content: 'Great! Please make sure the storage room temperature is set correctly.',
    timestamp: '2:32 PM',
    isOwn: true,
  },
  {
    id: '3',
    author: 'Minh Tran',
    avatar: 'MT',
    content: 'Already checked - 4°C as required. Also rotated the old stock to the front.',
    timestamp: '2:35 PM',
    isOwn: false,
  },
  {
    id: '4',
    author: 'Linh Nguyen',
    avatar: 'LN',
    content: 'Perfect timing! We have a big group booking tonight - 25 pax at 8pm.',
    timestamp: '2:40 PM',
    isOwn: false,
  },
  {
    id: '5',
    author: 'You',
    avatar: 'You',
    content: 'Thanks for the heads up Linh. Minh, can you prep extra cocktail garnishes?',
    timestamp: '2:42 PM',
    isOwn: true,
  },
  {
    id: '6',
    author: 'Minh Tran',
    avatar: 'MT',
    content: 'On it! Will prepare by 6pm.',
    timestamp: '2:45 PM',
    isOwn: false,
  },
];

const onlineMembers = [
  { id: '1', name: 'Minh Tran', role: 'Bar Manager', status: 'online' },
  { id: '2', name: 'Linh Nguyen', role: 'Floor Manager', status: 'online' },
  { id: '3', name: 'David Pham', role: 'Marketing', status: 'away' },
  { id: '4', name: 'Sarah Le', role: 'Host', status: 'online' },
];

export function Chat() {
  const [newMessage, setNewMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('1');

  const currentChannel = channels.find(c => c.id === selectedChannel);

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-card border border-border bg-card overflow-hidden shadow-card">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search messages..."
              className="w-full rounded-lg bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
            />
          </div>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Channels</span>
            <button className="text-muted-foreground hover:text-foreground">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {channels.filter(c => c.type === 'channel').map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedChannel === channel.id
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  <span>{channel.name}</span>
                </div>
                {channel.unread > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {channel.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Direct Messages</span>
            <button className="text-muted-foreground hover:text-foreground">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {channels.filter(c => c.type === 'dm').map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedChannel === channel.id
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-foreground">
                    {channel.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span>{channel.name}</span>
                </div>
                {channel.unread > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {channel.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-foreground">{currentChannel?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Phone className="h-4 w-4" />
            </button>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Video className="h-4 w-4" />
            </button>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Users className="h-4 w-4" />
            </button>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.isOwn ? 'flex-row-reverse' : ''}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                message.isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}>
                {message.avatar}
              </div>
              <div className={`max-w-md ${message.isOwn ? 'text-right' : ''}`}>
                <div className={`flex items-center gap-2 mb-1 ${message.isOwn ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm font-medium text-foreground">{message.author}</span>
                  <span className="text-xs text-muted-foreground">{message.timestamp}</span>
                </div>
                <div className={`rounded-lg px-4 py-2 ${
                  message.isOwn ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'
                }`}>
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message #${currentChannel?.name}`}
              className="flex-1 rounded-lg bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
            />
            <Button className="h-auto p-3" aria-label="Send message">
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Members Sidebar */}
      <div className="w-56 border-l border-border p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Online — {onlineMembers.length}</h3>
        <div className="space-y-3">
          {onlineMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-3">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                  member.status === 'online' ? 'bg-success' : 'bg-warning'
                }`} />
              </div>
              <div>
                <p className="text-sm text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
