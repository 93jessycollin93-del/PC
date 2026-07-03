import React, { useState, useEffect } from 'react';
import { Bluetooth, Wifi, Cloud, Radio, HardDrive, Cpu, Terminal, RefreshCw, UploadCloud, DownloadCloud, AlertTriangle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';

export const FlipperZeroApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'bluetooth' | 'wifi' | 'cloud' | 'terminal'>('bluetooth');
    const [btDevices, setBtDevices] = useState<any[]>([]);
    const [wifiNetworks, setWifiNetworks] = useState<any[]>([]);
    const [cloudData, setCloudData] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);
    const [log, setLog] = useState<string[]>([
        'FLIPPER ZERO SECURE INTERFACE v1.0.4',
        'System initialized. Radio modules standing by.',
    ]);

    const addLog = (msg: string) => {
        setLog(prev => [...prev.slice(-49), `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${msg}`]);
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
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true
            });
            setBtDevices(prev => [...prev, device]);
            addLog(`FOUND BT DEVICE: ${device.name || 'UNKNOWN'} | ID: ${device.id}`);
        } catch (error: any) {
            addLog(`BT SCAN HALTED: ${error.message}`);
        } finally {
            setScanning(false);
        }
    };

    // WiFi (Simulated for Web)
    const scanWifi = () => {
        setScanning(true);
        addLog('Initializing 802.11 spectrum analysis...');
        // Simulate a delay for realism
        setTimeout(() => {
            const mockNetworks = [
                { ssid: 'CORP_SEC_NET', signal: -45, security: 'WPA3-Enterprise', bssid: '00:14:22:01:23:45' },
                { ssid: 'GUEST_PUBLIC', signal: -60, security: 'Open', bssid: '00:14:22:01:23:46' },
                { ssid: '<HIDDEN_SSID>', signal: -75, security: 'WPA2-PSK', bssid: 'A0:B1:C2:D3:E4:F5' },
                { ssid: 'IOT_DEVICE_GW', signal: -30, security: 'WEP', bssid: '11:22:33:44:55:66' }
            ];
            setWifiNetworks(mockNetworks);
            addLog(`Spectrum analysis complete. Found ${mockNetworks.length} 802.11 networks.`);
            setScanning(false);
        }, 2000);
    };

    // Cloud / Sync
    const syncToCloud = async () => {
        addLog('Establishing secure tunnel to Google Cloud Firestore...');
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
            addLog(`CLOUD SYNC ERROR: ${error.message}`);
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
            if (data.length > 0) {
                addLog(`Pulled ${data.length} telemetry records from cloud storage.`);
            }
        } catch (error: any) {
            addLog(`CLOUD FETCH ERROR: ${error.message}`);
        }
    };

    useEffect(() => {
        fetchCloudData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const TabButton = ({ id, icon: Icon, label }: { id: any, icon: any, label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center justify-center p-3 gap-1 rounded-lg transition-colors border ${activeTab === id ? 'bg-orange-500 text-black border-orange-500' : 'bg-black text-orange-500 border-orange-900/50 hover:bg-orange-950/30'}`}
        >
            <Icon size={20} />
            <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
        </button>
    );

    return (
        <div className="h-full w-full bg-[#0a0a0a] text-orange-500 font-mono flex flex-col p-4 overflow-hidden border-2 border-orange-900/30 rounded-xl relative">
            <div className="flex items-center justify-between border-b border-orange-900/50 pb-3 mb-4">
                <div className="flex items-center gap-3">
                    <Radio className="text-orange-500 animate-pulse" />
                    <h1 className="text-xl font-bold tracking-widest uppercase">Flipper Interface</h1>
                </div>
                <div className="text-xs opacity-70 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                    SYS_ONLINE
                </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-6">
                <TabButton id="bluetooth" icon={Bluetooth} label="Bluetooth" />
                <TabButton id="wifi" icon={Wifi} label="WLAN (802.11)" />
                <TabButton id="cloud" icon={Cloud} label="Cloud Sync" />
                <TabButton id="terminal" icon={Terminal} label="Log" />
            </div>

            <div className="flex-1 overflow-auto border border-orange-900/30 bg-black/50 p-4 rounded-lg relative">
                {scanning && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-orange-950 overflow-hidden">
                        <div className="h-full bg-orange-500 w-1/3 animate-[slide_1s_ease-in-out_infinite_alternate]"></div>
                    </div>
                )}

                {activeTab === 'bluetooth' && (
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold uppercase">Bluetooth LE Scanner</h2>
                            <button onClick={scanBluetooth} disabled={scanning} className="px-4 py-2 bg-orange-500 text-black text-xs font-bold uppercase hover:bg-orange-400 disabled:opacity-50 flex items-center gap-2 rounded">
                                <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
                                Start Scan
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto space-y-2">
                            {btDevices.length === 0 ? (
                                <div className="text-orange-800 text-xs italic">No devices found. Initiate scan to probe local area.</div>
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
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold uppercase">802.11 Spectrum Analysis</h2>
                            <button onClick={scanWifi} disabled={scanning} className="px-4 py-2 bg-orange-500 text-black text-xs font-bold uppercase hover:bg-orange-400 disabled:opacity-50 flex items-center gap-2 rounded">
                                <Radio size={14} className={scanning ? 'animate-pulse' : ''} />
                                Probe Spectrum
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto space-y-2">
                            {wifiNetworks.length === 0 ? (
                                <div className="text-orange-800 text-xs italic">No networks probed. Initiate scan.</div>
                            ) : (
                                wifiNetworks.map((net, i) => (
                                    <div key={i} className="p-3 border border-orange-900/50 bg-black flex justify-between items-center text-xs">
                                        <div>
                                            <div className="font-bold flex items-center gap-2">
                                                {net.ssid} 
                                                {net.security === 'Open' || net.security === 'WEP' ? (
                                                    <AlertTriangle size={12} className="text-red-500" title="Vulnerable Security" />
                                                ) : null}
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
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold uppercase">Cloud Telemetry</h2>
                            <div className="flex gap-2">
                                <button onClick={fetchCloudData} disabled={scanning} className="px-3 py-2 bg-orange-950 border border-orange-900 text-orange-500 text-xs font-bold uppercase hover:bg-orange-900 disabled:opacity-50 flex items-center gap-2 rounded">
                                    <DownloadCloud size={14} /> Pull
                                </button>
                                <button onClick={syncToCloud} disabled={scanning} className="px-3 py-2 bg-orange-500 text-black text-xs font-bold uppercase hover:bg-orange-400 disabled:opacity-50 flex items-center gap-2 rounded">
                                    <UploadCloud size={14} /> Sync Now
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto space-y-3">
                            {cloudData.length === 0 ? (
                                <div className="text-orange-800 text-xs italic">No telemetry data in cloud.</div>
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
                    <div className="flex flex-col h-full bg-black">
                        <div className="flex-1 overflow-auto p-2 font-mono text-[10px] leading-relaxed text-orange-400 break-words flex flex-col-reverse">
                            <div>
                                {log.map((l, i) => (
                                    <div key={i} className="mb-1">{l}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            `}</style>
        </div>
    );
};
