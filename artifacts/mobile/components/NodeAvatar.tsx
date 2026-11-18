import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { NodeStatus } from "@/context/MeshContext";

const C = Colors.dark;

interface Props {
  avatar: string;
  status: NodeStatus;
  size?: number;
  showPulse?: boolean;
}

export function NodeAvatar({ avatar, status, size = 44, showPulse = false }: Props) {
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (status === "online" && showPulse) {
      pulse.value = withRepeat(withTiming(1.3, { duration: 1200 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [status, showPulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulse.value > 1 ? 2 - pulse.value : 1,
  }));

  const statusColor =
    status === "online" ? C.online : status === "relay" ? C.relay : C.offline;

  const dotSize = size * 0.28;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {status === "online" && showPulse && (
        <Animated.View
          style={[
            styles.pulse,
            pulseStyle,
            {
              width: size * 1.5,
              height: size * 1.5,
              borderRadius: (size * 1.5) / 2,
              borderColor: statusColor,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: statusColor + "60",
          },
        ]}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{avatar}</Text>
      </View>
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor: statusColor,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            bottom: 0,
            right: 0,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    borderWidth: 1,
  },
  avatar: {
    backgroundColor: C.surfaceElevated,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: C.accent,
    fontFamily: "Inter_700Bold",
  },
  statusDot: {
    position: "absolute",
    borderWidth: 2,
    borderColor: C.surface,
  },
});
