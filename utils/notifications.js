export const NOTIFICATION_CHANNELS = ['PUSH', 'SMS', 'EMAIL'];
export const TEMPLATE_STATUSES = ['ACTIVE', 'INACTIVE'];
export const TARGET_TYPES = [
  'USER',
  'EMAIL',
  'DEVICE_IDS',
  'TOKEN_IDS',
  'PIN_CODE',
  'ADDRESS',
];
export const FREQUENCY_TYPES = ['ONCE', 'DAILY', 'WEEKLY', 'CRON'];
export const CAMPAIGN_STATUSES = [
  'SCHEDULED',
  'ACTIVE',
  'PROCESSING',
  'COMPLETED',
  'INACTIVE',
  'FAILED',
];

export const unwrapList = value => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (value?._embedded) {
    const list = Object.values(value._embedded).find(Array.isArray);
    return list || [];
  }
  return [];
};

export const splitValues = value =>
  String(value || '')
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean);

export const extractTemplateVariables = value => {
  const variables = new Set();
  const pattern = /\{\{([A-Za-z0-9_.-]+)\}\}|\{([A-Za-z0-9_.-]+)\}/g;
  let match;
  while ((match = pattern.exec(value || ''))) variables.add(match[1] || match[2]);
  return [...variables];
};

export const validateTemplateSyntax = value => {
  const residue = String(value || '').replace(
    /\{\{[A-Za-z0-9_.-]+\}\}|\{[A-Za-z0-9_.-]+\}/g,
    '',
  );
  return residue.includes('{') || residue.includes('}')
    ? 'Template variables must use {{variableName}} or {variableName}.'
    : null;
};

export const renderTemplate = (value, data = {}) =>
  String(value || '').replace(
    /\{\{([A-Za-z0-9_.-]+)\}\}|\{([A-Za-z0-9_.-]+)\}/g,
    (_, doubleName, singleName) => {
      const key = doubleName || singleName;
      return data[key] == null ? `{{${key}}}` : String(data[key]);
    },
  );

export const formatDateTime = value => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const campaignStatusColor = status => {
  switch (status) {
    case 'ACTIVE':
    case 'SCHEDULED':
      return '#16A34A';
    case 'PROCESSING':
      return '#2563EB';
    case 'COMPLETED':
      return '#64748B';
    case 'FAILED':
      return '#DC2626';
    case 'INACTIVE':
      return '#94A3B8';
    default:
      return '#7C3AED';
  }
};

export const campaignTypeColor = campaign => {
  if (campaign?.status === 'PROCESSING') return '#F59E0B';
  if (campaign?.status === 'COMPLETED') return '#94A3B8';
  if (campaign?.status === 'FAILED') return '#EF4444';
  if (campaign?.status === 'INACTIVE') return '#CBD5E1';
  if (campaign?.channel === 'EMAIL') return '#8B5CF6';
  if (campaign?.channel === 'SMS') return '#F59E0B';
  if (campaign?.templateCode === 'GENERIC_PUSH') return '#2563EB';
  if (campaign?.channel === 'PUSH') return '#0891B2';
  return '#64748B';
};

export const nextSuggestedSchedule = () =>
  new Date(Date.now() + 10 * 60 * 1000).toISOString();
