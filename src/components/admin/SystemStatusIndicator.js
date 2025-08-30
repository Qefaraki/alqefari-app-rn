import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAdminMode } from '../../contexts/AdminModeContext';
import GlassMetricPill from '../glass/GlassMetricPill';

const SystemStatusIndicator = () => {
  const { isAdminMode } = useAdminMode();
  const [activeJobs, setActiveJobs] = useState([]);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (!isAdminMode) return;

    // Initial fetch of active jobs
    fetchActiveJobs();

    // Subscribe to background_jobs changes
    const subscription = supabase
      .channel('background_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'background_jobs',
          filter: `status=in.(queued,processing)`,
        },
        () => {
          fetchActiveJobs();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isAdminMode]);

  useEffect(() => {
    // Animate indicator based on active jobs
    const hasActiveJobs = activeJobs.length > 0;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: hasActiveJobs ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: hasActiveJobs ? 0 : -100,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }),
    ]).start();
  }, [activeJobs, fadeAnim, slideAnim]);

  const fetchActiveJobs = async () => {
    const { data, error } = await supabase
      .from('background_jobs')
      .select('*')
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setActiveJobs(data);
    }
  };

  if (!isAdminMode || activeJobs.length === 0) return null;

  const processingCount = activeJobs.filter(job => job.status === 'processing').length;
  const queuedCount = activeJobs.filter(job => job.status === 'queued').length;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <ActivityIndicator size="small" color="#007AFF" style={styles.spinner} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>معالجة البيانات</Text>
          <Text style={styles.subtitle}>
            {processingCount > 0 && `${processingCount} قيد المعالجة`}
            {processingCount > 0 && queuedCount > 0 && ' • '}
            {queuedCount > 0 && `${queuedCount} في الانتظار`}
          </Text>
        </View>
      </View>
      
      {/* Job type breakdown */}
      {activeJobs.some(job => job.job_type === 'layout_recalculation') && (
        <View style={styles.jobTypeContainer}>
          <GlassMetricPill
            label="إعادة حساب التخطيط"
            value={activeJobs.filter(job => job.job_type === 'layout_recalculation').length}
            color="#007AFF"
          />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 998,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  spinner: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'right',
  },
  jobTypeContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});

export default SystemStatusIndicator;