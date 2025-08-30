import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import backgroundJobsService from '../../services/backgroundJobs';
import { useAdminMode } from '../../contexts/AdminModeContext';

const SystemStatusIndicator = () => {
  const { isAdminMode } = useAdminMode();
  const [activeJobs, setActiveJobs] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(-100);

  useEffect(() => {
    if (!isAdminMode) return;

    // Initial load
    loadActiveJobs();

    // Subscribe to job updates
    const unsubscribe = backgroundJobsService.subscribeToJobs((payload) => {
      handleJobUpdate(payload);
    });

    return () => {
      unsubscribe();
    };
  }, [isAdminMode]);

  useEffect(() => {
    // Animate visibility
    if (activeJobs.length > 0 && isAdminMode) {
      setIsVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setIsVisible(false));
    }
  }, [activeJobs.length, isAdminMode]);

  const loadActiveJobs = async () => {
    const { data, error } = await backgroundJobsService.getActiveJobs();
    if (!error && data) {
      setActiveJobs(data);
    }
  };

  const handleJobUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (newRecord.status === 'queued' || newRecord.status === 'processing') {
        setActiveJobs(prev => {
          const exists = prev.find(job => job.id === newRecord.id);
          if (exists) {
            return prev.map(job => job.id === newRecord.id ? newRecord : job);
          }
          return [...prev, newRecord];
        });
      } else {
        // Job completed or failed, remove from active list
        setActiveJobs(prev => prev.filter(job => job.id !== newRecord.id));
      }
    } else if (eventType === 'DELETE') {
      setActiveJobs(prev => prev.filter(job => job.id !== oldRecord.id));
    }
  };

  const getStatusText = () => {
    if (activeJobs.length === 0) return '';
    
    const processingJobs = activeJobs.filter(job => job.status === 'processing');
    const queuedJobs = activeJobs.filter(job => job.status === 'queued');

    if (processingJobs.length > 0) {
      const job = processingJobs[0];
      if (job.job_type === 'layout_recalculation') {
        return 'إعادة حساب التخطيط...';
      }
      return 'معالجة...';
    }

    if (queuedJobs.length > 0) {
      return `${queuedJobs.length} في الانتظار`;
    }

    return '';
  };

  if (!isVisible) return null;

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
      <View style={styles.glassWrapper}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        
        <View style={styles.content}>
          <ActivityIndicator size="small" color="#007AFF" style={styles.spinner} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
        
        <View style={styles.border} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 1000,
  },
  glassWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  spinner: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    fontFamily: Platform.select({
      ios: 'SF Arabic',
      android: 'Arial',
    }),
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

export default SystemStatusIndicator;