-- Add reservation_new notification type for manual reservation alerts
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'shift_reminder', 'reservation_reminder', 'reservation_new',
    'leave_status', 'task_assigned', 'task_due', 'announcement',
    'compliance_alert', 'clock_reminder', 'meeting_reminder',
    'general', 'content_approval'
  ));
