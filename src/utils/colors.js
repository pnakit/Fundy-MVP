export const COLORS = {
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  primary: '#6366f1',
  muted: '#64748b',
};

export function getSuitabilityColor(score) {
  if (score >= 75) return COLORS.success;
  if (score >= 50) return COLORS.warning;
  return COLORS.danger;
}

export function getStatusColor(status) {
  switch (status) {
    case 'strong_match': return COLORS.success;
    case 'moderate_match': return COLORS.warning;
    case 'partial_match': return COLORS.primary;
    default: return COLORS.danger;
  }
}

export function getPriorityColor(priority) {
  switch (priority) {
    case 'critical': return COLORS.danger;
    case 'high': return COLORS.warning;
    case 'medium': return COLORS.primary;
    default: return COLORS.muted;
  }
}

export function getCategoryStatusColor(status) {
  switch (status) {
    case 'complete': return COLORS.success;
    case 'needs_attention': return COLORS.warning;
    case 'incomplete': return COLORS.danger;
    default: return COLORS.muted;
  }
}

export function getMaturityColor(level) {
  if (level >= 5) return '#8b5cf6';
  if (level >= 4) return COLORS.success;
  if (level >= 3) return COLORS.primary;
  if (level >= 2) return COLORS.warning;
  return COLORS.danger;
}

export function getPerformanceColor(score) {
  if (score >= 5) return '#8b5cf6';
  if (score >= 4) return COLORS.success;
  if (score >= 3) return COLORS.primary;
  if (score >= 2) return COLORS.warning;
  return COLORS.danger;
}

export function getPerformanceLabel(score) {
  const labels = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Exceptional' };
  return labels[Math.round(score)] || 'N/A';
}

export function getMaturityLabel(level) {
  const labels = { 1: 'Concept', 2: 'Early', 3: 'Validated', 4: 'Scaling', 5: 'Leader' };
  return labels[level] || 'N/A';
}
