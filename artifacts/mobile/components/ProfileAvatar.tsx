import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Props {
  photo?: string;
  letter: string;
  color: string;
  size?: number;
  borderRadius?: number;
  style?: ViewStyle;
  showBorder?: boolean;
}

export function ProfileAvatar({
  photo,
  letter,
  color,
  size = 48,
  borderRadius,
  style,
  showBorder = true,
}: Props) {
  const radius = borderRadius ?? size * 0.33;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: "hidden",
    borderWidth: showBorder ? 1.5 : 0,
    borderColor: showBorder ? color + "60" : "transparent",
    backgroundColor: color + "20",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <View style={[containerStyle, style]}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            fontSize: size * 0.42,
            fontFamily: "Inter_700Bold",
            color,
          }}
        >
          {letter.toUpperCase()}
        </Text>
      )}
    </View>
  );
}
