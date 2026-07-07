// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// LTTB (Largest Triangle Three Buckets) downsampling for chart performance
const downsampleLTTB = (data: [number, number][], threshold: number) => {
    if (threshold >= data.length || threshold === 0) return data;
    const sampled: [number, number][] = [];
    let a = 0;
    const bucketSize = (data.length - 2) / (threshold - 2);
    sampled.push(data[a]);
    
    for (let i = 0; i < threshold - 2; i++) {
        let avgX = 0, avgY = 0, avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
        let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
        avgRangeEnd = avgRangeEnd < data.length ? avgRangeEnd : data.length;
        const avgRangeLength = avgRangeEnd - avgRangeStart;
        
        for (let j = avgRangeStart; j < avgRangeEnd; j++) {
            avgX += data[j][0];
            avgY += data[j][1];
        }
        avgX /= avgRangeLength;
        avgY /= avgRangeLength;
        
        let maxArea = -1, maxAreaPoint = -1;
        const rangeStart = Math.floor(i * bucketSize) + 1;
        const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
        const pointAx = data[a][0], pointAy = data[a][1];
        
        for (let j = rangeStart; j < rangeEnd; j++) {
            const area = Math.abs((pointAx - avgX) * (data[j][1] - pointAy) - (pointAx - data[j][0]) * (avgY - pointAy)) * 0.5;
            if (area > maxArea) {
                maxArea = area;
                maxAreaPoint = j;
            }
        }
        sampled.push(data[maxAreaPoint]);
        a = maxAreaPoint;
    }
    sampled.push(data[data.length - 1]);
    return sampled;
};

export const MobileViz = ({ data, prompt }: { data: [number, number][], prompt: string }) => {
    const [config, setConfig] = useState<any>(null);
    const [backend, setBackend] = useState<string>('Connecting...');

    useEffect(() => {
        const init = async () => {
            // Auto-failover logic
            const endpoints = ['https://sas.cybernetic67.com', 'https://cloud.sas-hub.com'];
            let caps = null;
            let activeUrl = '';

            for (const url of endpoints) {
                try {
                    const res = await fetch(`${url}/api/capabilities`, { signal: AbortSignal.timeout(5000) });
                    if (res.ok) {
                        caps = await res.json();
                        activeUrl = url;
                        break;
                    }
                } catch (e) {
                    // Try next backend
                }
            }

            if (!caps) {
                setBackend('📴 Cached');
                const cached = await AsyncStorage.getItem(`viz_cache_${prompt}`);
                if (cached) setConfig(JSON.parse(cached));
                return;
            }

            setBackend(caps.backend === 'local-3090' ? '⚡ 3090' : '☁ Cloud');
            
            // Auto-downsample using LTTB based on device/backend caps
            const maxPoints = caps.max_points || 2000;
            const sampled = downsampleLTTB(data, maxPoints);

            try {
                const res = await fetch(`${activeUrl}/api/viz`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, data: sampled })
                });
                const result = await res.json();
                setConfig(result.chartjs_config);
                // Cache for offline mode
                await AsyncStorage.setItem(`viz_cache_${prompt}`, JSON.stringify(result.chartjs_config));
            } catch (e) {
                setBackend('📴 Cached');
            }
        };
        init();
    }, [data, prompt]);

    if (!config) return <Text style={{ color: 'gray' }}>Loading Viz... {backend}</Text>;

    return (
        <View>
            <Text style={{ fontSize: 12, color: 'gray', marginBottom: 4 }}>{backend}</Text>
            <LineChart
                data={config.data}
                width={Dimensions.get('window').width}
                height={220}
                chartConfig={{
                    ...config.options,
                    propsForDots: { r: "0" }, // Battery saver: minimize dot rendering
                }}
                withDots={false}
                withShadow={false}
                withInnerLines={false}
                withOuterLines={false}
                withScrollableDot={false}
                style={{ borderRadius: 16 }}
            />
        </View>
    );
};
