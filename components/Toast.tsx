import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../constants/theme';

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onHide: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type,
  onHide,
  duration = 3000,
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onHide());
  };

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: THEME.colors.settledBg,
          borderColor: THEME.colors.settled,
          iconColor: THEME.colors.settled,
          icon: 'checkmark-circle' as const,
        };
      case 'error':
        return {
          backgroundColor: THEME.colors.cancelledBg,
          borderColor: THEME.colors.cancelled,
          iconColor: THEME.colors.cancelled,
          icon: 'close-circle' as const,
        };
      case 'warning':
        return {
          backgroundColor: THEME.colors.pendingBg,
          borderColor: THEME.colors.pending,
          iconColor: THEME.colors.pending,
          icon: 'warning' as const,
        };
      case 'info':
      default:
        return {
          backgroundColor: THEME.colors.confirmedBg,
          borderColor: THEME.colors.confirmed,
          iconColor: THEME.colors.confirmed,
          icon: 'information-circle' as const,
        };
    }
  };

  if (!visible) return null;

  const config = getTypeConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          transform: [{ translateY }],
        },
      ]}
    >
      <Ionicons name={config.icon} size={24} color={config.iconColor} />
      <Text style={[styles.message, { color: config.iconColor }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
    zIndex: 1000,
  },
  message: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Toast;
