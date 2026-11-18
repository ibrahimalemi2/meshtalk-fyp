import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import Colors from "@/constants/colors";
import { Peer, NodeStatus } from "@/context/MeshContext";

const C = Colors.dark;
const { width } = Dimensions.get("window");
const MAP_SIZE = width - 40;
const CX = MAP_SIZE / 2;
const CY = MAP_SIZE / 2;

interface NodePosition {
  peer: Peer;
  x: number;
  y: number;
}

function getStatusColor(status: NodeStatus): string {
  if (status === "online") return C.online;
  if (status === "relay") return C.relay;
  return C.offline;
}

function getPeerPositions(peers: Peer[]): NodePosition[] {
  const radius = MAP_SIZE * 0.35;
  return peers.map((peer, i) => {
    const angle = (i / peers.length) * Math.PI * 2 - Math.PI / 2;
    const dist = peer.hops === 1 ? radius * 0.55 : peer.hops === 2 ? radius * 0.85 : radius;
    return {
      peer,
      x: CX + Math.cos(angle) * dist,
      y: CY + Math.sin(angle) * dist,
    };
  });
}

function PulsingNode({ x, y, color, size }: { x: number; y: number; color: string; size: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.5, { duration: 1500 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x - size,
    top: y - size,
    width: size * 2,
    height: size * 2,
    borderRadius: size,
    borderWidth: 1,
    borderColor: color,
    opacity: 1.6 - scale.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={style} />;
}

interface Props {
  peers: Peer[];
  compact?: boolean;
  myNode?: any;
}

export function TopologyMap({ peers, compact = false }: Props) {
  const positions = getPeerPositions(peers);
  const mapSize = compact ? MAP_SIZE * 0.7 : MAP_SIZE;
  const scale = compact ? 0.7 : 1;
  const myCX = mapSize / 2;
  const myCY = mapSize / 2;

  const rotateAnim = useSharedValue(0);
  useEffect(() => {
    rotateAnim.value = withRepeat(withTiming(360, { duration: 20000 }), -1);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateAnim.value}deg` }],
  }));

  return (
    <View style={[styles.container, { width: mapSize, height: mapSize }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.ring,
          ringStyle,
          {
            width: mapSize * 0.9,
            height: mapSize * 0.9,
            borderRadius: (mapSize * 0.9) / 2,
            left: mapSize * 0.05,
            top: mapSize * 0.05,
          },
        ]}
      />
      <Svg width={mapSize} height={mapSize} style={StyleSheet.absoluteFill}>
        {positions.map((pos) => {
          const color = getStatusColor(pos.peer.status);
          return (
            <Line
              key={`line-${pos.peer.id}`}
              x1={myCX}
              y1={myCY}
              x2={pos.x * scale + (1 - scale) * myCX}
              y2={pos.y * scale + (1 - scale) * myCY}
              stroke={color}
              strokeWidth={pos.peer.hops === 1 ? 1.5 : 0.8}
              strokeOpacity={pos.peer.status === "offline" ? 0.15 : pos.peer.hops === 1 ? 0.5 : 0.25}
              strokeDasharray={pos.peer.hops > 1 ? "4 6" : undefined}
            />
          );
        })}
        {positions.map((pos) => {
          const color = getStatusColor(pos.peer.status);
          const nx = pos.x * scale + (1 - scale) * myCX;
          const ny = pos.y * scale + (1 - scale) * myCY;
          const nodeSize = compact ? 6 : 8;
          return (
            <React.Fragment key={`node-${pos.peer.id}`}>
              <Circle
                cx={nx}
                cy={ny}
                r={nodeSize + 4}
                fill={color}
                fillOpacity={0.08}
              />
              <Circle
                cx={nx}
                cy={ny}
                r={nodeSize}
                fill={C.surfaceElevated}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={pos.peer.status === "offline" ? 0.3 : 0.8}
              />
              {!compact && (
                <SvgText
                  x={nx}
                  y={ny + 4}
                  textAnchor="middle"
                  fill={color}
                  fontSize={9}
                  fontWeight="bold"
                >
                  {pos.peer.avatar}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
        <Circle cx={myCX} cy={myCY} r={compact ? 16 : 22} fill={C.accentGlow} />
        <Circle
          cx={myCX}
          cy={myCY}
          r={compact ? 12 : 16}
          fill={C.surfaceElevated}
          stroke={C.accent}
          strokeWidth={2}
        />
      </Svg>
      {positions.map((pos) => {
        if (pos.peer.status !== "online") return null;
        const nx = pos.x * scale + (1 - scale) * myCX;
        const ny = pos.y * scale + (1 - scale) * myCY;
        return (
          <PulsingNode
            key={`pulse-${pos.peer.id}`}
            x={nx}
            y={ny}
            color={getStatusColor(pos.peer.status)}
            size={compact ? 8 : 12}
          />
        );
      })}
      {!compact && (
        <View style={[styles.myLabel, { left: myCX - 12, top: myCY - 10 }]}>
          <Feather name="radio" size={10} color={C.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: C.accent + "15",
    borderStyle: "dashed",
  },
  myLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
