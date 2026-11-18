import React, { useState } from 'react';
import { Wifi, Radio, Users, MessageCircle, Settings } from 'lucide-react';

const mockPeers = [
  { id: '1', name: 'Alice', status: 'online', hops: 1, signal: 4 },
  { id: '2', name: 'Bob', status: 'online', hops: 2, signal: 3 },
  { id: '3', name: 'Charlie', status: 'relay', hops: 3, signal: 2 },
  { id: '4', name: 'Diana', status: 'offline', hops: 0, signal: 0 },
];

const mockMessages = [
  { id: '1', sender: 'Alice', text: 'Hey, how is the mesh network?', time: '10:30' },
  { id: '2', sender: 'You', text: 'All systems operational!', time: '10:31' },
  { id: '3', sender: 'Bob', text: 'Signal strength excellent', time: '10:32' },
];

const mockGroups = [
  { id: '1', name: 'Mesh Team', members: 4, unread: 2 },
  { id: '2', name: 'Network Ops', members: 6, unread: 0 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('peers');
  const [isRelayMode, setIsRelayMode] = useState(false);
  const [batteryLevel] = useState(85);

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6" />
            <h1 className="text-2xl font-bold">MeshTalk</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <div className="flex items-center gap-1">
                <Wifi className="w-4 h-4" />
                <span>Battery: {batteryLevel}%</span>
              </div>
            </div>
            <button
              onClick={() => setIsRelayMode(!isRelayMode)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isRelayMode
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {isRelayMode ? 'Relay ON' : 'Relay OFF'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <nav className="flex-1 p-4 space-y-2">
            {[
              { id: 'peers', label: 'Network', icon: Wifi },
              { id: 'messages', label: 'Messages', icon: MessageCircle },
              { id: 'groups', label: 'Groups', icon: Users },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-slate-950">
          <div className="max-w-7xl mx-auto p-6">
            {/* Peers Tab */}
            {activeTab === 'peers' && (
              <div>
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                  <Wifi className="w-8 h-8 text-blue-500" />
                  Network Topology
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {mockPeers.map((peer) => (
                    <div
                      key={peer.id}
                      className="bg-slate-900 rounded-lg p-4 border border-slate-800 hover:border-blue-500 transition"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{peer.name}</h3>
                        <div
                          className={`w-3 h-3 rounded-full ${
                            peer.status === 'online'
                              ? 'bg-green-500'
                              : peer.status === 'relay'
                              ? 'bg-yellow-500'
                              : 'bg-slate-600'
                          }`}
                        />
                      </div>
                      <div className="space-y-1 text-sm text-slate-400">
                        <p>Status: <span className="text-slate-200">{peer.status}</span></p>
                        <p>Hops: <span className="text-slate-200">{peer.hops}</span></p>
                        <p>Signal: <span className="text-slate-200">{'▁▂▃▄▅'[peer.signal]}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div>
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                  <MessageCircle className="w-8 h-8 text-purple-500" />
                  Direct Messages
                </h2>
                <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 space-y-3">
                    {mockMessages.map((msg) => (
                      <div key={msg.id} className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold">
                          {msg.sender[0]}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold">{msg.sender}</span>
                            <span className="text-xs text-slate-500">{msg.time}</span>
                          </div>
                          <p className="text-slate-300 text-sm">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-950 flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition">
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Groups Tab */}
            {activeTab === 'groups' && (
              <div>
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                  <Users className="w-8 h-8 text-green-500" />
                  Groups
                </h2>
                <div className="space-y-3">
                  {mockGroups.map((group) => (
                    <div
                      key={group.id}
                      className="bg-slate-900 rounded-lg p-4 border border-slate-800 hover:border-green-500 transition flex justify-between items-center"
                    >
                      <div>
                        <h3 className="font-semibold text-lg">{group.name}</h3>
                        <p className="text-sm text-slate-400">{group.members} members</p>
                      </div>
                      {group.unread > 0 && (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {group.unread}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                  <Settings className="w-8 h-8 text-orange-500" />
                  Settings
                </h2>
                <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 max-w-md space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Display Name</label>
                    <input
                      type="text"
                      defaultValue="Your Node"
                      className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Message TTL (hours)</label>
                    <input
                      type="number"
                      defaultValue="24"
                      className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition text-white">
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
