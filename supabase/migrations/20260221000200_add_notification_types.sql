-- Add content_approval notification type
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    'shift_reminder', 'reservation_reminder', 'leave_status',
    'task_assigned', 'task_due', 'announcement', 'compliance_alert',
    'clock_reminder', 'meeting_reminder', 'general', 'content_approval'
  ));
