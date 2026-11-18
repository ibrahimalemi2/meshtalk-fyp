/**
 * Storage Module - Web Implementation
 * Dummy/in-memory fallback since expo-sqlite is not supported on web
 */

const dummyStorage = {
  init: async () => {
    console.log('[Storage] Using dummy storage on web platform');
  },
  saveUser: async () => {},
  getUser: async () => null,
  getAllUsers: async () => [],
  updateUserStatus: async () => {},
  saveMessage: async () => {},
  getMessages: async () => [],
  markMessageAsDelivered: async () => {},
  deleteExpiredMessages: async () => 0,
  createGroup: async () => `group-${Date.now()}`,
  getGroup: async () => null,
  addMemberToGroup: async () => {},
  updateRoute: async () => {},
  getRoute: async () => null,
  getAllRoutes: async () => [],
  saveSession: async () => {},
  getSession: async () => null,
  saveSkippedMessage: async () => {},
  close: async () => {},
};

export const storage = dummyStorage;
export type StorageAPI = typeof dummyStorage;
