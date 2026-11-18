import React from "react";
import { StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Props {
  strength: number;
  size?: "sm" | "md";
}

export function SignalBar({ strength, size = "sm" }: Props) {
  const bars = 4;
  const activeBars = Math.ceil((strength / 100) * bars);
  const barWidth = size === "sm" ? 3 : 4;
  const gap = size === "sm" ? 2 : 3;
  const maxHeight = size === "sm" ? 12 : 16;

  return (
    <View style={[styles.container, { gap }]}>
      {Array.from({ length: bars }).map((_, i) => {
        const active = i < activeBars;
        const barHeight = maxHeight * ((i + 1) / bars);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                width: barWidth,
                height: barHeight,
                backgroundColor: active ? C.accent : C.textMuted,
                opacity: active ? 1 : 0.4,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  bar: {
    borderRadius: 1.5,
  },
});
