import { supabase } from './supabase';

class BackgroundJobsService {
  constructor() {
    this.subscriptions = new Map();
    this.listeners = new Map();
  }

  // Subscribe to all background jobs
  subscribeToJobs(onUpdate) {
    const channelName = 'background-jobs-all';
    
    // Clean up existing subscription
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'background_jobs',
        },
        (payload) => {
          console.log('Background job update:', payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to jobs of a specific type
  subscribeToJobType(jobType, onUpdate) {
    const channelName = `background-jobs-${jobType}`;
    
    // Clean up existing subscription
    this.unsubscribe(channelName);

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'background_jobs',
          filter: `job_type=eq.${jobType}`,
        },
        (payload) => {
          console.log(`Background job update (${jobType}):`, payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, subscription);
    return () => this.unsubscribe(channelName);
  }

  // Get active jobs
  async getActiveJobs(jobType = null) {
    try {
      let query = supabase
        .from('background_jobs')
        .select('*')
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: false });

      if (jobType) {
        query = query.eq('job_type', jobType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching active jobs:', error);
      return { data: null, error };
    }
  }

  // Get recent jobs
  async getRecentJobs(limit = 10, jobType = null) {
    try {
      let query = supabase
        .from('background_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (jobType) {
        query = query.eq('job_type', jobType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching recent jobs:', error);
      return { data: null, error };
    }
  }

  // Get job by ID
  async getJob(jobId) {
    try {
      const { data, error } = await supabase
        .from('background_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching job:', error);
      return { data: null, error };
    }
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
export default new BackgroundJobsService();