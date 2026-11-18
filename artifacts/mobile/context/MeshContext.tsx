import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProtocolEngine, type DiscoveredPeer } from "@/modules";

export type NodeStatus = "online" | "relay" | "offline";
export type MessageType = "text" | "image" | "voice" | "broadcast";
export type MessageStatus = "sending" | "sent" | "delivered" | "failed";

export interface Reaction {
  emoji: string;
  senderId: string;
}

export interface Peer {
  id: string;
  displayName: string;
  publicKey: string;
  avatar: string;
  avatarColor: string;
  status: NodeStatus;
  hops: number;
  signalStrength: number;
  isRelay: boolean;
  batteryLevel: number;
  lastSeen: number;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string | null;
  groupId: string | null;
  type: MessageType;
  content: string;
  imageUri?: string;
  timestamp: number;
  status: MessageStatus;
  hops: number;
  encrypted: boolean;
  ttl: number;
  expiresAt: number;
  reactions: Reaction[];
  replyTo?: string;
}

export interface Conversation {
  id: string;
  peerId: string;
  messages: Message[];
  lastMessage: Message | null;
  unreadCount: number;
  typingUntil?: number;
}

export interface Group {
  id: string;
  name: string;
  avatar: string;
  avatarColor: string;
  memberIds: string[];
  createdAt: number;
  messages: Message[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface MeshNode {
  id: string;
  displayName: string;
  publicKey: string;
  avatar: string;
  avatarColor: string;
  profilePhoto?: string;
  isRelayMode: boolean;
  batteryLevel: number;
  hasOnboarded: boolean;
}

interface MeshContextValue {
  myNode: MeshNode | null;
  peers: Peer[];
  conversations: Conversation[];
  groups: Group[];
  broadcasts: Message[];
  isRelayMode: boolean;
  defaultTtl: number;
  isInitialized: boolean;
  setRelayMode: (v: boolean) => void;
  setDefaultTtl: (ttl: number) => void;
  updateProfile: (displayName: string, avatarColor: string, profilePhoto?: string | null) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  sendMessage: (recipientId: string, type: MessageType, content: string, imageUri?: string, replyTo?: string) => Promise<void>;
  sendVoiceMessage: (recipientId: string, audioData: Uint8Array) => Promise<void>;
  sendGroupMessage: (groupId: string, type: MessageType, content: string, imageUri?: string) => Promise<void>;
  sendBroadcast: (content: string) => Promise<void>;
  getConversation: (peerId: string) => Conversation | null;
  getGroup: (groupId: string) => Group | null;
  createGroup: (name: string, memberIds: string[], avatarColor: string) => Promise<Group>;
  markRead: (peerId: string) => void;
  markGroupRead: (groupId: string) => void;
  deleteMessage: (peerId: string, messageId: string) => void;
  clearConversation: (peerId: string) => void;
  addReaction: (peerId: string, messageId: string, emoji: string) => void;
  addGroupReaction: (groupId: string, messageId: string, emoji: string) => void;
  setTyping: (peerId: string, isTyping: boolean) => void;
  totalUnread: number;
}

const MeshContext = createContext<MeshContextValue | null>(null);

const STORAGE_KEYS = {
  MY_NODE: "meshtalk_my_node_v2",
  CONVERSATIONS: "meshtalk_conversations_v2",
  BROADCASTS: "meshtalk_broadcasts_v2",
  GROUPS: "meshtalk_groups_v2",
  SETTINGS: "meshtalk_settings_v2",
};

const AVATAR_COLORS = [
  "#00FF87", "#00B4FF", "#FF4757", "#FFA502",
  "#9C59D1", "#FF6B9D", "#2ED573", "#1E90FF",
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function pickColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export const AVATAR_COLOR_OPTIONS = AVATAR_COLORS;

export function MeshProvider({ children }: { children: React.ReactNode }) {
  const [protocolEngine, setProtocolEngine] = useState<ProtocolEngine | null>(null);
  const [myNode, setMyNode] = useState<MeshNode | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [broadcasts, setBroadcasts] = useState<Message[]>([]);
  const [isRelayMode, setRelayModeState] = useState(false);
  const [defaultTtl, setDefaultTtlState] = useState(48);
  const [isInitialized, setIsInitialized] = useState(false);
  const peerMapRef = useRef<Map<string, Peer>>(new Map());
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Initialize protocol engine and load data on mount
  useEffect(() => {
    let mounted = true;
    const cleanup: Array<() => void> = [];

    const initializeProtocol = async () => {
      try {
        // Load user node first
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.MY_NODE);
        let node: MeshNode;
        
        if (stored) {
          node = JSON.parse(stored);
        } else {
          const id = generateId();
          node = {
            id,
            displayName: "My Node",
            publicKey: `Ed25519:${id.slice(0, 16)}`,
            avatar: "M",
            avatarColor: "#00FF87",
            isRelayMode: false,
            batteryLevel: 85,
            hasOnboarded: false,
          };
          await AsyncStorage.setItem(STORAGE_KEYS.MY_NODE, JSON.stringify(node));
        }

        if (!mounted) return;
        setMyNode(node);

        // Initialize ProtocolEngine
        try {
          const engine = new ProtocolEngine({
            displayName: node.displayName,
            avatarColor: node.avatarColor,
            enableRelay: isRelayMode,
          });

          await engine.init();

          if (!mounted) return;
          setProtocolEngine(engine);

          // Import transport to subscribe to peer events
          try {
            const { transport } = await import('@/modules');
            
            // Register listeners for peer discovery
            const { remove: removePeerDiscovered } = transport.onPeerDiscovered((peer: DiscoveredPeer) => {
              if (!mounted) return;
              
              const meshPeer: Peer = {
                id: peer.publicKey,
                displayName: peer.displayName,
                publicKey: peer.publicKey,
                avatar: peer.displayName?.charAt(0).toUpperCase() || "?",
                avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
                status: "online",
                hops: 0,
                signalStrength: Math.max(0, Math.min(100, ((peer.signalStrength + 100) / 100) * 100)),
                isRelay: peer.isRelay || false,
                batteryLevel: peer.batteryLevel || 50,
                lastSeen: Date.now(),
              };
              
              peerMapRef.current.set(peer.publicKey, meshPeer);
              setPeers(Array.from(peerMapRef.current.values()));
            });

            // Register listener for peer lost
            const { remove: removePeerLost } = transport.onPeerLost((publicKey: string) => {
              if (!mounted) return;
              
              peerMapRef.current.delete(publicKey);
              setPeers(Array.from(peerMapRef.current.values()));
            });

            cleanup.push(
              () => removePeerDiscovered(),
              () => removePeerLost()
            );
          } catch (transportErr) {
            console.warn('[MeshProvider] Transport/native modules not available (Expo Go limitation):', transportErr);
            // App continues without peer discovery in Expo Go
          }

          // Load conversations and other data
          await loadData();

          setIsInitialized(true);
        } catch (err) {
          console.error('[MeshProvider] Failed to initialize protocol:', err);
          // Still mark as initialized so UI doesn't hang
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('[MeshProvider] Setup failed:', err);
        setIsInitialized(true);
      }
    };

    initializeProtocol();

    return () => {
      mounted = false;
      cleanup.forEach(fn => fn?.());
      protocolEngine?.shutdown().catch(console.error);
    };
  }, []);

  // Load conversation data from storage
  async function loadData() {
    try {
      const [convData, bcastData, settingsData, groupData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.BROADCASTS),
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.GROUPS),
      ]);
      if (convData) setConversations(JSON.parse(convData));
      if (bcastData) setBroadcasts(JSON.parse(bcastData));
      if (groupData) setGroups(JSON.parse(groupData));
      if (settingsData) {
        const s = JSON.parse(settingsData);
        if (s.isRelayMode !== undefined) setRelayModeState(s.isRelayMode);
        if (s.defaultTtl !== undefined) setDefaultTtlState(s.defaultTtl);
      }
    } catch (e) {
      console.error("loadData error", e);
    }
  }

  async function persistConversations(convs: Conversation[]) {
    try { await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs)); } catch {}
  }
  async function persistBroadcasts(bcasts: Message[]) {
    try { await AsyncStorage.setItem(STORAGE_KEYS.BROADCASTS, JSON.stringify(bcasts)); } catch {}
  }
  async function persistGroups(gs: Group[]) {
    try { await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(gs)); } catch {}
  }
  async function persistSettings(s: { isRelayMode: boolean; defaultTtl: number }) {
    try { await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s)); } catch {}
  }

  const setRelayMode = useCallback(async (v: boolean) => {
    setRelayModeState(v);
    await persistSettings({ isRelayMode: v, defaultTtl });
  }, [defaultTtl]);

  const setDefaultTtl = useCallback(async (ttl: number) => {
    setDefaultTtlState(ttl);
    await persistSettings({ isRelayMode, defaultTtl: ttl });
  }, [isRelayMode]);

  const updateProfile = useCallback(async (displayName: string, avatarColor: string, profilePhoto?: string | null) => {
    setMyNode((prev) => {
      if (!prev) return prev;
      const updated: MeshNode = {
        ...prev,
        displayName,
        avatarColor,
        avatar: displayName.charAt(0).toUpperCase(),
        profilePhoto: profilePhoto === null ? undefined : (profilePhoto ?? prev.profilePhoto),
      };
      AsyncStorage.setItem(STORAGE_KEYS.MY_NODE, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const completeOnboarding = useCallback(async () => {
    setMyNode((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, hasOnboarded: true };
      AsyncStorage.setItem(STORAGE_KEYS.MY_NODE, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const sendMessage = useCallback(
    async (recipientId: string, type: MessageType, content: string, imageUri?: string, replyTo?: string) => {
      if (!myNode || !protocolEngine) return;

      const msg: Message = {
        id: generateId(),
        senderId: myNode.id,
        recipientId,
        groupId: null,
        type,
        content,
        imageUri,
        timestamp: Date.now(),
        status: "sending",
        hops: 0,
        encrypted: true,
        ttl: defaultTtl,
        expiresAt: Date.now() + defaultTtl * 3600000,
        reactions: [],
        replyTo,
      };

      // Add to local state immediately for optimistic UI
      setConversations((prev) => {
        const existing = prev.find((c) => c.peerId === recipientId);
        let updated: Conversation[];
        if (existing) {
          updated = prev.map((c) =>
            c.peerId === recipientId ? { ...c, messages: [...c.messages, msg], lastMessage: msg } : c
          );
        } else {
          updated = [...prev, { id: generateId(), peerId: recipientId, messages: [msg], lastMessage: msg, unreadCount: 0 }];
        }
        persistConversations(updated);
        return updated;
      });

      // Send through ProtocolEngine
      try {
        if (type === "voice") {
          // Voice messages are sent as Uint8Array
          await protocolEngine.sendVoiceMessage(recipientId, content as any);
        } else {
          await protocolEngine.sendMessage(recipientId, content);
        }

        // Update status to sent
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.peerId === recipientId
              ? {
                  ...c,
                  messages: c.messages.map((m) => m.id === msg.id ? { ...m, status: "sent" as MessageStatus } : m),
                  lastMessage: c.lastMessage?.id === msg.id ? { ...c.lastMessage, status: "sent" as MessageStatus } : c.lastMessage,
                }
              : c
          );
          persistConversations(updated);
          return updated;
        });

        // Update status to delivered after delay
        setTimeout(() => {
          setConversations((prev) => {
            const updated = prev.map((c) =>
              c.peerId === recipientId
                ? {
                    ...c,
                    messages: c.messages.map((m) => m.id === msg.id ? { ...m, status: "delivered" as MessageStatus } : m),
                    lastMessage: c.lastMessage?.id === msg.id ? { ...c.lastMessage, status: "delivered" as MessageStatus } : c.lastMessage,
                  }
                : c
            );
            persistConversations(updated);
            return updated;
          });
        }, 1500);
      } catch (err) {
        console.error('[MeshContext] sendMessage failed:', err);
        // Update status to failed
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.peerId === recipientId
              ? {
                  ...c,
                  messages: c.messages.map((m) => m.id === msg.id ? { ...m, status: "failed" as MessageStatus } : m),
                  lastMessage: c.lastMessage?.id === msg.id ? { ...c.lastMessage, status: "failed" as MessageStatus } : c.lastMessage,
                }
              : c
          );
          persistConversations(updated);
          return updated;
        });
      }
    },
    [myNode, protocolEngine, defaultTtl]
  );

  const sendVoiceMessage = useCallback(
    async (recipientId: string, audioData: Uint8Array) => {
      return sendMessage(recipientId, "voice", audioData as any);
    },
    [sendMessage]
  );

  const sendGroupMessage = useCallback(
    async (groupId: string, type: MessageType, content: string, imageUri?: string) => {
      if (!myNode) return;
      const msg: Message = {
        id: generateId(),
        senderId: myNode.id,
        recipientId: null,
        groupId,
        type,
        content,
        imageUri,
        timestamp: Date.now(),
        status: "sending",
        hops: 0,
        encrypted: true,
        ttl: defaultTtl,
        expiresAt: Date.now() + defaultTtl * 3600000,
        reactions: [],
      };

      setGroups((prev) => {
        const updated = prev.map((g) =>
          g.id === groupId ? { ...g, messages: [...g.messages, msg], lastMessage: msg } : g
        );
        persistGroups(updated);
        return updated;
      });

      setTimeout(() => {
        setGroups((prev) => {
          const updated = prev.map((g) =>
            g.id === groupId
              ? { ...g, messages: g.messages.map((m) => m.id === msg.id ? { ...m, status: "delivered" as MessageStatus } : m) }
              : g
          );
          persistGroups(updated);
          return updated;
        });
      }, 1800);
    },
    [myNode, defaultTtl]
  );

  const sendBroadcast = useCallback(async (content: string) => {
    if (!myNode || !protocolEngine) return;
    const msg: Message = {
      id: generateId(),
      senderId: myNode.id,
      recipientId: null,
      groupId: null,
      type: "broadcast",
      content,
      timestamp: Date.now(),
      status: "sent",
      hops: 0,
      encrypted: false,
      ttl: 1,
      expiresAt: Date.now() + 3600000,
      reactions: [],
    };
    setBroadcasts((prev) => {
      const updated = [msg, ...prev];
      persistBroadcasts(updated);
      return updated;
    });
    try {
      await protocolEngine.broadcastEmergency(content);
    } catch (err) {
      console.error('[MeshContext] broadcastEmergency failed:', err);
    }
  }, [myNode, protocolEngine]);

  const getConversation = useCallback(
    (peerId: string) => conversations.find((c) => c.peerId === peerId) ?? null,
    [conversations]
  );

  const getGroup = useCallback(
    (groupId: string) => groups.find((g) => g.id === groupId) ?? null,
    [groups]
  );

  const createGroup = useCallback(async (name: string, memberIds: string[], avatarColor: string): Promise<Group> => {
    const group: Group = {
      id: generateId(),
      name,
      avatar: name.charAt(0).toUpperCase(),
      avatarColor,
      memberIds,
      createdAt: Date.now(),
      messages: [],
      lastMessage: null,
      unreadCount: 0,
    };
    setGroups((prev) => {
      const updated = [...prev, group];
      persistGroups(updated);
      return updated;
    });
    return group;
  }, []);

  const markRead = useCallback((peerId: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) => c.peerId === peerId ? { ...c, unreadCount: 0 } : c);
      persistConversations(updated);
      return updated;
    });
  }, []);

  const markGroupRead = useCallback((groupId: string) => {
    setGroups((prev) => {
      const updated = prev.map((g) => g.id === groupId ? { ...g, unreadCount: 0 } : g);
      persistGroups(updated);
      return updated;
    });
  }, []);

  const deleteMessage = useCallback((peerId: string, messageId: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.peerId !== peerId) return c;
        const msgs = c.messages.filter((m) => m.id !== messageId);
        return { ...c, messages: msgs, lastMessage: msgs.length > 0 ? msgs[msgs.length - 1] : null };
      });
      persistConversations(updated);
      return updated;
    });
  }, []);

  const clearConversation = useCallback((peerId: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.peerId === peerId ? { ...c, messages: [], lastMessage: null, unreadCount: 0 } : c
      );
      persistConversations(updated);
      return updated;
    });
  }, []);

  const addReaction = useCallback((peerId: string, messageId: string, emoji: string) => {
    if (!myNode) return;
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.peerId !== peerId) return c;
        return {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== messageId) return m;
            const existing = m.reactions.find((r) => r.senderId === myNode.id);
            const reactions = existing
              ? m.reactions.map((r) => r.senderId === myNode.id ? { ...r, emoji } : r)
              : [...m.reactions, { emoji, senderId: myNode.id }];
            return { ...m, reactions };
          }),
        };
      });
      persistConversations(updated);
      return updated;
    });
  }, [myNode]);

  const addGroupReaction = useCallback((groupId: string, messageId: string, emoji: string) => {
    if (!myNode) return;
    setGroups((prev) => {
      const updated = prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          messages: g.messages.map((m) => {
            if (m.id !== messageId) return m;
            const existing = m.reactions.find((r) => r.senderId === myNode.id);
            const reactions = existing
              ? m.reactions.map((r) => r.senderId === myNode.id ? { ...r, emoji } : r)
              : [...m.reactions, { emoji, senderId: myNode.id }];
            return { ...m, reactions };
          }),
        };
      });
      persistGroups(updated);
      return updated;
    });
  }, [myNode]);

  const setTyping = useCallback((peerId: string, isTyping: boolean) => {
    if (typingTimersRef.current[peerId]) {
      clearTimeout(typingTimersRef.current[peerId]);
    }
    if (isTyping) {
      setConversations((prev) =>
        prev.map((c) => c.peerId === peerId ? { ...c, typingUntil: Date.now() + 3000 } : c)
      );
      typingTimersRef.current[peerId] = setTimeout(() => {
        setConversations((prev) =>
          prev.map((c) => c.peerId === peerId ? { ...c, typingUntil: undefined } : c)
        );
      }, 3000);
    } else {
      setConversations((prev) =>
        prev.map((c) => c.peerId === peerId ? { ...c, typingUntil: undefined } : c)
      );
    }
  }, []);

  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + c.unreadCount, 0) + groups.reduce((s, g) => s + g.unreadCount, 0),
    [conversations, groups]
  );

  const value = useMemo(
    () => ({
      myNode, peers, conversations, groups, broadcasts,
      isRelayMode, defaultTtl, isInitialized,
      setRelayMode, setDefaultTtl, updateProfile, completeOnboarding,
      sendMessage, sendVoiceMessage, sendGroupMessage, sendBroadcast,
      getConversation, getGroup, createGroup,
      markRead, markGroupRead, deleteMessage, clearConversation,
      addReaction, addGroupReaction, setTyping,
      totalUnread,
    }),
    [myNode, peers, conversations, groups, broadcasts, isRelayMode, defaultTtl, isInitialized,
     setRelayMode, setDefaultTtl, updateProfile, completeOnboarding,
     sendMessage, sendVoiceMessage, sendGroupMessage, sendBroadcast,
     getConversation, getGroup, createGroup,
     markRead, markGroupRead, deleteMessage, clearConversation,
     addReaction, addGroupReaction, setTyping, totalUnread]
  );

  return <MeshContext.Provider value={value}>{children}</MeshContext.Provider>;
}

export function useMesh() {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error("useMesh must be used within MeshProvider");
  return ctx;
}
