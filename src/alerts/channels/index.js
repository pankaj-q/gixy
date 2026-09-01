/**
 * Alert Channels Index
 * Exports all available alert channels
 */

import { AlertChannel } from './AlertChannel.js';
import { EmailChannel } from './EmailChannel.js';
import { WebhookChannel } from './WebhookChannel.js';
import { SlackChannel } from './SlackChannel.js';
import { PagerDutyChannel } from './PagerDutyChannel.js';
import { OpsGenieChannel } from './OpsGenieChannel.js';
import { InAppChannel } from './InAppChannel.js';

export { AlertChannel };
export { EmailChannel };
export { WebhookChannel };
export { SlackChannel };
export { PagerDutyChannel };
export { OpsGenieChannel };
export { InAppChannel };

export const CHANNEL_TYPES = {
  email: EmailChannel,
  webhook: WebhookChannel,
  slack: SlackChannel,
  pagerduty: PagerDutyChannel,
  opsgenie: OpsGenieChannel,
  in_app: InAppChannel,
};

export function createChannel(type, config, database) {
  const ChannelClass = CHANNEL_TYPES[type];
  if (!ChannelClass) {
    throw new Error(`Unknown channel type: ${type}. Available: ${Object.keys(CHANNEL_TYPES).join(', ')}`);
  }
  
  if (type === 'in_app') {
    return new ChannelClass(config, database);
  }
  
  return new ChannelClass(config);
}

export default {
  AlertChannel,
  EmailChannel,
  WebhookChannel,
  SlackChannel,
  PagerDutyChannel,
  OpsGenieChannel,
  InAppChannel,
  CHANNEL_TYPES,
  createChannel,
};