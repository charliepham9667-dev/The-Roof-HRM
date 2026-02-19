// =============================================
// Core Types
// =============================================

export type UserRole = 'owner' | 'manager' | 'staff';
export type ManagerType = 'bar' | 'floor' | 'marketing' | null;
export type EmploymentType = 'full_time' | 'part_time' | 'casual';

// Job roles at The Roof
export type JobRole = 
  | 'bartender' 
  | 'service' 
  | 'floor_manager' 
  | 'receptionist' 
  | 'host' 
  | 'videographer' 
  | 'marketing_manager' 
  | 'bar_manager' 
  | 'accountant';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  managerType?: ManagerType;
  jobRole?: JobRole;
  employmentType: EmploymentType;
  avatarUrl?: string;
  phone?: string;
  hireDate?: string;
  isActive: boolean;
  // Leave tracking
  annualLeaveDays: number;
  leaveDaysUsed: number;
  targetHoursWeek: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Lightweight profile shape used in nested joins (e.g. announcement author,
 * task assignee, leave reviewer). Many queries only select a subset of profile
 * fields, so those should not be typed as full `Profile`.
 */
export interface ProfileSummary {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  jobRole?: JobRole;
  managerType?: ManagerType;
  role?: UserRole;
}

// Locale for i18n
export type Locale = 'en' | 'vi';

export interface Venue {
  id: string;
  name: string;
  location: string;
  timezone: string;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
}

export interface DailyMetrics {
  id: string;
  date: string;
  revenue: number;
  pax: number;
  avgSpend: number;
  laborCost: number;
  staffOnDuty: number;
  hoursScheduled: number;
  hoursWorked: number;
  projectedRevenue: number;
  createdAt: string;
}

export type ShiftStatus = 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';

export interface Shift {
  id: string;
  venueId: string;
  staffId: string;
  role: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
}

export type ComplianceStatus = 'action_required' | 'needs_attention' | 'passed' | 'pending';
export type ComplianceType = 'license' | 'permit' | 'certification' | 'audit' | 'training';

export interface ComplianceItem {
  id: string;
  title: string;
  description?: string;
  type: ComplianceType;
  status: ComplianceStatus;
  dueDate?: string;
  completedAt?: string;
  staffId?: string;
  createdAt: string;
}

export type ReviewSource = 'google' | 'tripadvisor' | 'facebook' | 'internal';

export interface Review {
  id: string;
  source: ReviewSource;
  authorName?: string;
  rating: number;
  comment?: string;
  sentimentScore?: number;
  publishedAt: string;
  createdAt: string;
}

export interface Target {
  id: string;
  venueId: string;
  metric: 'laborCostPercentage' | 'sales' | 'hoursWorked' | 'hoursScheduled';
  value: number;
  period: 'daily' | 'weekly' | 'monthly';
  effectiveFrom: string;
  effectiveTo?: string;
}

// P&L Types
export type PnlDataType = 'actual' | 'budget';

export interface PnlMonthly {
  id: string;
  year: number;
  month: number;
  
  // Revenue totals
  grossSales: number;
  discounts: number;
  foc: number;
  netSales: number;
  serviceCharge: number;
  
  // Revenue breakdown by category
  revenueWine: number;
  revenueSpirits: number;
  revenueCocktails: number;
  revenueShisha: number;
  revenueBeer: number;
  revenueFood: number;
  revenueBalloons: number;
  revenueOther: number;
  
  // COGS breakdown
  cogs: number;
  cogsWine: number;
  cogsSpirits: number;
  cogsCocktails: number;
  cogsShisha: number;
  cogsBeer: number;
  cogsFood: number;
  cogsBalloons: number;
  cogsOther: number;
  
  // Labor breakdown
  laborCost: number;
  laborSalary: number;
  laborCasual: number;
  laborInsurance: number;
  labor13thMonth: number;
  laborHoliday: number;
  laborSvc: number;
  
  // Fixed costs breakdown
  fixedCosts: number;
  fixedRental: number;
  fixedUtilities: number;
  fixedMaintenance: number;
  fixedAdmin: number;
  
  // OPEX breakdown
  opex: number;
  opexConsumables: number;
  opexMarketing: number;
  opexEvents: number;
  
  // Other
  reserveFund: number;
  totalExpenses: number;
  grossProfit: number;
  depreciation: number;
  otherIncome: number;
  otherExpenses: number;
  ebit: number;
  
  // Percentages
  cogsPercentage: number;
  laborPercentage: number;
  grossMargin: number;
  ebitMargin: number;
  
  // Budget values (for variance)
  budgetGrossSales: number;
  budgetNetSales: number;
  budgetCogs: number;
  budgetLabor: number;
  budgetFixed: number;
  budgetOpex: number;
  
  // Metadata
  dataType: PnlDataType;
  syncedAt: string;
}

export interface PnlSummary {
  totalRevenue: number;
  totalCogs: number;
  totalLabor: number;
  totalFixed: number;
  totalOpex: number;
  totalExpenses: number;
  grossProfit: number;
  ebit: number;
  cogsPercentage: number;
  laborPercentage: number;
  grossMargin: number;
  ebitMargin: number;
}

export interface PnlComparison {
  month: number;
  monthName: string;
  currentYear: PnlMonthly | null;
  previousYear: PnlMonthly | null;
  variance: {
    netSales: number;
    netSalesPercent: number;
    grossProfit: number;
    grossProfitPercent: number;
    ebit: number;
    ebitPercent: number;
  } | null;
}

// =============================================
// Announcements
// =============================================

export type AnnouncementAudience = 'all' | 'managers' | 'bartenders' | 'service' | 'hosts' | 'cashiers';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  authorId: string;
  author?: ProfileSummary;
  audience: AnnouncementAudience;
  isPinned: boolean;
  isActive: boolean;
  allowReplies: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt?: string;
  // Computed
  readCount?: number;
  replyCount?: number;
  isRead?: boolean;
}

export interface AnnouncementRead {
  id: string;
  announcementId: string;
  userId: string;
  readAt: string;
}

export interface AnnouncementReply {
  id: string;
  announcementId: string;
  authorId: string;
  author?: ProfileSummary;
  parentReplyId?: string;
  body: string;
  isEdited: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  // Nested replies
  replies?: AnnouncementReply[];
}

// =============================================
// Leave Requests
// =============================================

export type LeaveType = 'annual' | 'sick' | 'personal' | 'emergency' | 'unpaid' | 'maternity' | 'paternity';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  staffId: string;
  staff?: ProfileSummary;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewer?: ProfileSummary;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// Clock Records (Geo-fenced)
// =============================================

export type ClockType = 'in' | 'out' | 'break_start' | 'break_end';

export interface ClockRecord {
  id: string;
  staffId: string;
  staff?: ProfileSummary;
  shiftId?: string;
  clockType: ClockType;
  clockTime: string;
  latitude?: number;
  longitude?: number;
  isWithinGeofence: boolean;
  distanceFromVenue?: number;
  deviceInfo?: string;
  ipAddress?: string;
  notes?: string;
  overrideBy?: string;
  createdAt: string;
}

export interface VenueSettings {
  id: string;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  timezone: string;
  operatingHours: Record<string, {
    open: string;
    close: string;
    shiftStart: string;
    shiftEnd: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// Reservations
// =============================================

export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled';
export type ReservationSource = 'website' | 'email' | 'phone' | 'walk_in' | 'social_media';

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  reservationDate: string;
  reservationTime: string;
  partySize: number;
  tablePreference?: string;
  specialRequests?: string;
  status: ReservationStatus;
  source: ReservationSource;
  notes?: string;
  reminderSent: boolean;
  reminderSentAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// Delegation Tasks (Owner → Manager)
// =============================================

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled' | 'blocked';
export type BoardColumnKey = 'not_started' | 'in_progress' | 'finish_today' | 'done';
export type TaskCategory =
  | 'general'
  | 'operations'
  | 'bar'
  | 'finance'
  | 'ordering'
  | 'marketing'
  | 'hr'
  | 'maintenance'
  | 'event';

export interface DelegationTask {
  id: string;
  title: string;
  description?: string;
  assignedBy: string;
  assignedByProfile?: ProfileSummary;
  assignedTo: string;
  assignedToProfile?: ProfileSummary;
  projectId?: string | null;
  project?: {
    id: string;
    title: string;
    color: string | null;
  };
  dueDate?: string;
  dueTime?: string;
  timeStarted?: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  notes?: string;
  completedAt?: string;
  completionNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// Task Templates & Completions (Checklists)
// =============================================

export type TaskTemplateType = 'opening' | 'closing' | 'midshift' | 'event' | 'special';

export interface TaskItem {
  name: string;
  description?: string;
  order: number;
  required: boolean;
  estimatedMinutes?: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  taskType: TaskTemplateType;
  applicableRoles: string[];
  tasks: TaskItem[];
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CompletedTaskItem {
  taskName: string;
  completedAt: string;
  notes?: string;
}

export interface TaskCompletion {
  id: string;
  templateId: string;
  template?: TaskTemplate;
  staffId: string;
  staff?: Profile;
  shiftId?: string;
  completionDate: string;
  completedTasks: CompletedTaskItem[];
  isFullyCompleted: boolean;
  completionPercentage: number;
  notes?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// Events (Calendar)
// =============================================

export type EventType = 'meeting' | 'holiday' | 'birthday' | 'team_building' | 'training' | 'promotion' | 'special_event' | 'other';
export type AttendeeStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

export type EventMarketingStatus = 'not_started' | 'planning' | 'urgent' | 'confirmed' | 'past'

export interface EventChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface CalendarEvent {
  id: string;
  title: string;
  titleVi?: string;
  description?: string;
  descriptionVi?: string;
  eventType: EventType;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  color: string;
  icon?: string;
  relatedPromotionId?: string;
  createdBy?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  marketingStatus?: EventMarketingStatus;
  checklist?: EventChecklistItem[];
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string;
  user?: Profile;
  status: AttendeeStatus;
  respondedAt?: string;
  createdAt: string;
}

// =============================================
// Promotions
// =============================================

export type PromotionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';
export type DiscountType = 'percentage' | 'fixed' | 'bogo' | 'bundle' | 'other';

export interface Promotion {
  id: string;
  name: string;
  nameVi?: string;
  description?: string;
  descriptionVi?: string;
  startDate: string;
  endDate?: string;
  targetAudience: string;
  discountType?: DiscountType;
  discountValue?: number;
  discountDescription?: string;
  imageUrl?: string;
  color: string;
  status: PromotionStatus;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// Meetings
// =============================================

export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';

export interface ActionItem {
  task: string;
  assigneeId?: string;
  dueDate?: string;
  status: 'pending' | 'done';
}

export interface Meeting {
  id: string;
  title: string;
  agenda?: string;
  meetingDate: string;
  startTime: string;
  endTime?: string;
  location: string;
  linkedEventId?: string;
  notes?: string;
  notesUpdatedAt?: string;
  notesUpdatedBy?: string;
  actionItems: ActionItem[];
  status: MeetingStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  // Computed from event_attendees
  attendees?: EventAttendee[];
}

// =============================================
// Resource Links
// =============================================

export type ResourceCategory = 'sop' | 'training' | 'safety' | 'branding' | 'hr' | 'menu' | 'recipes' | 'licenses' | 'other';

export interface ResourceLink {
  id: string;
  title: string;
  titleVi?: string;
  description?: string;
  descriptionVi?: string;
  url: string;
  category: ResourceCategory;
  subcategory?: string;
  icon: string;
  complianceItemId?: string;
  sortOrder: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// Notifications
// =============================================

export type NotificationType = 
  | 'shift_reminder' 
  | 'reservation_reminder' 
  | 'leave_status' 
  | 'task_assigned' 
  | 'task_due' 
  | 'announcement' 
  | 'compliance_alert' 
  | 'clock_reminder' 
  | 'meeting_reminder' 
  | 'general';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  titleVi?: string;
  body?: string;
  bodyVi?: string;
  notificationType: NotificationType;
  relatedType?: string;
  relatedId?: string;
  isRead: boolean;
  readAt?: string;
  isSent: boolean;
  sentAt?: string;
  scheduledFor?: string;
  createdAt: string;
}

// =============================================
// Extended Target (with stretch goal)
// =============================================

export interface MonthlyTarget {
  id: string;
  metric: 'revenue' | 'pax' | 'labor_cost_percentage' | 'avg_spend';
  targetValue: number;
  stretchValue?: number;
  stretchPercentage: number; // Default 25%
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd?: string;
  notes?: string;
  createdAt: string;
}

// =============================================
// Dashboard Computed Types
// =============================================

export interface RevenueVelocityData {
  mtdRevenue: number;
  monthlyTarget: number;
  stretchTarget: number;
  goalAchievedPercent: number;
  currentSurplus: number;
  projectedMonthEnd: number;
  gapToStretch: number;
  requiredAvgDaily: number;
  dailyTargetPace: number;
  yourAverage: number; // 30-day rolling
  yesterdayRevenue: number;
  daysRemaining: number;
  velocityInsight: string; // Auto-generated
}

export interface ExecutiveSummaryData {
  strategicHeadline: string;
  goalStatus: 'over' | 'under' | 'on_track';
  goalAmount: number;
  volumePax: number;
  volumeChangePercent: number;
  avgSpend: number;
  avgSpendChangePercent: number;
  projectedRevenue: number;
}

export interface StaffingSnapshot {
  activeStaff: number;
  totalScheduled: number;
  coveragePercent: number;
  guestStaffRatio?: number;
  lateArrivals: Profile[];
}

// =============================================
// Form Input Types
// =============================================

export interface CreateLeaveRequestInput {
  startDate: string;
  endDate: string;
  leaveType: LeaveType;
  reason?: string;
}

export interface CreateReservationInput {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  reservationDate: string;
  reservationTime: string;
  partySize: number;
  tablePreference?: string;
  specialRequests?: string;
  source?: ReservationSource;
  notes?: string;
}

export interface CreateDelegationTaskInput {
  title: string;
  description?: string;
  assignedTo: string;
  projectId?: string | null;
  dueDate?: string;
  dueTime?: string;
  timeStarted?: string;
  priority?: TaskPriority;
  category?: TaskCategory;
  notes?: string;
  status?: TaskStatus;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audience?: AnnouncementAudience;
  isPinned?: boolean;
  allowReplies?: boolean;
  imageUrl?: string;
}

export interface ClockInInput {
  shiftId?: string;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
}