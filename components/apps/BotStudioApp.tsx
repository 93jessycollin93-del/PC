import React, { useState, useEffect, useRef } from 'react';
import { Bot, Cpu, Database, Network, HardDrive, Wifi, WifiOff, Bluetooth, RefreshCw, Plus, Edit2, Trash2, Play, Upload, MessageSquare, ChevronLeft, Send, Save, ArrowLeft } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { initDB, saveToStore, getFromStore, deleteFromStore, queueSyncAction, getSyncQueue, clearSyncQueue } from '../../lib/idb';

interface OfflineBot {
  id: string;
  name: string;
  avatar_image_url: string;
  role: string;
  system_prompt: string;
  model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  memory_pod_id: string;
  is_agent: boolean;
  tools_enabled: boolean;
  created_by: string;
}

interface MemoryPod {
  id: string;
  name: string;
  description: string;
  tags: string[];
  summary: string;
  raw_notes: string;
  token_estimate: number;
  created_date: number;
  created_by: string;
}

interface BotChat {
  id: string;
  bot_id: string;
  title: string;
  created_date: number;
  created_by: string;
}

interface BotMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  created_by: string;
}

export const BotStudioApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'chat' | 'pods' | 'connectivity'>('gallery');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Connectivity
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [bluetoothSupported, setBluetoothSupported] = useState<boolean>('bluetooth' in navigator);
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncQueueLength, setSyncQueueLength] = useState(0);

  // Ollama
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('bot_studio_ollama_url') || 'http://localhost:11434');
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [ollamaModels, setOllamaModels] = useState<any[]>([]);

  // Data
  const [bots, setBots] = useState<OfflineBot[]>([]);
  const [pods, setPods] = useState<MemoryPod[]>([]);
  const [chats, setChats] = useState<BotChat[]>([]);
  
  // States
  const [editingBot, setEditingBot] = useState<OfflineBot | null>(null);
  const [editingPod, setEditingPod] = useState<MemoryPod | null>(null);
  const [activeChat, setActiveChat] = useState<BotChat | null>(null);
  const [chatMessages, setChatMessages] = useState<BotMessage[]>([]);
  const [currentBot, setCurrentBot] = useState<OfflineBot | null>(null);
  
  // Form refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const userEmail = auth.currentUser?.email || 'guest@local';

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Sync & Storage Logic ---
  const loadLocalData = async () => {
    try {
      setBots(await getFromStore<OfflineBot>('OfflineBot'));
      setPods(await getFromStore<MemoryPod>('MemoryPod'));
      setChats(await getFromStore<BotChat>('BotChat'));
      const q = await getSyncQueue();
      setSyncQueueLength(q.length);
    } catch (e) {
      console.error('IDB load failed', e);
    }
  };

  const syncToCloud = async () => {
    if (!isOnline || !auth.currentUser) return;
    setIsSyncing(true);
    try {
      const queue = await getSyncQueue();
      for (const item of queue) {
        if (item.type === 'CREATE' || item.type === 'UPDATE') {
          await setDoc(doc(db, item.collection, item.id), item.payload);
        } else if (item.type === 'DELETE') {
          await deleteDoc(doc(db, item.collection, item.id));
        }
      }
      await clearSyncQueue();
      setSyncQueueLength(0);
      setLastSync(Date.now());
      
      // Also pull from cloud
      const botsSnap = await getDocs(query(collection(db, 'OfflineBot'), where('created_by', '==', userEmail)));
      const cloudBots = botsSnap.docs.map(d => ({ ...d.data(), id: d.id } as OfflineBot));
      await saveToStore('OfflineBot', cloudBots);
      
      const podsSnap = await getDocs(query(collection(db, 'MemoryPod'), where('created_by', '==', userEmail)));
      const cloudPods = podsSnap.docs.map(d => ({ ...d.data(), id: d.id } as MemoryPod));
      await saveToStore('MemoryPod', cloudPods);
      
      loadLocalData();
    } catch (e) {
      console.error('Cloud sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadLocalData();
    if (isOnline) {
      syncToCloud();
    }
  }, [isOnline, userEmail]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      setNetworkInfo({ type: conn.effectiveType, downlink: conn.downlink });
      conn.addEventListener('change', () => {
        setNetworkInfo({ type: conn.effectiveType, downlink: conn.downlink });
      });
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Ollama logic ---
  const checkOllama = async () => {
    setOllamaStatus('checking');
    try {
      const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        setOllamaModels(data.models || []);
        setOllamaStatus('online');
      } else {
        setOllamaStatus('offline');
      }
    } catch {
      setOllamaStatus('offline');
    }
  };

  useEffect(() => {
    checkOllama();
    localStorage.setItem('bot_studio_ollama_url', ollamaUrl);
  }, [ollamaUrl]);

  // --- Component Actions ---
  const handleCreateBot = async (bot: Partial<OfflineBot>) => {
    const newBot: OfflineBot = {
      id: bot.id || Date.now().toString(),
      name: bot.name || 'New Bot',
      avatar_image_url: bot.avatar_image_url || '',
      role: bot.role || 'Assistant',
      system_prompt: bot.system_prompt || '',
      model: bot.model || (ollamaModels[0]?.name || 'llama3'),
      temperature: bot.temperature ?? 0.7,
      top_p: bot.top_p ?? 0.9,
      max_tokens: bot.max_tokens ?? 2048,
      memory_pod_id: bot.memory_pod_id || '',
      is_agent: bot.is_agent || false,
      tools_enabled: bot.tools_enabled || false,
      created_by: userEmail
    };
    
    await saveToStore('OfflineBot', newBot);
    await queueSyncAction({ collection: 'OfflineBot', type: bot.id ? 'UPDATE' : 'CREATE', payload: newBot, id: newBot.id });
    setEditingBot(null);
    loadLocalData();
    if (isOnline) syncToCloud();
  };

  const handleCreatePod = async (pod: Partial<MemoryPod>) => {
    const newPod: MemoryPod = {
      id: pod.id || Date.now().toString(),
      name: pod.name || 'New Memory Pod',
      description: pod.description || '',
      tags: pod.tags || [],
      summary: pod.summary || '',
      raw_notes: pod.raw_notes || '',
      token_estimate: pod.raw_notes?.length || 0,
      created_date: pod.created_date || Date.now(),
      created_by: userEmail
    };

    await saveToStore('MemoryPod', newPod);
    await queueSyncAction({ collection: 'MemoryPod', type: pod.id ? 'UPDATE' : 'CREATE', payload: newPod, id: newPod.id });
    setEditingPod(null);
    loadLocalData();
    if (isOnline) syncToCloud();
  };

  const startChat = async (bot: OfflineBot) => {
    setCurrentBot(bot);
    let existingChat = chats.find(c => c.bot_id === bot.id);
    if (!existingChat) {
      existingChat = {
        id: Date.now().toString(),
        bot_id: bot.id,
        title: `Chat with ${bot.name}`,
        created_date: Date.now(),
        created_by: userEmail
      };
      await saveToStore('BotChat', existingChat);
      await queueSyncAction({ collection: 'BotChat', type: 'CREATE', payload: existingChat, id: existingChat.id });
      setChats([...chats, existingChat]);
    }
    setActiveChat(existingChat);
    const msgs = await getFromStore<BotMessage>('BotMessage');
    setChatMessages(msgs.filter(m => m.chat_id === existingChat!.id));
    setActiveTab('chat');
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChat || !currentBot) return;
    
    const userMsg: BotMessage = {
      id: Date.now().toString(),
      chat_id: activeChat.id,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      created_by: userEmail
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setInput('');
    setIsTyping(true);
    await saveToStore('BotMessage', userMsg);
    queueSyncAction({ collection: 'BotMessage', type: 'CREATE', payload: userMsg, id: userMsg.id });

    // Construct history for Ollama
    const messagesToSend = [];
    if (currentBot.system_prompt) {
      let sys = currentBot.system_prompt;
      if (currentBot.memory_pod_id) {
        const pod = pods.find(p => p.id === currentBot.memory_pod_id);
        if (pod) sys += `\n\n[ATTACHED MEMORY POD: ${pod.name}]\n${pod.raw_notes}`;
      }
      messagesToSend.push({ role: 'system', content: sys });
    }
    
    updatedMessages.forEach(m => messagesToSend.push({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: currentBot.model,
          messages: messagesToSend,
          temperature: currentBot.temperature,
          top_p: currentBot.top_p,
          stream: true
        })
      });

      if (!res.ok) throw new Error('Ollama error');
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      const assistantMsg: BotMessage = {
        id: (Date.now() + 1).toString(),
        chat_id: activeChat.id,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        created_by: userEmail
      };
      
      setChatMessages(prev => [...prev, assistantMsg]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(l => l.trim().startsWith('data: '));
          
          for (const line of lines) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.choices[0].delta.content) {
                assistantMsg.content += parsed.choices[0].delta.content;
                setChatMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...assistantMsg } : m));
              }
            } catch (e) {}
          }
        }
      }
      
      setIsTyping(false);
      await saveToStore('BotMessage', assistantMsg);
      queueSyncAction({ collection: 'BotMessage', type: 'CREATE', payload: assistantMsg, id: assistantMsg.id });
      if (isOnline) syncToCloud();
      
    } catch (e) {
      setIsTyping(false);
      const errMsg: BotMessage = {
        id: (Date.now() + 1).toString(),
        chat_id: activeChat.id,
        role: 'system',
        content: `Connection error. Make sure Ollama is running at ${ollamaUrl} and CORS is configured.`,
        timestamp: Date.now(),
        created_by: userEmail
      };
      setChatMessages(prev => [...prev, errMsg]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  // Rest of the implementation
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#e0e0e0] font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#252526] border-b border-[#333]">
        <div className="flex items-center gap-2">
          <Bot className="text-emerald-500" size={24} />
          <span className="font-bold text-lg">Offline AI Studio</span>
        </div>
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-500 rounded-full text-xs font-medium">
            <WifiOff size={14} /> OFFLINE MODE
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar">
          
          {activeTab === 'gallery' && !editingBot && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Your Agents</h2>
                <button 
                  onClick={() => setEditingBot({ id: '', name: '', avatar_image_url: '', role: '', system_prompt: '', model: '', temperature: 0.7, top_p: 0.9, max_tokens: 2048, memory_pod_id: '', is_agent: false, tools_enabled: false, created_by: userEmail })}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Plus size={16} /> New Agent
                </button>
              </div>

              {bots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#888]">
                  <Bot size={48} className="mb-4 opacity-20" />
                  <p>No agents configured.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bots.map(b => (
                    <div key={b.id} className="bg-[#2a2a2b] border border-[#444] rounded-xl p-4 flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        {b.avatar_image_url ? (
                          <img src={b.avatar_image_url} alt={b.name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#444] flex items-center justify-center">
                            <Bot size={24} />
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold">{b.name}</h3>
                          <p className="text-xs text-[#888]">{b.model}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-auto">
                        <button onClick={() => startChat(b)} className="flex-1 bg-emerald-600/20 text-emerald-500 py-2 rounded font-medium hover:bg-emerald-600/30 transition-colors">Chat</button>
                        <button onClick={() => setEditingBot(b)} className="p-2 bg-[#333] hover:bg-[#444] rounded transition-colors text-[#ccc]"><Edit2 size={16} /></button>
                        <button onClick={() => {
                          deleteFromStore('OfflineBot', b.id);
                          queueSyncAction({ collection: 'OfflineBot', type: 'DELETE', payload: null, id: b.id });
                          loadLocalData();
                          if (isOnline) syncToCloud();
                        }} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'gallery' && editingBot && (
            <div className="space-y-6 max-w-2xl mx-auto pb-12">
              <div className="flex items-center gap-4">
                <button onClick={() => setEditingBot(null)} className="p-2 hover:bg-[#333] rounded-full"><ArrowLeft size={20} /></button>
                <h2 className="text-xl font-bold">{editingBot.id ? 'Edit Agent' : 'New Agent'}</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#aaa] mb-1">Name</label>
                  <input type="text" value={editingBot.name} onChange={e => setEditingBot({...editingBot, name: e.target.value})} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-emerald-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#aaa] mb-1">Avatar (Base64 or URL)</label>
                  <input type="text" value={editingBot.avatar_image_url} onChange={e => setEditingBot({...editingBot, avatar_image_url: e.target.value})} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-emerald-500" placeholder="https://..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#aaa] mb-1">Ollama Model</label>
                  <select value={editingBot.model} onChange={e => setEditingBot({...editingBot, model: e.target.value})} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-emerald-500">
                    <option value="">Select a model...</option>
                    {ollamaModels.map(m => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                    {!ollamaModels.find(m => m.name === editingBot.model) && editingBot.model && (
                       <option value={editingBot.model}>{editingBot.model} (Offline/Unknown)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#aaa] mb-1">System Prompt</label>
                  <textarea rows={4} value={editingBot.system_prompt} onChange={e => setEditingBot({...editingBot, system_prompt: e.target.value})} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-emerald-500" placeholder="You are a helpful assistant..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#aaa] mb-1">Attached Memory Pod</label>
                  <select value={editingBot.memory_pod_id} onChange={e => setEditingBot({...editingBot, memory_pod_id: e.target.value})} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-emerald-500">
                    <option value="">None</option>
                    {pods.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <button onClick={() => handleCreateBot(editingBot)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold transition-colors">
                  Save Agent
                </button>
              </div>
            </div>
          )}

          {activeTab === 'connectivity' && (
            <div className="max-w-xl mx-auto space-y-6">
               <h2 className="text-xl font-bold">Connectivity Panel</h2>
               
               <div className="bg-[#2a2a2b] border border-[#444] rounded-xl p-5 space-y-4">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     {isOnline ? <Wifi className="text-emerald-500" /> : <WifiOff className="text-amber-500" />}
                     <div>
                       <div className="font-bold">Network Status</div>
                       <div className="text-sm text-[#888]">{isOnline ? 'Online' : 'Offline'}</div>
                     </div>
                   </div>
                 </div>

                 {networkInfo && (
                   <div className="text-sm text-[#888] bg-[#111] p-3 rounded">
                     Connection Type: {networkInfo.type} <br/>
                     Downlink: {networkInfo.downlink} Mbps
                   </div>
                 )}
               </div>

               <div className="bg-[#2a2a2b] border border-[#444] rounded-xl p-5 space-y-4">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <RefreshCw className={isSyncing ? "animate-spin text-blue-500" : "text-blue-500"} />
                     <div>
                       <div className="font-bold">Cloud Sync</div>
                       <div className="text-sm text-[#888]">Pending queue: {syncQueueLength} items</div>
                     </div>
                   </div>
                   <button onClick={syncToCloud} disabled={!isOnline || isSyncing} className="px-4 py-2 bg-blue-600/20 text-blue-500 rounded font-medium disabled:opacity-50">
                     Force Sync
                   </button>
                 </div>
               </div>

               <div className="bg-[#2a2a2b] border border-[#444] rounded-xl p-5 space-y-4">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <Cpu className={ollamaStatus === 'online' ? "text-emerald-500" : "text-amber-500"} />
                     <div>
                       <div className="font-bold">Ollama Engine</div>
                       <div className="text-sm text-[#888]">Status: {ollamaStatus}</div>
                     </div>
                   </div>
                   <button onClick={checkOllama} className="px-4 py-2 bg-[#333] text-white rounded font-medium">Check</button>
                 </div>
                 <div>
                   <input type="text" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" placeholder="http://localhost:11434" />
                 </div>
               </div>

               <div className="bg-[#2a2a2b] border border-[#444] rounded-xl p-5 space-y-4">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <Bluetooth className={bluetoothSupported ? "text-indigo-500" : "text-[#555]"} />
                     <div>
                       <div className="font-bold">Hardware Bridge (BLE)</div>
                       <div className="text-sm text-[#888]">{bluetoothSupported ? 'Supported' : 'Not available on this platform'}</div>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          )}
          
          {activeTab === 'chat' && (
            !activeChat ? (
              <div className="flex flex-col h-full items-center justify-center text-[#888]">
                <MessageSquare size={48} className="mb-4 opacity-20" />
                <p>Chat interface requires an active agent.</p>
                <p className="text-sm mt-2">Go to Bots tab and click Chat on an agent.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#333]">
                  <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-[#333] rounded"><ArrowLeft size={16} /></button>
                  {currentBot?.avatar_image_url ? (
                    <img src={currentBot.avatar_image_url} alt={currentBot.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#444] flex items-center justify-center"><Bot size={16} /></div>
                  )}
                  <div className="font-bold">{currentBot?.name}</div>
                  <div className="ml-auto text-xs bg-[#333] px-2 py-1 rounded text-[#aaa]">{currentBot?.model}</div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                  {chatMessages.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : m.role === 'system' ? 'items-center' : 'items-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2 ${m.role === 'user' ? 'bg-emerald-600 text-white' : m.role === 'system' ? 'bg-amber-500/10 text-amber-500 text-xs' : 'bg-[#2a2a2b] text-zinc-100 border border-[#333]'}`}>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex items-start">
                      <div className="bg-[#2a2a2b] border border-[#333] rounded-xl px-4 py-2 text-[#aaa] flex gap-1">
                        <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay:'150ms'}}>.</span><span className="animate-bounce" style={{animationDelay:'300ms'}}>.</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="mt-auto relative">
                  <input 
                    type="text" 
                    value={input} 
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    className="w-full bg-[#2a2a2b] border border-[#444] rounded-full pl-4 pr-12 py-3 text-white outline-none focus:border-emerald-500"
                    placeholder={`Message ${currentBot?.name}...`}
                  />
                  <button 
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-full text-white transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )
          )}

          {activeTab === 'pods' && !editingPod && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Memory Pods</h2>
                <button 
                  onClick={() => setEditingPod({ id: '', name: '', description: '', tags: [], summary: '', raw_notes: '', token_estimate: 0, created_date: Date.now(), created_by: userEmail })}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Plus size={16} /> New Pod
                </button>
              </div>

              {pods.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#888]">
                  <Database size={48} className="mb-4 opacity-20" />
                  <p>No memory pods created.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pods.map(p => (
                    <div key={p.id} className="bg-[#2a2a2b] border border-[#444] rounded-xl p-4 flex flex-col gap-2">
                      <h3 className="font-bold flex items-center gap-2"><Database size={16} className="text-indigo-500"/> {p.name}</h3>
                      <p className="text-sm text-[#888] line-clamp-2">{p.description}</p>
                      <div className="text-xs text-[#666] mt-2 border-t border-[#444] pt-2 flex justify-between">
                         <span>{p.token_estimate} bytes approx</span>
                         <div className="flex gap-2">
                           <button onClick={() => setEditingPod(p)} className="hover:text-white"><Edit2 size={14}/></button>
                           <button onClick={() => {
                             deleteFromStore('MemoryPod', p.id);
                             queueSyncAction({ collection: 'MemoryPod', type: 'DELETE', payload: null, id: p.id });
                             loadLocalData();
                             if (isOnline) syncToCloud();
                           }} className="hover:text-red-500"><Trash2 size={14}/></button>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pods' && editingPod && (
            <div className="space-y-6 max-w-2xl mx-auto pb-12 h-full flex flex-col">
              <div className="flex items-center gap-4">
                <button onClick={() => setEditingPod(null)} className="p-2 hover:bg-[#333] rounded-full"><ArrowLeft size={20} /></button>
                <h2 className="text-xl font-bold">{editingPod.id ? 'Edit Pod' : 'New Pod'}</h2>
              </div>
              
              <div className="space-y-4 flex-1 flex flex-col">
                <div>
                  <label className="block text-sm font-medium text-[#aaa] mb-1">Name</label>
                  <input type="text" value={editingPod.name} onChange={e => setEditingPod({...editingPod, name: e.target.value})} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-indigo-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#aaa] mb-1">Description</label>
                  <input type="text" value={editingPod.description} onChange={e => setEditingPod({...editingPod, description: e.target.value})} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-indigo-500" />
                </div>

                <div className="flex-1 flex flex-col min-h-[200px]">
                  <label className="block text-sm font-medium text-[#aaa] mb-1 flex justify-between">
                    <span>Raw Knowledge</span>
                    <button className="text-indigo-400 flex items-center gap-1 text-xs" onClick={() => alert('Compression uses Ollama to summarize the raw notes. (Not fully wired yet)')}><Cpu size={12}/> Compress</button>
                  </label>
                  <textarea value={editingPod.raw_notes} onChange={e => setEditingPod({...editingPod, raw_notes: e.target.value})} className="flex-1 w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="Paste documentation, logs, or codebase context here..." />
                </div>
                
                <button onClick={() => handleCreatePod(editingPod)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold transition-colors">
                  Save Pod
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Bottom Nav */}
      <div className="flex bg-[#252526] border-t border-[#333]">
        <button 
          onClick={() => setActiveTab('gallery')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${activeTab === 'gallery' ? 'text-emerald-500' : 'text-[#888] hover:text-[#bbb]'}`}
        >
          <Bot size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Bots</span>
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${activeTab === 'chat' ? 'text-emerald-500' : 'text-[#888] hover:text-[#bbb]'}`}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Chats</span>
        </button>
        <button 
          onClick={() => setActiveTab('pods')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${activeTab === 'pods' ? 'text-emerald-500' : 'text-[#888] hover:text-[#bbb]'}`}
        >
          <Database size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Memory</span>
        </button>
        <button 
          onClick={() => setActiveTab('connectivity')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${activeTab === 'connectivity' ? 'text-emerald-500' : 'text-[#888] hover:text-[#bbb]'}`}
        >
          <Network size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Network</span>
        </button>
      </div>
    </div>
  );
};
