import { supabase } from './supabase';

class RealtimeProfilesService {
  constructor() {
    this.subscriptions = new Map();
  }

  // Subscribe to all profile changes
  subscribeToProfiles(onUpdate) {
    const channelName = 'profiles-all';
    
    // Clean up existing subscription
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          console.log('Profile update:', payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to specific branch updates
  subscribeToBranch(branchHid, onUpdate) {
    const channelName = `profiles-branch-${branchHid}`;
    
    // Clean up existing subscription
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `hid=like.${branchHid}%`,
        },
        (payload) => {
          console.log(`Branch ${branchHid} update:`, payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to specific profile updates
  subscribeToProfile(profileId, onUpdate) {
    const channelName = `profile-${profileId}`;
    
    // Clean up existing subscription
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profileId}`,
        },
        (payload) => {
          console.log(`Profile ${profileId} update:`, payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to children of a specific parent
  subscribeToChildren(parentId, onUpdate) {
    const channelName = `children-${parentId}`;
    
    // Clean up existing subscription
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `father_id=eq.${parentId}`,
        },
        (payload) => {
          console.log(`Children of ${parentId} update:`, payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return () => this.unsubscribe(channelName);
  }

  // Clean up subscription
  unsubscribe(channelName) {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(channelName);
    }
  }

  // Clean up all subscriptions
  unsubscribeAll() {
    for (const [channelName] of this.subscriptions) {
      this.unsubscribe(channelName);
    }
  }
}

// Export singleton instance
export default new RealtimeProfilesService();