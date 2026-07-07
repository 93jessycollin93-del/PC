import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

export const IronMenArcadeApp: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const state = useRef({
        playerX: 0,
        playerW: 40,
        playerH: 40,
        bullets: [] as { x: number, y: number, w: number, h: number, id: number }[],
        enemies: [] as { x: number, y: number, w: number, h: number, speed: number, id: number }[],
        keys: { left: false, right: false, space: false },
        lastShot: 0,
        lastSpawn: 0,
        gameWidth: 0,
        gameHeight: 0,
        score: 0,
        idCounter: 0
    });

    const animationFrameRef = useRef<number | undefined>(undefined);

    const initGame = () => {
        if (!canvasRef.current) return;
        const { width, height } = canvasRef.current;
        state.current.gameWidth = width;
        state.current.gameHeight = height;
        state.current.playerX = width / 2 - 20;
        state.current.bullets = [];
        state.current.enemies = [];
        state.current.score = 0;
        state.current.keys = { left: false, right: false, space: false };
        setScore(0);
        setGameOver(false);
        setIsPlaying(true);
    };

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current && canvasRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                canvasRef.current.width = clientWidth;
                canvasRef.current.height = clientHeight;
                state.current.gameWidth = clientWidth;
                state.current.gameHeight = clientHeight;
                if (state.current.playerX > clientWidth) state.current.playerX = clientWidth / 2 - 20;
            }
        };
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 0);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isPlaying) return;
            switch (e.code) {
                case 'ArrowLeft': state.current.keys.left = true; break;
                case 'ArrowRight': state.current.keys.right = true; break;
                case 'Space': state.current.keys.space = true; break;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'ArrowLeft': state.current.keys.left = false; break;
                case 'ArrowRight': state.current.keys.right = false; break;
                case 'Space': state.current.keys.space = false; break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isPlaying]);

    useEffect(() => {
        if (!isPlaying || gameOver) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const gameLoop = (time: number) => {
            const s = state.current;
            const ctx = canvasRef.current?.getContext('2d');
            if (!ctx) return;
            const width = s.gameWidth;
            const height = s.gameHeight;

            if (s.keys.left) s.playerX -= 8;
            if (s.keys.right) s.playerX += 8;
            if (s.playerX < 0) s.playerX = 0;
            if (s.playerX > width - s.playerW) s.playerX = width - s.playerW;

            if (s.keys.space && time - s.lastShot > 200) {
                s.bullets.push({ x: s.playerX + s.playerW / 2 - 2, y: height - s.playerH - 20, w: 6, h: 20, id: s.idCounter++ });
                s.lastShot = time;
            }

            for (let i = s.bullets.length - 1; i >= 0; i--) {
                s.bullets[i].y -= 12;
                if (s.bullets[i].y < -20) s.bullets.splice(i, 1);
            }

            if (time - s.lastSpawn > Math.max(400, 1200 - s.score * 40)) {
                s.enemies.push({ x: Math.random() * (width - 40), y: -40, w: 40, h: 40, speed: 3 + Math.random() * 3 + (s.score * 0.15), id: s.idCounter++ });
                s.lastSpawn = time;
            }

            for (let i = s.enemies.length - 1; i >= 0; i--) {
                const e = s.enemies[i];
                e.y += e.speed;
                if (e.y + e.h > height - s.playerH - 10 && e.x < s.playerX + s.playerW && e.x + e.w > s.playerX) {
                    setGameOver(true);
                    setIsPlaying(false);
                    return;
                }
                if (e.y > height) {
                    s.enemies.splice(i, 1);
                    continue;
                }
                let hit = false;
                for (let j = s.bullets.length - 1; j >= 0; j--) {
                    const b = s.bullets[j];
                    if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
                        s.bullets.splice(j, 1);
                        s.enemies.splice(i, 1);
                        hit = true;
                        s.score += 1;
                        break;
                    }
                }
                if (!hit) if (s.score % 5 === 0) setScore(s.score);
            }

            ctx.clearRect(0, 0, width, height);

            // Iron Man (Red/Gold)
            ctx.fillStyle = '#dc2626'; // Red 600
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#facc15';
            ctx.fillRect(s.playerX, height - s.playerH - 10, s.playerW, s.playerH);
            
            ctx.fillStyle = '#facc15'; // Gold/Yellow
            ctx.fillRect(s.playerX + 10, height - s.playerH - 5, s.playerW - 20, s.playerH - 20);
            ctx.shadowBlur = 0;

            // Repulsor Blast
            ctx.fillStyle = '#67e8f9'; // Cyan 200
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#06b6d4';
            s.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
            ctx.shadowBlur = 0;

            // Ultrons (Silver/Gray with Red eyes)
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ef4444'; 
            s.enemies.forEach(e => {
                ctx.fillStyle = '#94a3b8'; // Slate 400
                ctx.fillRect(e.x, e.y, e.w, e.h);
                ctx.fillStyle = '#ef4444'; // Red Eyes
                const eyeSize = e.w * 0.25;
                ctx.fillRect(e.x + e.w * 0.15, e.y + e.h * 0.3, eyeSize, eyeSize);
                ctx.fillRect(e.x + e.w * 0.6, e.y + e.h * 0.3, eyeSize, eyeSize);
            });
            ctx.shadowBlur = 0;

            animationFrameRef.current = requestAnimationFrame(gameLoop);
        };
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [isPlaying, gameOver]);

    return (
        <div className="h-full w-full bg-zinc-950 flex flex-col relative" ref={containerRef}>
            <div className="absolute top-4 right-4 z-10 font-mono text-xl font-bold text-yellow-400 drop-shadow-md bg-red-900/50 px-4 py-2 rounded-xl border border-red-500/30">
                SCORE: {state.current.score}
            </div>
            <canvas ref={canvasRef} className="w-full h-full block bg-zinc-950" style={{ backgroundImage: 'linear-gradient(to bottom, #1e1b4b 0%, #000000 100%)' }} />
            {(!isPlaying || gameOver) && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                    {gameOver && (
                        <div className="mb-8 text-center animate-in fade-in zoom-in duration-300">
                            <h2 className="text-5xl font-black text-red-500 mb-2 tracking-wider">SYSTEM FAILURE</h2>
                            <p className="text-xl text-yellow-400 font-mono">FINAL SCORE: {state.current.score}</p>
                        </div>
                    )}
                    <button onClick={initGame} className="group px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full transition-all shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center gap-3">
                        {gameOver ? <RotateCcw size={20} /> : <Play size={20} fill="currentColor" />}
                        {gameOver ? "REBOOT SUIT" : "INITIATE PROTOCOL"}
                    </button>
                </div>
            )}
        </div>
    );
};
