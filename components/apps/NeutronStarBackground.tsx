import React, { useRef, useEffect, useState } from 'react';

interface NeutronStarBackgroundProps {
    brightness?: number;
    speed?: number;
}

export const NeutronStarBackground: React.FC<NeutronStarBackgroundProps> = ({ 
    brightness = 1.0, 
    speed = 1.0 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | undefined>(undefined);
    
    // Config state
    const [config, setConfig] = useState({ b: brightness, s: speed });
    
    useEffect(() => {
        setConfig({ b: brightness, s: speed });
    }, [brightness, speed]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width;
        let height = canvas.height;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', resize);
        resize();

        // Stars array
        const stars = Array.from({ length: 400 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            z: Math.random() * width,
            size: Math.random() * 1.5 + 0.5,
        }));

        let time = 0;

        const draw = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Trailing effect
            ctx.fillRect(0, 0, width, height);

            const cx = width / 2;
            const cy = height / 2;
            const s = config.s;
            const b = config.b;
            
            time += 0.05 * s;

            // Draw background stars (moving towards center slightly)
            ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * b})`;
            stars.forEach(star => {
                // Move stars
                star.z -= 2 * s;
                if (star.z <= 0) {
                    star.z = width;
                    star.x = Math.random() * width;
                    star.y = Math.random() * height;
                }

                // Perspective projection
                const px = (star.x - cx) * (width / star.z) + cx;
                const py = (star.y - cy) * (width / star.z) + cy;
                const psize = star.size * (width / star.z) * 0.5;

                // Draw star if within bounds
                if (px >= 0 && px <= width && py >= 0 && py <= height) {
                    ctx.beginPath();
                    ctx.arc(px, py, psize, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // Draw Neutron Star
            
            // Jet Beams
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(time * 0.2); // Rotating beams
            
            const beamGradient = ctx.createLinearGradient(0, -height, 0, height);
            beamGradient.addColorStop(0, `rgba(150, 200, 255, 0)`);
            beamGradient.addColorStop(0.4, `rgba(180, 220, 255, ${0.4 * b})`);
            beamGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.8 * b})`);
            beamGradient.addColorStop(0.6, `rgba(180, 220, 255, ${0.4 * b})`);
            beamGradient.addColorStop(1, `rgba(150, 200, 255, 0)`);

            // Beam 1
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, height, 0, 0, Math.PI * 2);
            ctx.fillStyle = beamGradient;
            ctx.fill();
            
            ctx.restore();

            // Core Glow
            const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 150);
            const pulse = (Math.sin(time * 3) * 0.5 + 0.5); // 0 to 1
            coreGradient.addColorStop(0, `rgba(255, 255, 255, ${b})`);
            coreGradient.addColorStop(0.1, `rgba(200, 230, 255, ${b * 0.9})`);
            coreGradient.addColorStop(0.4, `rgba(100, 150, 255, ${b * 0.3 * (0.8 + 0.2 * pulse)})`);
            coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(cx, cy, 150, 0, Math.PI * 2);
            ctx.fillStyle = coreGradient;
            ctx.fill();

            // Core Solid
            ctx.beginPath();
            ctx.arc(cx, cy, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Accretion Disk
            ctx.save();
            ctx.translate(cx, cy);
            // Tilt the disk
            ctx.scale(1, 0.3);
            ctx.rotate(-time * 1.5); // Rapid rotation

            const diskGradient = ctx.createRadialGradient(0, 0, 15, 0, 0, 120);
            diskGradient.addColorStop(0, `rgba(255, 255, 255, 0)`); // transparent inside
            diskGradient.addColorStop(0.15, `rgba(255, 255, 255, ${0.9 * b})`); // inner bright edge
            diskGradient.addColorStop(0.3, `rgba(150, 200, 255, ${0.7 * b})`); 
            diskGradient.addColorStop(0.6, `rgba(50, 100, 255, ${0.4 * b})`);
            diskGradient.addColorStop(1, `rgba(0, 0, 50, 0)`); // outer fade

            ctx.beginPath();
            ctx.arc(0, 0, 120, 0, Math.PI * 2);
            ctx.fillStyle = diskGradient;
            ctx.fill();

            ctx.restore();

            requestRef.current = requestAnimationFrame(draw);
        };

        requestRef.current = requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', resize);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [config]);

    return (
        <canvas 
            ref={canvasRef} 
            className="absolute inset-0 pointer-events-none z-0" 
            style={{ width: '100%', height: '100%', background: 'black' }}
        />
    );
};
