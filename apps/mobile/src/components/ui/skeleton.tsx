import { useEffect, useState } from "react";
import { Animated, type DimensionValue } from "react-native";

import { useTheme } from "@/theme/theme-provider";

export type SkeletonProps = {
  accessibilityLabel?: string;
  height: number;
  width?: DimensionValue;
};

export function Skeleton({
  accessibilityLabel = "Loading content",
  height,
  width = "100%",
}: SkeletonProps) {
  const { reduceMotionEnabled, theme } = useTheme();
  const [opacity] = useState(
    () => new Animated.Value(reduceMotionEnabled ? 0.7 : 0.55),
  );

  useEffect(() => {
    if (reduceMotionEnabled) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { duration: 700, toValue: 1, useNativeDriver: true }),
        Animated.timing(opacity, {
          duration: 700,
          toValue: 0.55,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotionEnabled]);

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      style={{
        backgroundColor: theme.colors.skeleton,
        borderRadius: theme.radii.compact,
        height,
        opacity,
        width,
      }}
    />
  );
}
