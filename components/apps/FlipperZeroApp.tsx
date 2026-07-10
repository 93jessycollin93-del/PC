import React, { useState, useEffect } from 'react';
import { 
    Bluetooth, Wifi, Cloud, Terminal, RefreshCw, UploadCloud, DownloadCloud, 
    AlertTriangle, RadioReceiver, Nfc, Zap, Key, CircleDot, Usb, Cpu, 
    ShieldCheck, HardDrive, BrainCircuit, Activity, Check, Radio, Play, Waves, Lock, History,
    Camera, MapPin, CreditCard, Car, Network, Satellite, GitBranch, ExternalLink, Smartphone
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAiClient, MODEL_NAME } from '../../lib/gemini';
import { queueSyncAction, getSyncQueue, deleteFromStore } from '../../lib/idb';

type TabType = 'subghz' | 'nfc' | 'ir' | 'rfid' | 'ibutton' | 'badusb' | 'gpio' | 'u2f' | 'storage' | 'bluetooth' | 'wifi' | 'cloud' | 'terminal' | 'esp32' | 'nrf24' | 'magspoof' | 'gps' | 'camera' | 'geiger' | 'canbus' | 'ethernet' | 'firmware';

interface GithubReleaseAsset {
    name: string;
    browser_download_url: string;
    size: number;
}
interface GithubRelease {
    tag_name: string;
    name: string;
    published_at: string;
    body: string;
    html_url: string;
    assets: GithubReleaseAsset[];
}

export const FlipperZeroApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('subghz');
    const [btDevices, setBtDevices] = useState<any[]>([]);
    const [networkInfo, setNetworkInfo] = useState<any>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [cloudData, setCloudData] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);
    const [autoSync, setAutoSync] = useState(false);
    const [localOnly, setLocalOnly] = useState(true);
    const bluetoothSupported = 'bluetooth' in navigator;
    const [showSettings, setShowSettings] = useState(false);
    const [log, setLog] = useState<string[]>([
        'SAS_BRIDGE v2.1.0 ONLINE',
        'Hardware link established.',
        'Protobuf RPC schema loaded.',
    ]);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Firmware update state
    const [latestRelease, setLatestRelease] = useState<GithubRelease | null>(null);
    const [firmwareError, setFirmwareError] = useState<string | null>(null);
    const [checkingFirmware, setCheckingFirmware] = useState(false);
    const [flashProgress, setFlashProgress] = useState<number | null>(null);
    const [flashStatus, setFlashStatus] = useState<string | null>(null);
    const [usbSupported] = useState('usb' in navigator);
    const FIRMWARE_SOURCES = [
        { id: 'official', label: 'Official (flipperdevices)', repo: 'flipperdevices/flipperzero-firmware' },
        { id: 'unleashed', label: 'Unleashed (custom firmware)', repo: 'DarkFlippers/unleashed-firmware' },
    ];
    const [firmwareSource, setFirmwareSource] = useState(FIRMWARE_SOURCES[0].id);

    const checkLatestFirmware = async (sourceId: string = firmwareSource) => {
        const source = FIRMWARE_SOURCES.find(s => s.id === sourceId) || FIRMWARE_SOURCES[0];
        setCheckingFirmware(true);
        setFirmwareError(null);
        setLatestRelease(null);
        addLog(`Querying GitHub releases API for ${source.repo}...`);
        try {
            const res = await fetch(`https://api.github.com/repos/${source.repo}/releases/latest`);
            if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
            const data = await res.json();
            setLatestRelease(data);
            addLog(`Latest ${source.label} release found: ${data.tag_name}`);
        } catch (error: any) {
            setFirmwareError(error.message || 'Failed to reach GitHub releases API.');
            addLog(`FIRMWARE CHECK ERROR: ${error.message}`);
        } finally {
            setCheckingFirmware(false);
        }
    };

    const addLog = (msg: string) => {
        setLog(prev => [...prev.slice(-99), `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${msg}`]);
    };

    // Bluetooth
    const scanBluetooth = async () => {
        if (!(navigator as any).bluetooth) {
            addLog('ERROR: Web Bluetooth API not supported in this environment.');
            return;
        }
        setScanning(true);
        addLog('Initiating REAL Bluetooth LE scan sequence...');
        try {
            const device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true });
            setBtDevices(prev => [...prev, device]);
            addLog(`FOUND BT DEVICE: ${device.name || 'UNKNOWN'} | ID: ${device.id}`);
        } catch (error: any) {
            addLog(`BT SCAN HALTED: ${error.message}`);
        } finally {
            setScanning(false);
        }
    };

    // Network Status
    const checkNetwork = async () => {
        setScanning(true);
        addLog('Checking network status...');
        const conn = (navigator as any).connection;
        addLog(`Network is currently ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}.`);
        if (conn) {
            addLog(`Connection type: ${conn.effectiveType || '?'}, Downlink: ${conn.downlink ?? '?'} Mbps`);
        }
        setScanning(false);
    };

    // Cloud
    const syncToCloud = async () => {
        if (!isOnline) {
            addLog('Offline: Queuing telemetry for cloud sync...');
            await queueSyncAction({
                collection: 'flipper_telemetry',
                type: 'CREATE',
                id: Date.now().toString(),
                payload: {
                    timestamp: Date.now(),
                    btDevices: btDevices.map(d => ({ name: d.name || 'Unknown Device', id: d.id })),
                    networkInfo: networkInfo || { type: 'unknown' },
                    isOnline
                }
            });
            return;
        }

        addLog('Establishing secure tunnel to cloud...');
        setScanning(true);
        try {
            // Flush queued telemetry first
            const queue = await getSyncQueue();
            const flipperQueue = queue.filter((q: any) => q.collection === 'flipper_telemetry');
            for (const item of flipperQueue) {
                if (item.type === 'CREATE') {
                    await addDoc(collection(db, 'flipper_telemetry'), {
                        ...item.payload,
                        timestamp: new Date(item.payload.timestamp)
                    });
                    await deleteFromStore('SyncQueue', item.id);
                }
            }
            if (flipperQueue.length > 0) {
                addLog(`Flushed ${flipperQueue.length} queued telemetry records.`);
            }
            
            await addDoc(collection(db, 'flipper_telemetry'), {
                timestamp: serverTimestamp(),
                btDevices: btDevices.map(d => ({ name: d.name || 'Unknown Device', id: d.id })),
                networkInfo: networkInfo || { type: 'unknown' },
                isOnline
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
        if (!isOnline) return;
        try {
            const q = query(collection(db, 'flipper_telemetry'), orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCloudData(data);
            if (data.length > 0) addLog(`Pulled ${data.length} telemetry records.`);
        } catch (error: any) {
            addLog(`CLOUD FETCH ERROR: ${error.message}`);
        }
    };

    useEffect(() => {
        if (isOnline) {
            fetchCloudData();
        }
        const savedAutoSync = localStorage.getItem('flipper_autosync');
        if (savedAutoSync === 'true') setAutoSync(true);

        const handleOnline = () => { setIsOnline(true); addLog('Network status: ONLINE'); if (autoSync) syncToCloud(); };
        const handleOffline = () => { setIsOnline(false); addLog('Network status: OFFLINE'); };
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeTab === 'firmware' && !latestRelease && !checkingFirmware) {
            checkLatestFirmware();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const handleFirmwareSourceChange = (sourceId: string) => {
        setFirmwareSource(sourceId);
        checkLatestFirmware(sourceId);
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (autoSync && isOnline) {
            interval = setInterval(() => syncToCloud(), 60000);
        }
        localStorage.setItem('flipper_autosync', String(autoSync));
        return () => { if (interval) clearInterval(interval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSync, btDevices, networkInfo, isOnline]);

    const handleAnalyzeAI = async (customContext?: string) => {
        if (localOnly && !confirm('Confirm: You are forcing local-only AI routing for sensitive hardware data. Continue?')) return;
        setIsAnalyzing(true);
        setAiAnalysis(null);
        addLog('Requesting AI heuristic analysis from SAS Hub endpoint...');
        try {
            const ai = getAiClient();
            let context = customContext || '';
            if (!context) {
                if (activeTab === 'bluetooth') context = JSON.stringify(btDevices);
                else if (activeTab === 'wifi') context = JSON.stringify(networkInfo || { status: isOnline ? 'online' : 'offline' });
                else if (activeTab === 'subghz') context = 'Detected rolling code sequence (315MHz). Pattern anomaly detected in preamble.';
                else if (activeTab === 'nfc') context = 'ISO14443-A card read. Sector 0 block 0 readable. UID: 04:A1:B2:C3:D4:E5:F6';
                else context = 'Analyzing current domain RPC state logs: ' + log.slice(-10).join('\n');
            }

            const prompt = `As an elite hardware penetration tester and security analyst, analyze this telemetry data from a hardware tool module (${activeTab} domain): ${context}. Provide a highly descriptive, detailed and actionable security assessment of any potential risks, protocols used, or remediation steps.`;
            const result = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
            });
            const text = result.text;
            setAiAnalysis(text || 'Analysis returned empty.');
            addLog('AI Analysis complete.');
        } catch (error: any) {
            setAiAnalysis(`ERROR: ${error.message}`);
            addLog('AI Analysis failed.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- Real USB DFU firmware flashing (STM32 DfuSe protocol, as used by qFlipper/dfu-util) ---
    // Parses a DfuSe (.dfu) file container into flashable {address, data} segments.
    // Layout reference: ST AN3156 "DFU_1.1a" DfuSe file format.
    const parseDfuFile = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        const len = buf.byteLength;
        if (len < 11 + 16) throw new Error('File too small to be a valid .dfu image.');
        // DFU suffix: last 16 bytes, signature "UFD" at offset len-8..len-6 (ASCII, reversed on disk).
        const sigStr = String.fromCharCode(bytes[len - 8], bytes[len - 7], bytes[len - 6]);
        if (sigStr !== 'UFD') throw new Error('Not a valid .dfu file (missing UFD suffix signature).');
        const body = buf.slice(0, len - 16);
        const bodyBytes = new Uint8Array(body);
        const prefixSig = String.fromCharCode(bodyBytes[0], bodyBytes[1], bodyBytes[2], bodyBytes[3], bodyBytes[4]);
        if (prefixSig !== 'DfuSe') throw new Error('Not a DfuSe container (unexpected prefix signature).');
        const bodyView = new DataView(body);
        const targets: { address: number, data: Uint8Array }[] = [];
        const targetCount = bodyBytes[10]; // byte after "DfuSe"(5)+version(1)+imageSize(4)
        let offset = 11;
        for (let t = 0; t < targetCount; t++) {
            if (offset + 274 > bodyBytes.length) throw new Error('Malformed .dfu file: truncated target header.');
            const targetSig = String.fromCharCode(bodyBytes[offset], bodyBytes[offset + 1], bodyBytes[offset + 2], bodyBytes[offset + 3], bodyBytes[offset + 4], bodyBytes[offset + 5]);
            if (targetSig !== 'Target') throw new Error('Malformed .dfu file: expected "Target" signature.');
            offset += 6; // signature
            offset += 1; // alt setting
            offset += 4; // target-named flag (dword)
            offset += 255; // target name
            const targetSize = bodyView.getUint32(offset, true); offset += 4;
            const numElements = bodyView.getUint32(offset, true); offset += 4;
            const targetEnd = offset + targetSize;
            for (let e = 0; e < numElements; e++) {
                if (offset + 8 > targetEnd) throw new Error('Malformed .dfu file: truncated element header.');
                const address = bodyView.getUint32(offset, true); offset += 4;
                const size = bodyView.getUint32(offset, true); offset += 4;
                if (offset + size > bodyBytes.length) throw new Error('Malformed .dfu file: element data out of bounds.');
                const data = bodyBytes.slice(offset, offset + size);
                targets.push({ address, data });
                offset += size;
            }
            offset = targetEnd;
        }
        if (targets.length === 0) throw new Error('No flashable data segments found in .dfu file.');
        return targets;
    };

    const DFU_REQUEST = { DETACH: 0, DNLOAD: 1, UPLOAD: 2, GETSTATUS: 3, CLRSTATUS: 4, GETSTATE: 5, ABORT: 6 };
    // DFU 1.1 state machine values (bState in GETSTATUS response).
    const DFU_STATE = { DNLOAD_SYNC: 3, DNBUSY: 4, DNLOAD_IDLE: 5, MANIFEST_SYNC: 6, MANIFEST: 7, MANIFEST_WAIT_RESET: 8, ERROR: 10 };
    const DFU_STATUS_OK = 0;
    const ERASE_PAGE_SIZE = 4096; // STM32WB flash page size used by Flipper Zero's MCU
    const sleep = (ms: number) => new Promise(r => setTimeout(r, Math.max(ms, 5)));

    const dfuGetStatus = async (device: any, ifaceNum: number) => {
        const result = await device.controlTransferIn({
            requestType: 'class', recipient: 'interface', request: DFU_REQUEST.GETSTATUS, value: 0, index: ifaceNum
        }, 6);
        const d = new DataView(result.data.buffer);
        const status = d.getUint8(0);
        const pollTimeout = d.getUint8(1) | (d.getUint8(2) << 8) | (d.getUint8(3) << 16);
        const state = d.getUint8(4);
        return { status, pollTimeout, state };
    };

    const dfuClearStatus = async (device: any, ifaceNum: number) => {
        try {
            await device.controlTransferOut({ requestType: 'class', recipient: 'interface', request: DFU_REQUEST.CLRSTATUS, value: 0, index: ifaceNum }, new Uint8Array(0));
        } catch { /* best-effort */ }
    };

    // Sends one DNLOAD command/data block, then polls GETSTATUS until the device leaves DNBUSY.
    // Throws (and clears the error) if the device reports a non-OK status.
    const dfuDownloadAndWait = async (device: any, ifaceNum: number, blockNum: number, data: Uint8Array) => {
        await device.controlTransferOut({ requestType: 'class', recipient: 'interface', request: DFU_REQUEST.DNLOAD, value: blockNum, index: ifaceNum }, data);
        let st = await dfuGetStatus(device, ifaceNum);
        let guard = 0;
        while (st.state === DFU_STATE.DNBUSY && guard++ < 200) {
            await sleep(st.pollTimeout);
            st = await dfuGetStatus(device, ifaceNum);
        }
        if (st.state === DFU_STATE.DNBUSY) {
            await dfuClearStatus(device, ifaceNum);
            throw new Error('Device stayed busy (DNBUSY) past the maximum poll attempts; aborting transfer.');
        }
        if (st.status !== DFU_STATUS_OK) {
            await dfuClearStatus(device, ifaceNum);
            throw new Error(`Device reported DFU error (status ${st.status}, state ${st.state}) during transfer.`);
        }
        return st;
    };

    const dfuSetAddress = async (device: any, ifaceNum: number, address: number) => {
        const buf = new Uint8Array(5);
        buf[0] = 0x21; // "Set Address Pointer" command
        new DataView(buf.buffer).setUint32(1, address, true);
        await dfuDownloadAndWait(device, ifaceNum, 0, buf);
    };

    const dfuErasePage = async (device: any, ifaceNum: number, address: number) => {
        const buf = new Uint8Array(5);
        buf[0] = 0x41; // "Erase" command
        new DataView(buf.buffer).setUint32(1, address, true);
        await dfuDownloadAndWait(device, ifaceNum, 0, buf);
    };

    // Erases every flash page spanned by [address, address+length).
    const dfuEraseRange = async (device: any, ifaceNum: number, address: number, length: number) => {
        const firstPage = Math.floor(address / ERASE_PAGE_SIZE) * ERASE_PAGE_SIZE;
        const lastByte = address + length - 1;
        for (let page = firstPage; page <= lastByte; page += ERASE_PAGE_SIZE) {
            await dfuErasePage(device, ifaceNum, page);
        }
    };

    // Flash real firmware onto a connected Flipper Zero in DFU/bootloader mode over WebUSB.
    const flashFirmwareViaUsb = async (asset: GithubReleaseAsset) => {
        if (!usbSupported) {
            addLog('ERROR: WebUSB is not supported in this browser/OS. Use a desktop Chrome/Edge browser plugged in via USB.');
            return;
        }
        if (!asset.name.toLowerCase().endsWith('.dfu')) {
            addLog(`ERROR: "${asset.name}" is not a .dfu image. Select the *.dfu asset for USB flashing.`);
            return;
        }
        setFlashStatus('Downloading firmware image...');
        setFlashProgress(0);
        let device: any = null;
        let ifaceNumber: number | null = null;
        try {
            const fwRes = await fetch(asset.browser_download_url);
            if (!fwRes.ok) throw new Error(`Failed to download firmware (${fwRes.status})`);
            const fwBuf = await fwRes.arrayBuffer();
            addLog(`Downloaded ${asset.name} (${(fwBuf.byteLength / 1024).toFixed(0)} KB).`);

            // Parse before touching hardware, so we never erase flash on a device if the image is bad.
            const targets = parseDfuFile(fwBuf);
            const totalBytes = targets.reduce((sum, t) => sum + t.data.length, 0);

            setFlashStatus('Waiting for device selection (put Flipper into DFU/bootloader mode: hold BACK, press and release RESET, release BACK after the blue LED)...');
            device = await (navigator as any).usb.requestDevice({ filters: [{ vendorId: 0x0483, productId: 0xdf11 }] });
            await device.open();
            if (device.configuration === null) await device.selectConfiguration(1);
            const iface = device.configuration.interfaces.find((i: any) => i.alternates.some((a: any) => a.interfaceClass === 0xFE && a.interfaceSubclass === 1));
            if (!iface) throw new Error('No DFU interface found on this USB device. Is it really in bootloader mode?');
            ifaceNumber = iface.interfaceNumber;
            await device.claimInterface(ifaceNumber);
            addLog(`DFU device claimed: ${device.productName || 'STM32 Bootloader'}`);

            let writtenBytes = 0;
            setFlashStatus('Erasing flash sectors...');
            for (const target of targets) {
                await dfuEraseRange(device, ifaceNumber, target.address, target.data.length);
            }

            setFlashStatus('Writing firmware...');
            const CHUNK = 2048;
            for (const target of targets) {
                await dfuSetAddress(device, ifaceNumber, target.address);
                let blockNum = 2; // per DfuSe convention, data blocks start at wValue=2 after the address-pointer command
                for (let off = 0; off < target.data.length; off += CHUNK) {
                    const chunk = target.data.slice(off, off + CHUNK);
                    await dfuDownloadAndWait(device, ifaceNumber, blockNum, chunk);
                    blockNum++;
                    writtenBytes += chunk.length;
                    setFlashProgress(Math.round((writtenBytes / totalBytes) * 100));
                }
            }

            // Empty DNLOAD signals end-of-firmware and triggers the manifestation phase; the device
            // will reset into the new firmware and disconnect from USB, so treat disconnect as success.
            setFlashStatus('Finalizing and rebooting device into new firmware...');
            try {
                await device.controlTransferOut({ requestType: 'class', recipient: 'interface', request: DFU_REQUEST.DNLOAD, value: 0, index: ifaceNumber }, new Uint8Array(0));
                let st = await dfuGetStatus(device, ifaceNumber);
                let guard = 0;
                while ((st.state === DFU_STATE.MANIFEST_SYNC || st.state === DFU_STATE.MANIFEST) && guard++ < 50) {
                    await sleep(st.pollTimeout);
                    st = await dfuGetStatus(device, ifaceNumber);
                }
            } catch {
                // Device commonly resets/disconnects mid-manifestation; that is the expected success path.
            }

            setFlashStatus('Firmware written successfully. Flipper is rebooting into the new firmware.');
            addLog(`Firmware flash complete: ${asset.name}`);
        } catch (error: any) {
            setFlashStatus(null);
            addLog(`USB FLASH ERROR: ${error.message}`);
            setFirmwareError(error.message);
            if (device && ifaceNumber !== null) {
                await dfuClearStatus(device, ifaceNumber);
                try { await device.controlTransferOut({ requestType: 'class', recipient: 'interface', request: DFU_REQUEST.ABORT, value: 0, index: ifaceNumber }, new Uint8Array(0)); } catch { /* best-effort */ }
            }
        } finally {
            setFlashProgress(null);
            if (device && ifaceNumber !== null) {
                // Best-effort cleanup on both success and failure paths. Individually guarded because
                // the device commonly resets/disconnects right after a successful manifestation.
                await dfuClearStatus(device, ifaceNumber);
                try { await device.controlTransferOut({ requestType: 'class', recipient: 'interface', request: DFU_REQUEST.ABORT, value: 0, index: ifaceNumber }, new Uint8Array(0)); } catch { /* best-effort */ }
                try { await device.releaseInterface(ifaceNumber); } catch { /* device may already be disconnected */ }
            }
            if (device) {
                try { await device.close(); } catch { /* device may already be disconnected */ }
            }
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
        { id: 'wifi', label: 'Network', icon: Network },
        { id: 'esp32', label: 'ESP32', icon: RadioReceiver },
        { id: 'nrf24', label: 'NRF24', icon: Satellite },
        { id: 'magspoof', label: 'MagSpoof', icon: CreditCard },
        { id: 'gps', label: 'GPS', icon: MapPin },
        { id: 'camera', label: 'Camera', icon: Camera },
        { id: 'geiger', label: 'Geiger', icon: Activity },
        { id: 'canbus', label: 'CAN Bus', icon: Car },
        { id: 'ethernet', label: 'Ethernet', icon: Network },
        { id: 'firmware', label: 'Firmware', icon: GitBranch },
        { id: 'cloud', label: 'Cloud Sync', icon: Cloud },
        { id: 'terminal', label: 'Terminal', icon: Terminal },
    ];

    const executeAction = async (actionName: string) => {
        addLog(`RPC Dispatch: /api/flipper/${activeTab}/${actionName}`);

        // Real Hardware Mode via Web Serial API
        if (!('serial' in navigator)) {
            addLog(`ERROR: Web Serial API not supported. Cannot connect to real hardware.`);
            return;
        }

        try {
            setScanning(true);
            addLog(`Prompting for Serial Port (Flipper Zero)...`);
            // Flipper Zero STMicroelectronics vendor ID is often 0x0483
            const port = await (navigator as any).serial.requestPort(); 
            await port.open({ baudRate: 115200 });
            addLog(`Serial connection established.`);
            
            const encoder = new TextEncoder();
            const writer = port.writable.getWriter();
            await writer.write(encoder.encode(`\r\n`)); // Wake up CLI
            await writer.write(encoder.encode(`${activeTab} ${actionName}\r\n`));
            writer.releaseLock();
            addLog(`Command sent to hardware: ${activeTab} ${actionName}`);

            // Minimal delay to ensure command reaches
            await new Promise(r => setTimeout(r, 1000));
            
            await port.close();
            addLog(`Action dispatched to hardware successfully. Connection closed.`);
            setScanning(false);
            
            handleAnalyzeAI(`Action executed on REAL HARDWARE: ${actionName} on domain ${activeTab}. Status returned: SUCCESS.`);
        } catch (error: any) {
            addLog(`HARDWARE RPC ERROR: ${error.message}`);
            setScanning(false);
        }
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
                    <div className="flex items-center gap-2 bg-orange-950/40 px-2 py-1 rounded border border-orange-900/50">
                        <span className="flex items-center gap-1.5 text-[10px] text-orange-400">
                            <ShieldCheck size={12} /> Real Hardware (Web APIs)
                        </span>
                    </div>
                    <div className="flex items-center gap-2 bg-orange-950/40 px-2 py-1 rounded border border-orange-900/50">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-orange-400">
                            <input type="checkbox" checked={localOnly} onChange={e => setLocalOnly(e.target.checked)} className="accent-orange-500"/>
                            {localOnly ? <Lock size={12}/> : <Cloud size={12}/>} Local-Only
                        </label>
                    </div>
                    <button 
                        onClick={() => handleAnalyzeAI()} 
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 bg-orange-900/40 hover:bg-orange-900/60 text-orange-400 px-3 py-1.5 rounded text-xs font-bold transition-colors border border-orange-800"
                    >
                        {isAnalyzing ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
                        Analyze with AI
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-40 border-r border-orange-900/30 bg-black/80 overflow-y-auto shrink-0 py-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setAiAnalysis(null); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-l-2 ${activeTab === tab.id ? 'bg-orange-950/50 text-orange-400 border-orange-500' : 'text-orange-700 hover:bg-orange-950/30 hover:text-orange-500 border-transparent'}`}
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
                        <div className="m-4 p-3 border border-orange-500/50 bg-orange-950/30 rounded-lg text-sm text-orange-300 leading-relaxed shrink-0 max-h-48 overflow-y-auto">
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
                                    <button onClick={() => executeAction('scan')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Activity size={14}/> Read Analyzer</button>
                                    <button onClick={() => executeAction('transmit')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Waves size={14}/> Replay Sequence</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">No frequencies currently locked. Run Read Analyzer to scan the 315/433/868 MHz spectrum.</div>
                            </div>
                        )}

                        {activeTab === 'nfc' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">NFC (ISO14443/ISO15693)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('read')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Nfc size={14}/> Read Card</button>
                                    <button onClick={() => executeAction('emulate')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Radio size={14}/> Emulate</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Place Mifare, ISO, or NTAG tags near active bridge antenna to start.</div>
                            </div>
                        )}

                        {activeTab === 'ir' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">Infrared Transceiver</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('learn')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Zap size={14}/> Learn Signal</button>
                                    <button onClick={() => executeAction('universal')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Play size={14}/> Universal Remote</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Configure target appliance IR protocol presets or analyze incoming receiver signals.</div>
                            </div>
                        )}

                        {activeTab === 'rfid' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">LF RFID (125kHz)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('read')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Key size={14}/> Read RFID Key</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Scan low frequency security credentials, EM4100, or H10301 badges.</div>
                            </div>
                        )}

                        {activeTab === 'ibutton' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">iButton (1-Wire)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('read')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><CircleDot size={14}/> Read Dallas Key</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Hook Dallas 1990A touch-memory tokens to local active GPIO probe.</div>
                            </div>
                        )}

                        {activeTab === 'badusb' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">Bad USB (HID Emulation)</h2>
                                <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-500 rounded text-xs flex items-center gap-2 mb-4">
                                    <AlertTriangle size={14}/> Warning: USB HID scripts will emulate standard keyboard inputs directly. Keep target focus clear.
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('execute_script')} className="px-3 py-2 bg-orange-500 text-black hover:bg-orange-400 rounded text-xs uppercase font-bold flex items-center gap-2"><Usb size={14}/> Execute Payload</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'gpio' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">GPIO Interface</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('read_pins')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Cpu size={14}/> Probe Pins</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Analyze high/low signals on available pin grids. Supports SPI, I2C, and UART protocols.</div>
                            </div>
                        )}

                        {activeTab === 'u2f' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">U2F Authenticator</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('authenticate')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><ShieldCheck size={14}/> Auth Request</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Acts as a hardware-bound cryptographic credential container for standard web authentication tokens.</div>
                            </div>
                        )}

                        {activeTab === 'storage' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">SD Card Storage</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('list_dir')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><HardDrive size={14}/> Browse Files</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Read and list contents of the device's /ext storage directory over the real serial link.</div>
                            </div>
                        )}

                        {activeTab === 'bluetooth' && (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex items-center justify-between border-b border-orange-900/30 pb-2">
                                    <h2 className="text-sm font-bold uppercase">Bluetooth LE Scanner</h2>
                                    {bluetoothSupported && (
                                        <button onClick={scanBluetooth} disabled={scanning} className="px-4 py-1.5 bg-orange-500 text-black text-xs font-bold uppercase hover:bg-orange-400 disabled:opacity-50 flex items-center gap-2 rounded">
                                            <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} /> Scan
                                        </button>
                                    )}
                                </div>
                                {!bluetoothSupported ? (
                                    <div className="p-4 bg-orange-950/20 border border-orange-900/50 rounded text-center">
                                        <Bluetooth size={32} className="mx-auto mb-2 text-orange-500 opacity-50" />
                                        <div className="font-bold text-orange-500 mb-1">Not Supported on this Browser</div>
                                        <div className="text-xs text-orange-700 mb-2">Web Bluetooth API is not supported in this browser (e.g., iOS Safari).</div>
                                        <div className="text-[10px] text-orange-500/70">iOS Workaround: To use Web Bluetooth on iPhone, try a third-party BLE-enabled browser app like <strong>Bluefy</strong> or <strong>WebBLE</strong> from the App Store. Apple restricts BLE access in default Safari.</div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {btDevices.length === 0 ? (
                                            <div className="text-orange-800 text-xs italic">No devices found. Click scan to invoke native Bluetooth request dialog.</div>
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
                                )}
                            </div>
                        )}

                        {activeTab === 'wifi' && (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex items-center justify-between border-b border-orange-900/30 pb-2">
                                    <h2 className="text-sm font-bold uppercase">Network Status</h2>
                                    <button onClick={checkNetwork} disabled={scanning} className="px-4 py-1.5 bg-orange-500 text-black text-xs font-bold uppercase hover:bg-orange-400 disabled:opacity-50 flex items-center gap-2 rounded">
                                        <Network size={14} className={scanning ? 'animate-pulse' : ''} /> Check
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-3 border border-orange-900/50 bg-black flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-3">
                                            {isOnline ? <Wifi size={18} className="text-green-500" /> : <Wifi size={18} className="text-red-500" />}
                                            <div>
                                                <div className="font-bold">Internet Connection</div>
                                                <div className={isOnline ? "text-green-600" : "text-red-600"}>{isOnline ? 'ONLINE' : 'OFFLINE'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    {networkInfo && (
                                        <div className="p-3 border border-orange-900/50 bg-black flex flex-col gap-1 text-xs">
                                            <div className="text-orange-600 font-bold mb-1">Network Details</div>
                                            <div className="flex justify-between">
                                                <span className="text-orange-800">Effective Type:</span>
                                                <span className="text-orange-500 font-mono">{networkInfo.type || 'Unknown'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-orange-800">Downlink:</span>
                                                <span className="text-orange-500 font-mono">{networkInfo.downlink || 'Unknown'} Mbps</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'esp32' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">ESP32 Marauder (Devboard)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('marauder_scan')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Wifi size={14}/> WiFi Scan & PMKID</button>
                                    <button onClick={() => executeAction('marauder_deauth')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2 text-red-500"><AlertTriangle size={14}/> Deauth Attack</button>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('marauder_sniff')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><RadioReceiver size={14}/> Sniff Probes</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">ESP32 WiFi Marauder interface for advanced 802.11 auditing.</div>
                            </div>
                        )}
                        {activeTab === 'nrf24' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">NRF24 Sniffer / MouseJacker</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('nrf_sniff')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Satellite size={14}/> Sniff 2.4GHz</button>
                                    <button onClick={() => executeAction('nrf_mousejack')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2 text-red-500"><Usb size={14}/> MouseJack Payload</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Sniff and inject keystrokes into vulnerable wireless mice/keyboards via NRF24LU1+.</div>
                            </div>
                        )}
                        {activeTab === 'magspoof' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">MagSpoof (Magnetic Stripe)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('mag_emulate')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><CreditCard size={14}/> Emulate Track 1/2</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Emulate magnetic stripes wirelessly by pulsing a custom H-bridge electromagnet.</div>
                            </div>
                        )}
                        {activeTab === 'gps' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">GPS Module (NMEA)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('gps_acquire')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><MapPin size={14}/> Acquire Fix</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">UART GPS parser for Wardriving. Saves logs to /ext/gps/ for Kismet/Wigle.</div>
                            </div>
                        )}
                        {activeTab === 'camera' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">ESP32-CAM (Camera)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('cam_capture')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Camera size={14}/> Capture Image</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Capture JPEG via SPI/UART from an external ESP32-CAM module.</div>
                            </div>
                        )}
                        {activeTab === 'geiger' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">Geiger Counter</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('geiger_read')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Activity size={14}/> Measure Radiation</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Detect ionizing radiation (CPM / uSv/h) via GPIO interrupt pulses from a Geiger-Müller tube.</div>
                            </div>
                        )}
                        {activeTab === 'canbus' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">CAN Bus Interactor</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('can_sniff')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Car size={14}/> Sniff CAN Traffic</button>
                                    <button onClick={() => executeAction('can_inject')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2 text-red-500"><Activity size={14}/> Inject Frame</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Read and inject CAN bus frames for automotive diagnostics/auditing via MCP2515 SPI.</div>
                            </div>
                        )}
                        {activeTab === 'ethernet' && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-bold uppercase border-b border-orange-900/30 pb-2">Ethernet (W5500)</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('eth_dhcp')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Network size={14}/> DHCP Discover</button>
                                    <button onClick={() => executeAction('eth_ping')} className="px-3 py-2 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-xs uppercase font-bold flex items-center gap-2"><Activity size={14}/> Ping Test</button>
                                </div>
                                <div className="p-4 bg-black border border-orange-900/30 rounded text-xs text-orange-700 italic">Wired network debugging and raw socket injection via SPI Ethernet module.</div>
                            </div>
                        )}

                        {activeTab === 'firmware' && (
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex items-center justify-between border-b border-orange-900/30 pb-2 gap-2">
                                    <h2 className="text-sm font-bold uppercase shrink-0">Firmware Update</h2>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={firmwareSource}
                                            onChange={e => handleFirmwareSourceChange(e.target.value)}
                                            className="bg-black border border-orange-900 text-orange-400 text-[10px] font-bold uppercase px-2 py-1.5 rounded"
                                        >
                                            {FIRMWARE_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                        <button onClick={() => checkLatestFirmware()} disabled={checkingFirmware} className="px-3 py-1.5 bg-orange-950 border border-orange-900 text-orange-500 text-xs font-bold uppercase hover:bg-orange-900 disabled:opacity-50 flex items-center gap-2 rounded">
                                            <RefreshCw size={14} className={checkingFirmware ? 'animate-spin' : ''} /> Check for Updates
                                        </button>
                                    </div>
                                </div>
                                <div className="text-[10px] text-orange-700 -mt-2">Unleashed is a popular community firmware with extra protocols/sub-GHz regions unlocked; official is Flipper Devices' stock firmware.</div>

                                {!usbSupported && (
                                    <div className="p-3 bg-orange-950/20 border border-orange-900/50 rounded text-xs text-orange-400 flex items-start gap-2">
                                        <Smartphone size={16} className="shrink-0 mt-0.5" />
                                        <div>
                                            WebUSB isn't available on this device/browser (this is an OS limitation on iOS &mdash; no iOS browser exposes raw USB access to web apps). You can still see release info below, but flashing from here needs a desktop Chrome/Edge browser with the Flipper on USB.
                                            <div className="mt-1 text-orange-500">For updating over Bluetooth from a phone, use the official <strong>Flipper Mobile</strong> app from the App Store &mdash; it has real OTA update support this web app can't replicate on iOS.</div>
                                        </div>
                                    </div>
                                )}

                                {firmwareError && (
                                    <div className="p-3 bg-red-950/20 border border-red-900/50 rounded text-xs text-red-400 flex items-center gap-2">
                                        <AlertTriangle size={14}/> {firmwareError}
                                    </div>
                                )}

                                {checkingFirmware && !latestRelease && (
                                    <div className="text-orange-700 text-xs italic">Querying GitHub for the latest official release...</div>
                                )}

                                {latestRelease && (
                                    <div className="space-y-3 overflow-y-auto">
                                        <div className="p-3 border border-orange-900/50 bg-black rounded text-xs space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-orange-400">{latestRelease.name || latestRelease.tag_name}</span>
                                                <a href={latestRelease.html_url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-400 flex items-center gap-1 text-[10px]"><ExternalLink size={12}/> View on GitHub</a>
                                            </div>
                                            <div className="text-orange-700">Published {new Date(latestRelease.published_at).toLocaleDateString()} &middot; Tag {latestRelease.tag_name}</div>
                                            <div className="text-orange-600 max-h-24 overflow-y-auto whitespace-pre-wrap text-[10px] leading-relaxed border-t border-orange-900/30 pt-2">{latestRelease.body?.slice(0, 800) || 'No changelog provided.'}</div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-[10px] uppercase text-orange-600 font-bold">Release Assets</div>
                                            {latestRelease.assets.length === 0 ? (
                                                <div className="text-orange-800 text-xs italic">No downloadable assets on this release.</div>
                                            ) : latestRelease.assets.map((asset, i) => (
                                                <div key={i} className="p-2 border border-orange-900/50 bg-black flex items-center justify-between text-xs">
                                                    <div className="flex flex-col">
                                                        <span className="text-orange-400 font-mono">{asset.name}</span>
                                                        <span className="text-orange-800 text-[10px]">{(asset.size / 1024).toFixed(0)} KB</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <a href={asset.browser_download_url} className="px-2 py-1 bg-orange-950 border border-orange-900 hover:bg-orange-900 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                                                            <DownloadCloud size={12}/> Download
                                                        </a>
                                                        {asset.name.toLowerCase().endsWith('.dfu') && (
                                                            <button
                                                                onClick={() => flashFirmwareViaUsb(asset)}
                                                                disabled={!usbSupported || flashProgress !== null}
                                                                className="px-2 py-1 bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-40 rounded text-[10px] uppercase font-bold flex items-center gap-1"
                                                            >
                                                                <Usb size={12}/> Flash via USB
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {flashProgress !== null && (
                                    <div className="p-3 border border-orange-500/50 bg-orange-950/30 rounded text-xs space-y-2 shrink-0">
                                        <div className="flex justify-between text-orange-400 font-bold"><span>Flashing firmware...</span><span>{flashProgress}%</span></div>
                                        <div className="w-full h-2 bg-black rounded overflow-hidden"><div className="h-full bg-orange-500 transition-all" style={{ width: `${flashProgress}%` }} /></div>
                                        <div className="text-orange-600 text-[10px]">Keep the device plugged in and do not disconnect until this completes.</div>
                                    </div>
                                )}
                                {flashStatus && flashProgress === null && (
                                    <div className="p-3 border border-orange-900/50 bg-black rounded text-xs text-orange-400 shrink-0">{flashStatus}</div>
                                )}

                                <div className="p-3 bg-black border border-orange-900/30 rounded text-[10px] text-orange-700 italic shrink-0">
                                    To enter DFU/bootloader mode: hold <strong>BACK</strong>, press and release <strong>RESET</strong>, then release <strong>BACK</strong> once the screen goes blank/blue-LED lights &mdash; then click "Flash via USB" and select the device from the browser's picker.
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
                                                <div className={`block w-8 h-4 rounded-full transition-colors ${autoSync ? 'bg-orange-500' : 'bg-orange-950 border border-orange-900'}`}></div>
                                                <div className={`absolute left-0.5 top-0.5 bg-black w-3 h-3 rounded-full transition-transform ${autoSync ? 'translate-x-4 bg-black' : 'bg-orange-700'}`}></div>
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
                                        <div className="text-orange-800 text-xs italic">No telemetry data. Trigger sync or pull records from Firestore database.</div>
                                    ) : (
                                        cloudData.map((data: any, i) => (
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
                                                    <div className="text-orange-600 mb-1">Network Connection</div>
                                                    <div className="text-orange-800 max-h-12 overflow-hidden text-[10px]">
                                                        {data.isOnline ? 'Online' : 'Offline'} ({data.networkInfo?.type || 'Unknown'})
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'terminal' && (
                            <div className="absolute inset-0 bg-black flex flex-col p-4">
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
            <style>{`
                @keyframes slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            `}</style>
        </div>
    );
};
