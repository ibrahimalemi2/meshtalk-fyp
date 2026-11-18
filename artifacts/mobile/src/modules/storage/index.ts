/**
 * Storage Module - Public API
 * Other modules ONLY use this interface
 * Implementation details (expo-sqlite, ORM) are hidden
 */

import { Platform } from 'react-native';

let orm: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line global-require
  orm = require('./operations').orm;
}

interface StorageAPI {
  // User operations
  saveUser: (id: string, name: string, color: string) => Promise<void>;
  getUser: (id: string) => Promise<any>;
  getAllUsers: () => Promise<any[]>;
  updateUserStatus: (id: string, isOnline: boolean) => Promise<void>;

  // Message operations
  saveMessage: (message: any) => Promise<void>;
  getMessages: (conversationId: string, limit?: number) => Promise<any[]>;
  markMessageAsDelivered: (messageId: string) => Promise<void>;
  deleteExpiredMessages: () => Promise<number>; // Returns count deleted

  // Group operations
  createGroup: (name: string, creatorId: string) => Promise<string>;
  getGroup: (groupId: string) => Promise<any>;
  addMemberToGroup: (groupId: string, userId: string) => Promise<void>;

  // Routing table operations
  updateRoute: (destination: string, nextHop: string, cost: number) => Promise<void>;
  getRoute: (destination: string) => Promise<any>;
  getAllRoutes: () => Promise<any[]>;

  // Crypto session operations
  saveSession: (sessionId: string, data: any) => Promise<void>;
  getSession: (sessionId: string) => Promise<any>;
  saveSkippedMessage: (sessionId: string, chainKey: string, messageKey: string, number: number) => Promise<void>;

  // Lifecycle
  init: () => Promise<void>;
  close: () => Promise<void>;
}

class StorageModule implements StorageAPI {
  async init() {
    if (orm) {
      await orm.init();
      console.log('[Storage] Initialized with expo-sqlite');
    } else {
      console.log('[Storage] Using in-memory storage (web platform)');
    }
  }

  async saveUser(id: string, name: string, color: string) {
    if (orm) await orm.saveUser(id, name, color);
  }

  async getUser(id: string) {
    if (orm) return await orm.getUser(id);
    return null;
  }

  async getAllUsers() {
    if (orm) return await orm.getAllUsers();
    return [];
  }

  async updateUserStatus(id: string, isOnline: boolean) {
    if (orm) await orm.updateUserStatus(id, isOnline);
  }

  async saveMessage(message: any) {
    if (orm) await orm.saveMessage(message);
  }

  async getMessages(conversationId: string, limit = 50) {
    if (orm) return await orm.getMessages(conversationId, undefined, limit);
    return [];
  }

  async markMessageAsDelivered(messageId: string) {
    if (orm) await orm.markMessageAsDelivered(messageId);
  }

  async deleteExpiredMessages() {
    if (orm) return await orm.deleteExpiredMessages();
    return 0;
  }

  async createGroup(name: string, creatorId: string) {
    const groupId = `group-${Date.now()}`;
    if (orm) await orm.createGroup(groupId, name, creatorId);
    return groupId;
  }

  async getGroup(groupId: string) {
    if (orm) return await orm.getGroup(groupId);
    return null;
  }

  async addMemberToGroup(groupId: string, userId: string) {
    if (orm) await orm.addMemberToGroup(groupId, userId);
  }

  async updateRoute(destination: string, nextHop: string, cost: number) {
    if (orm) await orm.updateRoute(destination, nextHop, cost);
  }

  async getRoute(destination: string) {
    if (orm) return await orm.getRoute(destination);
    return null;
  }

  async getAllRoutes() {
    if (orm) return await orm.getAllRoutes();
    return [];
  }

  async saveSession(sessionId: string, data: any) {
    if (orm) await orm.saveSession(sessionId, data);
  }

  async getSession(sessionId: string) {
    if (orm) return await orm.getSession(sessionId);
    return null;
  }

  async saveSkippedMessage(sessionId: string, chainKey: string, messageKey: string, number: number) {
    if (orm) await orm.saveSkippedMessage(sessionId, number, messageKey);
  }

  async close() {
    if (orm) await orm.close();
  }
}

// Singleton instance
export const storage = new StorageModule();

// Export only the public API type
export type { StorageAPI };
