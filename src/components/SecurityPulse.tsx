import React, { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet } from 'react-native'
import { C } from '../theme'

interface Props {
  size?: number
}

export function SecurityPulse({ size = 8 }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.dot,
          { width: size, height: size, borderRadius: size / 2, opacity },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  dot: { backgroundColor: C.primary, shadowColor: C.primary, shadowRadius: 6, shadowOpacity: 0.8, elevation: 3 },
})
