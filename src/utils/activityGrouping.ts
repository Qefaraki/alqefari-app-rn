/**
 * Activity Grouping Utilities
 * Groups consecutive activities by same actor/target for better UX
 */

export interface ActivityLog {
  id: string;
  created_at: string;
  actor_id: string;
  actor_name: string;
  target_id: string | null;
  target_name: string | null;
  action_type: string;
  description: string;
  changed_fields?: string[];
  old_data?: any;
  new_data?: any;
  [key: string]: any;
}

export interface ActivityGroup {
  type: 'group';
  actor_id: string;
  actor_name: string;
  target_id: string;
  target_name: string;
  activities: ActivityLog[];
  earliest_time: string;
  latest_time: string;
  count: number;
}

export type GroupedActivity = ActivityLog | ActivityGroup;

/**
 * Groups consecutive activities by same actor on same target within a time window
 * @param activities - Array of activity logs
 * @param windowMs - Time window in milliseconds (default: 5 minutes)
 * @returns Array of individual activities or grouped activities
 */
export const groupConsecutiveActivities = (
  activities: ActivityLog[],
  windowMs: number = 300000 // 5 minutes
): GroupedActivity[] => {
  const result: GroupedActivity[] = [];
  let currentGroup: ActivityGroup | null = null;

  activities.forEach(activity => {
    const shouldGroup =
      currentGroup &&
      currentGroup.actor_id === activity.actor_id &&
      currentGroup.target_id === activity.target_id &&
      new Date(activity.created_at).getTime() -
        new Date(currentGroup.latest_time).getTime() <
        windowMs;

    if (shouldGroup && currentGroup) {
      // Add to existing group
      currentGroup.activities.push(activity);
      currentGroup.latest_time = activity.created_at;
      currentGroup.count++;
    } else {
      // Push previous group if it exists
      if (currentGroup) {
        if (currentGroup.count > 1) {
          result.push(currentGroup);
        } else {
          result.push(currentGroup.activities[0]);
        }
      }

      // Start new group
      currentGroup = {
        type: 'group',
        actor_id: activity.actor_id,
        actor_name: activity.actor_name,
        target_id: activity.target_id || '',
        target_name: activity.target_name || '',
        activities: [activity],
        earliest_time: activity.created_at,
        latest_time: activity.created_at,
        count: 1,
      };
    }
  });

  // Push final group
  if (currentGroup) {
    if (currentGroup.count > 1) {
      result.push(currentGroup);
    } else {
      result.push(currentGroup.activities[0]);
    }
  }

  return result;
};

/**
 * Check if an item is a grouped activity
 */
export const isActivityGroup = (item: GroupedActivity): item is ActivityGroup => {
  return (item as ActivityGroup).type === 'group';
};

/**
 * Get display text for grouped activities
 */
export const getGroupDisplayText = (group: ActivityGroup): string => {
  return `${group.actor_name} قام بـ ${group.count} تغييرات على ملف ${group.target_name}`;
};
