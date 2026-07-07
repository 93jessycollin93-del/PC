import fs from 'fs';

const content = `
import React, { useState, useEffect } from 'react';
import { 
    Bluetooth, Wifi, Cloud, Terminal, RefreshCw, UploadCloud, DownloadCloud, 
    AlertTriangle, RadioReceiver, Nfc, Zap, Key, CircleDot, Usb, Cpu, 
    ShieldCheck, HardDrive, BrainCircuit, Activity, Check, Radio, Play
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';

type TabType = 'subghz' | 'nfc' | 'ir' | 'rfid' | 'ibutton' | 'badusb' | 'gpio' | 'u2f' | 'storage' | 'bluetooth' | 'wifi' | 'cloud' | 'terminal';

export const FlipperZeroApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('subghz');
    const [btDevices, setBtDevices] = useState<any[]>([]);
    const [wifiNetworks, setWifiNetworks] = useState<any[]>([]);
    const [cloudData, setCloudData] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);
    const [autoSync, setAutoSync] = useState(false);
    const [log, setLog] = useState<string[]>([
        'SAS_BRIDGE v2.1.0 ONLINE',
        'Hardware link established.',
        'Protobuf RPC schema loaded.',
    ]);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const addLog = (msg: string) => {
        setLog(prev => [...prev.slice(-99), \`[\${new Date().toISOString().split('T')[1].slice(0, -1)}] \${msg}\`]);
    };

    // Bluetooth
    const scanBluetooth = async () => {
        if (!navigator.bluetooth) {
            addLog('ERROR: Web Bluetooth API not supported in this environment.');
            return;
        }
        setScanning(true);
        addLog('Initiating Bluetooth LE scan sequence...');
        try {
            const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
            setBtDevices(prev => [...prev, device]);
            addLog(\`FOUND BT DEVICE: \${device.name || 'UNKNOWN'} | ID: \${device.id}\`);
        } catch (error: any) {
            addLog(\`BT SCAN HALTED: \${error.message}\`);
        } finally {
            setScanning(false);
        }
    };

    // WiFi
    const scanWifi = () => {
        setScanning(true);
        addLog('Initializing 802.11 spectrum analysis...');
        setTimeout(() => {
            const mockNetworks = [
                { ssid: 'CORP_SEC_NET', signal: -45, security: 'WPA3-Enterprise', bssid: '00:14:22:01:23:45' },
                { ssid: 'GUEST_PUBLIC', signal: -60, security: 'Open', bssid: '00:14:22:01:23:46' },
                { ssid: '<HIDDEN_SSID>', signal: -75, security: 'WPA2-PSK', bssid: 'A0:B1:C2:D3:E4:F5' },
                { ssid: 'IOT_DEVICE_GW', signal: -30, security: 'WEP', bssid: '11:22:33:44:55:66' }
            ];
            setWifiNetworks(mockNetworks);
            addLog(\`Spectrum analysis complete. Found \${mockNetworks.length} 802.11 networks.\`);
            setScanning(false);
        }, 2000);
    };

    // Cloud
    const syncToCloud = async () => {
        addLog('Establishing secure tunnel to cloud...');
        setScanning(true);
        try {
            await addDoc(collection(db, 'flipper_telemetry'), {
                timestamp: serverTimestamp(),
                btDevices: btDevices.map(d => ({ name: d.name, id: d.id })),
                wifiNetworks
            });
            addLog('Data exfiltration to cloud successful.');
            fetchCloudData();
        } catch (error: any) {
            addLog(\`CLOUD SYNC ERROR: \${error.message}\`);
        } finally {
            setScanning(false);
        }
    };

    const fetchCloudData = async () => {
        try {
            const q = query(collection(db, 'flipper_telemetry'), orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCloudData(data);
            if (data.length > 0) addLog(\`Pulled \${data.length} telemetry records.\`);
        } catch (error: any) {
            addLog(\`CLOUD FETCH ERROR: \${error.message}\`);
        }
    };

    useEffect(() => {
        fetchCloudData();
        const savedAutoSync = localStorage.getItem('flipper_autosync');
        if (savedAutoSync === 'true') setAutoSync(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (autoSync) {
            interval = setInterval(() => syncToCloud(), 60000);
        }
        localStorage.setItem('flipper_autosync', String(autoSync));
        return () => { if (interval) clearInterval(interval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSync, btDevices, wifiNetworks]);

    const handleAnalyzeAI = async () => {
        setIsAnalyzing(true);
        setAiAnalysis(null);
        addLog('Requesting AI heuristic analysis from SAS Hub endpoint...');
        try {
            const ai = getAiClient();
            let context = '';
            if (activeTab === 'bluetooth') context = JSON.stringify(btDevices);
            else if (activeTab === 'wifi') context = JSON.stringify(wifiNetworks);
            else if (activeTab === 'subghz') context = 'Detected rolling code sequence (315MHz). Pattern anomaly detected in preamble.';
            else if (activeTab === 'nfc') context = 'ISO14443-A card read. Sector 0 block 0 readable. UID: 04:A1:B2:C3:D4:E5:F6';
            else context = 'Analyzing current domain RPC state logs: ' + log.slice(-10).join('\\n');

            const prompt = \`As a security analyst, analyze this telemetry data from a hardware tool module (\${activeTab} domain): \${context}. Provide a concise 2-sentence security assessment.\`;
            const result = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
            });
            const text = result.text();
            setAiAnalysis(text || 'Analysis returned empty.');
            addLog('AI Analysis complete.');
        } catch (error: any) {
            setAiAnalysis(\`ERROR: \${error.message}\`);
            addLog('AI Analysis failed.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const TABS: { id: TabType, label: string, icon: any }[] = [
        { id: 'subghz', label: 'SubGHz', icon: Waves },
        { id: 'nfc', label: 'NFC', icon: Nfc },
        { id: 'ir', label: 'Infrared', icon: Zap },
        { id: 'rfid', label: 'LF RFID', icon: Key },
        { id: 'ibutton', label: 'iButton', icon: CircleDot },
        { id: 'badusb', label: 'Bad USB', icon: Usb },
        { id: 'gpio', label: 'GPIO', icon: Cpu },
        { id: 'u2f', label: 'U2F', icon: ShieldCheck },
        { id: 'storage', label: 'Storage', icon: HardDrive },
        { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth },
        { id: 'wifi', label: 'WLAN', icon: Wifi },
        { id: 'cloud', label: 'Cloud Sync', icon: Cloud },
        { id: 'terminal', label: 'Terminal', icon: Terminal },
    ];

    const simulateAction = (actionName: string) => {
        addLog(\`RPC Dispatch: /api/flipper/\${activeTab}/\${actionName}\`);
        setScanning(true);
        setTimeout(() => {
            addLog(\`RPC Response: [\${actionName}] SUCCESS\`);
            setScanning(false);
        }, 1500);
    }

    return (
        <div className="h-full w-full bg-[#0a0a0a] text-orange-500 font-mono flex flex-col overflow-hidden border-2 border-orange-900/30 rounded-xl relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-orange-900/50 p-3 bg-black z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <RadioReceiver className="text-orange-500 animate-pulse" size={24} />
                    <h1 className="text-xl font-bold tracking-widest uppercase">SAS Hardware Bridge</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleAnalyzeAI} 
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 bg-orange-900/40 hover:bg-orange-900/60 text-orange-400 px-3 py-1.5 rounded text-xs font-bold transition-colors border border-orange-800"
                    >
                        {isAnalyzing ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
                        Analyze with AI
                    </button>
                    <div className="text-xs opacity-70 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                        USB_SERIAL / BLE_IDLE
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-40 border-r border-orange-900/30 bg-black/80 overflow-y-auto shrink-0 py-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setAiAnalysis(null); }}
                            className={\`w-full flex items-center gap-3 px-4 py-3 transition-colors border-l-2 \${activeTab === tab.id ? 'bg-orange-950/50 text-orange-400 border-orange-500' : 'text-orange-700 hover:bg-orange-950/30 hover:text-orange-500 border-transparent'}\`}
                        >
                            <tab.icon size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col relative bg-black/40 overflow-hidden">
                    {scanning && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-orange-950 overflow-hidden z-20">
                            <div className="h-full bg-orange-500 w-1/3 animate-[slide_1s_ease-in-out_infinite_alternate]"></div>
                        </div>
                    )}
                    
                    {aiAnalysis && (
                        <div className="m-4 p-3 border border-orange-500/50 bg-orange-950/30 rounded-lg text-sm text-orange-300 leading-relaxed shrink-0">
                            <div className="flex items-center gap-2 font-bold text-orange-500 mb-2 uppercase text-xs">
                                <BrainCircuit size={14} /> AI Security Assessment
                            </div>
                            {aiAnalysis}
                        </div>
                    )}

                    <div className="flex-1 overflow-auto p-4 relative">
                        
                        {/* Domain Views */}
                        {activeTab === 'subghz' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">SubGHz Module (300-928MHz)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('scan')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Activity size={14}/> Read Analyzer</button>
                                    <button onClick={() => simulateAction('transmit')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Waves size={14}/> Replay Sequence</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">No frequencies currently locked.</div>
                            </div>
                        )}

                        {activeTab === 'nfc' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">NFC (ISO14443/ISO15693)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('read')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Nfc size={14}/> Read Card</button>
                                    <button onClick={() => simulateAction('emulate')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Radio size={14}/> Emulate</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Place tag near antenna.</div>
                            </div>
                        )}

                        {activeTab === 'ir' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">Infrared Transceiver</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('learn')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Zap size={14}/> Learn Signal</button>
                                    <button onClick={() => simulateAction('universal')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Play size={14}/> Universal Remote</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rfid' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">LF RFID (125kHz)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('read')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Key size={14}/> Read</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'ibutton' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">iButton (1-Wire)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('read')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><CircleDot size={14}/> Read Dallas Key</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'badusb' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">Bad USB (HID Emulation)</h2>
                                <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-500 rounded text-xs flex items-center gap-2 mb-4">
                                    <AlertTriangle size={14}/> Warning: USB HID scripts will execute immediately on the host machine.
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('execute_script')} className="px-3 py-2 bg-orange-500 text-black hover:bg-orange-400 rounded text-xs uppercase font-bold flex items-center gap-2"><Usb size={14}/> Execute Payload</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'gpio' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">GPIO Interface</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('read_pins')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Cpu size={14}/> Probe Pins</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'u2f' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">U2F Authenticator</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('authenticate')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><ShieldCheck size={14}/> Auth Request</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'storage' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">SD Card Storage</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => simulateAction('list_dir')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><HardDrive size={14}/> Browse Files</button>
                                </div>
                            </div>
                        )}

                        {/* Existing Tabs - modified slightly to fit layout */}
                        {activeTab === 'bluetooth' && (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex items-center justify-between border-b border-orange-900/30 pb-2">
                                    <h2 className="text-sm font-bold uppercase">Bluetooth LE Scanner</h2>
                                    <button onClick={scanBluetooth} disabled={scanning} className="px-4 py-1.5 bg-orange-500 text-black text-xs font-bold uppercase hover:bg-orange-400 disabled:opacity-50 flex items-center gap-2 rounded">
                                        <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} /> Scan
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {btDevices.length === 0 ? (
                                        <div className="text-orange-800 text-xs italic">No devices found.</div>
                                    ) : (
                                        btDevices.map((d, i) => (
                                            <div key={i} className="p-3 border border-orange-900/50 bg-black flex justify-between items-center text-xs">
                                                <div>
                                                    <div className="font-bold">{d.name || 'UNKNOWN_DEVICE'}</div>
                                                    <div className="text-orange-700">{d.id}</div>
                                                </div>
                                                <Bluetooth size={16} className="text-orange-500 opacity-50" />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'wifi' && (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex items-center justify-between border-b border-orange-900/30 pb-2">
                                    <h2 className="text-sm font-bold uppercase">802.11 Spectrum</h2>
                                    <button onClick={scanWifi} disabled={scanning} className="px-4 py-1.5 bg-orange-500 text-black text-xs font-bold uppercase hover:bg-orange-400 disabled:opacity-50 flex items-center gap-2 rounded">
                                        <RadioReceiver size={14} className={scanning ? 'animate-pulse' : ''} /> Probe
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {wifiNetworks.length === 0 ? (
                                        <div className="text-orange-800 text-xs italic">No networks probed.</div>
                                    ) : (
                                        wifiNetworks.map((net, i) => (
                                            <div key={i} className="p-3 border border-orange-900/50 bg-black flex justify-between items-center text-xs">
                                                <div>
                                                    <div className="font-bold flex items-center gap-2">
                                                        {net.ssid} 
                                                        {(net.security === 'Open' || net.security === 'WEP') && <AlertTriangle size={12} className="text-red-500" />}
                                                    </div>
                                                    <div className="text-orange-700 font-mono mt-1">BSSID: {net.bssid} | PWR: {net.signal}dBm</div>
                                                </div>
                                                <div className="px-2 py-1 bg-orange-950/50 border border-orange-900 text-[10px] rounded">
                                                    {net.security}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'cloud' && (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex items-center justify-between border-b border-orange-900/30 pb-2">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-sm font-bold uppercase">Cloud Telemetry</h2>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className="relative">
                                                <input type="checkbox" className="sr-only" checked={autoSync} onChange={(e) => {
                                                    setAutoSync(e.target.checked);
                                                    addLog(e.target.checked ? 'Auto-sync enabled (60s).' : 'Auto-sync disabled.');
                                                }} />
                                                <div className={\`block w-8 h-4 rounded-full transition-colors \${autoSync ? 'bg-orange-500' : 'bg-orange-950 border border-orange-900'}\`}></div>
                                                <div className={\`absolute left-0.5 top-0.5 bg-black w-3 h-3 rounded-full transition-transform \${autoSync ? 'translate-x-4 bg-black' : 'bg-orange-700'}\`}></div>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase text-orange-600 group-hover:text-orange-500 transition-colors">Auto (60s)</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={fetchCloudData} disabled={scanning} className="px-3 py-1.5 bg-orange-950 border border-orange-900 text-orange-500 text-xs font-bold uppercase hover:bg-orange-900 disabled:opacity-50 flex items-center gap-2 rounded">
                                            <DownloadCloud size={14} /> Pull
                                        </button>
                                        <button onClick={syncToCloud} disabled={scanning} className="px-3 py-1.5 bg-orange-500 text-black text-xs font-bold uppercase hover:bg-orange-400 disabled:opacity-50 flex items-center gap-2 rounded">
                                            <UploadCloud size={14} /> Sync
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {cloudData.length === 0 ? (
                                        <div className="text-orange-800 text-xs italic">No telemetry data.</div>
                                    ) : (
                                        cloudData.map((data, i) => (
                                            <div key={i} className="p-3 border border-orange-900/50 bg-black text-xs space-y-2">
                                                <div className="flex justify-between items-center border-b border-orange-900/30 pb-2">
                                                    <span className="font-bold text-orange-400">ID: {data.id.slice(0,8)}...</span>
                                                    <span className="text-orange-700">
                                                        {data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : 'Just now'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-orange-600 mb-1">Bluetooth Devices ({data.btDevices?.length || 0})</div>
                                                    <div className="text-orange-800 max-h-12 overflow-hidden text-[10px]">
                                                        {data.btDevices?.map((d:any) => d.name).join(', ') || 'None'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-orange-600 mb-1">WiFi Networks ({data.wifiNetworks?.length || 0})</div>
                                                    <div className="text-orange-800 max-h-12 overflow-hidden text-[10px]">
                                                        {data.wifiNetworks?.map((w:any) => w.ssid).join(', ') || 'None'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'terminal' && (
                            <div className="absolute inset-0 bg-black flex flex-col">
                                <div className="flex-1 overflow-auto p-3 font-mono text-[10px] leading-relaxed text-orange-400 break-words flex flex-col-reverse">
                                    <div>
                                        {log.map((l, i) => (
                                            <div key={i} className="mb-1">{l}</div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{\`
                @keyframes slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            \`}</style>
        </div>
    );
};
`

fs.writeFileSync('./components/apps/FlipperZeroApp.tsx', content);
