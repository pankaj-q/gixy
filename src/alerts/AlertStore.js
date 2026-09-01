import { Alert, AlertRule, AlertChannelConfig } from './types.js';

/**
 * Alert Store Interface
 * Abstract base class for alert persistence
 */
export class AlertStore {
  /**
   * Save an alert
   * @param {Alert} alert - Alert to save
   * @returns {Promise<Alert>}
   */
  async save(alert) {
    throw new Error('save() must be implemented by subclass');
  }

  /**
   * Find alert by ID
   * @param {string} id - Alert ID
   * @returns {Promise<Alert|null>}
   */
  async findById(id) {
    throw new Error('findById() must be implemented by subclass');
  }

  /**
   * Find alerts by query
   * @param {Object} query - Query object
   * @param {Object} options - Query options
   * @returns {Promise<Array<Alert>>}
   */
  async find(query = {}, options = {}) {
    throw new Error('find() must be implemented by subclass');
  }

  /**
   * Update an alert
   * @param {Alert} alert - Alert to update
   * @returns {Promise<Alert>}
   */
  async update(alert) {
    throw new Error('update() must be implemented by subclass');
  }

  /**
   * Delete an alert
   * @param {string} id - Alert ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('delete() must be implemented by subclass');
  }

  /**
   * Get alert count
   * @param {Object} query - Query object
   * @returns {Promise<number>}
   */
  async count(query = {}) {
    throw new Error('count() must be implemented by subclass');
  }

  /**
   * Save a rule
   * @param {AlertRule} rule - Rule to save
   * @returns {Promise<AlertRule>}
   */
  async saveRule(rule) {
    throw new Error('saveRule() must be implemented by subclass');
  }

  /**
   * Find rule by ID
   * @param {string} id - Rule ID
   * @returns {Promise<AlertRule|null>}
   */
  async findRuleById(id) {
    throw new Error('findRuleById() must be implemented by subclass');
  }

  /**
   * Find rules by query
   * @param {Object} query - Query object
   * @returns {Promise<Array<AlertRule>>}
   */
  async findRules(query = {}) {
    throw new Error('findRules() must be implemented by subclass');
  }

  /**
   * Delete a rule
   * @param {string} id - Rule ID
   * @returns {Promise<boolean>}
   */
  async deleteRule(id) {
    throw new Error('deleteRule() must be implemented by subclass');
  }

  /**
   * Save a channel config
   * @param {AlertChannelConfig} config - Channel config to save
   * @returns {Promise<AlertChannelConfig>}
   */
  async saveChannelConfig(config) {
    throw new Error('saveChannelConfig() must be implemented by subclass');
  }

  /**
   * Find channel config by ID
   * @param {string} id - Config ID
   * @returns {Promise<AlertChannelConfig|null>}
   */
  async findChannelConfigById(id) {
    throw new Error('findChannelConfigById() must be implemented by subclass');
  }

  /**
   * Find all channel configs
   * @returns {Promise<Array<AlertChannelConfig>>}
   */
  async findChannelConfigs() {
    throw new Error('findChannelConfigs() must be implemented by subclass');
  }

  /**
   * Delete a channel config
   * @param {string} id - Config ID
   * @returns {Promise<boolean>}
   */
  async deleteChannelConfig(id) {
    throw new Error('deleteChannelConfig() must be implemented by subclass');
  }
}

/**
 * MongoDB Alert Store Implementation
 */
export class MongoAlertStore extends AlertStore {
  constructor(db, collections = {}) {
    super();
    this.db = db;
    this.alertsCollection = collections.alerts || 'alerts';
    this.rulesCollection = collections.rules || 'alert_rules';
    this.channelsCollection = collections.channels || 'alert_channels';
  }

  async save(alert) {
    const collection = this.db.collection(this.alertsCollection);
    const doc = alert.toJSON();
    doc._id = alert.id;
    
    await collection.replaceOne(
      { _id: alert.id },
      doc,
      { upsert: true }
    );
    
    return alert;
  }

  async findById(id) {
    const collection = this.db.collection(this.alertsCollection);
    const doc = await collection.findOne({ _id: id });
    return doc ? Alert.fromJSON(doc) : null;
  }

  async find(query = {}, options = {}) {
    const collection = this.db.collection(this.alertsCollection);
    const {
      limit = 100,
      skip = 0,
      sort = { createdAt: -1 },
    } = options;

    const cursor = collection.find(query).sort(sort).skip(skip).limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => Alert.fromJSON(doc));
  }

  async update(alert) {
    const collection = this.db.collection(this.alertsCollection);
    const doc = alert.toJSON();
    doc.updatedAt = new Date().toISOString();
    
    await collection.replaceOne(
      { _id: alert.id },
      doc
    );
    
    return alert;
  }

  async delete(id) {
    const collection = this.db.collection(this.alertsCollection);
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async count(query = {}) {
    const collection = this.db.collection(this.alertsCollection);
    return collection.countDocuments(query);
  }

  async saveRule(rule) {
    const collection = this.db.collection(this.rulesCollection);
    const doc = rule.toJSON();
    doc._id = rule.id;
    
    await collection.replaceOne(
      { _id: rule.id },
      doc,
      { upsert: true }
    );
    
    return rule;
  }

  async findRuleById(id) {
    const collection = this.db.collection(this.rulesCollection);
    const doc = await collection.findOne({ _id: id });
    return doc ? AlertRule.fromJSON(doc) : null;
  }

  async findRules(query = {}) {
    const collection = this.db.collection(this.rulesCollection);
    const docs = await collection.find(query).toArray();
    return docs.map(doc => AlertRule.fromJSON(doc));
  }

  async deleteRule(id) {
    const collection = this.db.collection(this.rulesCollection);
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async saveChannelConfig(config) {
    const collection = this.db.collection(this.channelsCollection);
    const doc = config.toJSON();
    doc._id = config.id;
    
    await collection.replaceOne(
      { _id: config.id },
      doc,
      { upsert: true }
    );
    
    return config;
  }

  async findChannelConfigById(id) {
    const collection = this.db.collection(this.channelsCollection);
    const doc = await collection.findOne({ _id: id });
    return doc ? AlertChannelConfig.fromJSON(doc) : null;
  }

  async findChannelConfigs() {
    const collection = this.db.collection(this.channelsCollection);
    const docs = await collection.find({}).toArray();
    return docs.map(doc => AlertChannelConfig.fromJSON(doc));
  }

  async deleteChannelConfig(id) {
    const collection = this.db.collection(this.channelsCollection);
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /**
   * Create indexes for better query performance
   */
  async createIndexes() {
    const alertsCollection = this.db.collection(this.alertsCollection);
    const rulesCollection = this.db.collection(this.rulesCollection);
    const channelsCollection = this.db.collection(this.channelsCollection);

    await alertsCollection.createIndexes([
      { key: { fingerprint: 1 }, unique: true },
      { key: { status: 1, severity: 1 } },
      { key: { category: 1 } },
      { key: { modelId: 1 } },
      { key: { createdAt: -1 } },
      { key: { 'metadata.ruleId': 1 } },
    ]);

    await rulesCollection.createIndexes([
      { key: { enabled: 1 } },
      { key: { category: 1 } },
    ]);

    await channelsCollection.createIndexes([
      { key: { type: 1 } },
      { key: { enabled: 1 } },
    ]);
  }
}

/**
 * In-Memory Alert Store (for testing/development)
 */
export class MemoryAlertStore extends AlertStore {
  constructor() {
    super();
    this.alerts = new Map();
    this.rules = new Map();
    this.channels = new Map();
  }

  async save(alert) {
    this.alerts.set(alert.id, alert);
    return alert;
  }

  async findById(id) {
    return this.alerts.get(id) || null;
  }

  async find(query = {}, options = {}) {
    let results = Array.from(this.alerts.values());

    // Apply query filters
    for (const [key, value] of Object.entries(query)) {
      results = results.filter(alert => {
        const alertValue = this.getNestedValue(alert, key);
        if (Array.isArray(value)) {
          return value.includes(alertValue);
        }
        return alertValue === value;
      });
    }

    // Apply sorting
    const sort = options.sort || { createdAt: -1 };
    const sortKey = Object.keys(sort)[0];
    const sortOrder = sort[sortKey];
    results.sort((a, b) => {
      const aVal = this.getNestedValue(a, sortKey);
      const bVal = this.getNestedValue(b, sortKey);
      if (aVal < bVal) return sortOrder === 1 ? -1 : 1;
      if (aVal > bVal) return sortOrder === 1 ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const skip = options.skip || 0;
    const limit = options.limit || 100;
    return results.slice(skip, skip + limit);
  }

  async update(alert) {
    this.alerts.set(alert.id, alert);
    return alert;
  }

  async delete(id) {
    return this.alerts.delete(id);
  }

  async count(query = {}) {
    const results = await this.find(query, { limit: 0 });
    return results.length;
  }

  async saveRule(rule) {
    this.rules.set(rule.id, rule);
    return rule;
  }

  async findRuleById(id) {
    return this.rules.get(id) || null;
  }

  async findRules(query = {}) {
    let results = Array.from(this.rules.values());

    for (const [key, value] of Object.entries(query)) {
      results = results.filter(rule => {
        const ruleValue = this.getNestedValue(rule, key);
        if (Array.isArray(value)) {
          return value.includes(ruleValue);
        }
        return ruleValue === value;
      });
    }

    return results;
  }

  async deleteRule(id) {
    return this.rules.delete(id);
  }

  async saveChannelConfig(config) {
    this.channels.set(config.id, config);
    return config;
  }

  async findChannelConfigById(id) {
    return this.channels.get(id) || null;
  }

  async findChannelConfigs() {
    return Array.from(this.channels.values());
  }

  async deleteChannelConfig(id) {
    return this.channels.delete(id);
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Clear all data (for testing)
   */
  clear() {
    this.alerts.clear();
    this.rules.clear();
    this.channels.clear();
  }
}

export default {
  AlertStore,
  MongoAlertStore,
  MemoryAlertStore,
};