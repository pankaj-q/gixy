import { AlertChannel } from './AlertChannel.js';

/**
 * In-App Alert Channel
 * Stores alerts in database for in-app notification display
 */
export class InAppChannel extends AlertChannel {
  constructor(config, database) {
    super(config);
    this.database = database;
    this.collection = config.config.collection || 'notifications';
    this.maxNotificationsPerUser = config.config.maxNotificationsPerUser || 1000;
    this.defaultRecipients = config.config.defaultRecipients || []; // user IDs or roles
  }

  async doSend(alert) {
    if (!this.database) {
      throw new Error('InAppChannel requires a database connection');
    }

    const recipients = this.getRecipients(alert);
    const notifications = [];

    for (const recipientId of recipients) {
      const notification = {
        userId: recipientId,
        alertId: alert.id,
        alertFingerprint: alert.fingerprint,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        category: alert.category,
        source: alert.source,
        modelId: alert.modelId,
        assessmentId: alert.assessmentId,
        metadata: alert.metadata,
        dashboardUrl: alert.dashboardUrl,
        runbookUrl: alert.runbookUrl,
        read: false,
        archived: false,
        createdAt: new Date().toISOString(),
        alertCreatedAt: alert.createdAt,
      };

      const result = await this.database.collection(this.collection).insertOne(notification);
      notifications.push({
        notificationId: result.insertedId,
        userId: recipientId,
      });
    }

    // Clean up old notifications
    await this.cleanupOldNotifications(recipients);

    return {
      notificationsCreated: notifications.length,
      notifications,
    };
  }

  getRecipients(alert) {
    // Allow override per alert
    if (alert.metadata?.notificationRecipients) {
      return Array.isArray(alert.metadata.notificationRecipients) 
        ? alert.metadata.notificationRecipients 
        : [alert.metadata.notificationRecipients];
    }

    // Use default recipients
    return this.defaultRecipients;
  }

  async cleanupOldNotifications(userIds) {
    for (const userId of userIds) {
      const count = await this.database.collection(this.collection).countDocuments({ userId });
      
      if (count > this.maxNotificationsPerUser) {
        const toDelete = count - this.maxNotificationsPerUser;
        await this.database.collection(this.collection)
          .find({ userId })
          .sort({ createdAt: 1 })
          .limit(toDelete)
          .forEach(doc => {
            this.database.collection(this.collection).deleteOne({ _id: doc._id });
          });
      }
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async markAsRead(notificationId, userId) {
    const result = await this.database.collection(this.collection).updateOne(
      { _id: notificationId, userId },
      { $set: { read: true, readAt: new Date().toISOString() } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Mark notification as archived
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async markAsArchived(notificationId, userId) {
    const result = await this.database.collection(this.collection).updateOne(
      { _id: notificationId, userId },
      { $set: { archived: true, archivedAt: new Date().toISOString() } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Get user notifications
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getUserNotifications(userId, options = {}) {
    const { 
      unreadOnly = false, 
      includeArchived = false,
      limit = 50,
      skip = 0,
      severity,
      category,
    } = options;

    const query = { userId };
    
    if (unreadOnly) query.read = false;
    if (!includeArchived) query.archived = false;
    if (severity) query.severity = severity;
    if (category) query.category = category;

    return this.database.collection(this.collection)
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Get unread count for user
   * @param {string} userId - User ID
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    return this.database.collection(this.collection).countDocuments({
      userId,
      read: false,
      archived: false,
    });
  }

  getDefaultTemplates() {
    return {
      default: {},
    };
  }
}

export default InAppChannel;