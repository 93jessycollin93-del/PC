/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

export const SnakeGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // Mutable game state to avoid re-renders during game loop
    const state = useRef({
        playerX: 0,
        playerW: 40,
        playerH: 20,
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

    // Initialize / Reset
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
                // Set canvas resolution to match display size for sharpness
                canvasRef.current.width = clientWidth;
                canvasRef.current.height = clientHeight;
                state.current.gameWidth = clientWidth;
                state.current.gameHeight = clientHeight;
                
                // Keep player on screen if resized
                if (state.current.playerX > clientWidth) {
                    state.current.playerX = clientWidth / 2 - 20;
                }
            }
        };
        
        window.addEventListener('resize', handleResize);
        // Delay slightly to ensure container is sized
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

    const gameLoop = (timestamp: number) => {
        if (!isPlaying || gameOver) return;

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;

        const s = state.current;
        const width = s.gameWidth;
        const height = s.gameHeight;

        // --- UPDATE ---

        // Player Movement
        const speed = 7; // movement speed
        if (s.keys.left) s.playerX = Math.max(0, s.playerX - speed);
        if (s.keys.right) s.playerX = Math.min(width - s.playerW, s.playerX + speed);

        // Shooting
        if (s.keys.space && timestamp - s.lastShot > 250) { // Fire rate 250ms
            s.bullets.push({
                x: s.playerX + s.playerW / 2 - 2, // Center of player
                y: height - s.playerH - 20,
                w: 4,
                h: 12,
                id: s.idCounter++
            });
            s.lastShot = timestamp;
        }

        // Update Bullets
        for (let i = s.bullets.length - 1; i >= 0; i--) {
            const b = s.bullets[i];
            b.y -= 12; // Bullet speed
            if (b.y < -20) s.bullets.splice(i, 1);
        }

        // Spawn Enemies
        // Spawn rate increases slightly with score to make it harder? Nah, keep simple.
        if (timestamp - s.lastSpawn > 800) { 
            const size = 30 + Math.random() * 10;
            s.enemies.push({
                x: Math.random() * (width - size),
                y: -size,
                w: size,
                h: size,
                speed: 2 + Math.random() * 2, // Random speed
                id: s.idCounter++
            });
            s.lastSpawn = timestamp;
        }

        // Update Enemies
        for (let i = s.enemies.length - 1; i >= 0; i--) {
            const e = s.enemies[i];
            e.y += e.speed;

            // Collision with Player (Game Over)
            // Simple AABB
            const playerRect = { x: s.playerX, y: height - s.playerH - 10, w: s.playerW, h: s.playerH };
            if (
                e.x < playerRect.x + playerRect.w &&
                e.x + e.w > playerRect.x &&
                e.y < playerRect.y + playerRect.h &&
                e.y + e.h > playerRect.y
            ) {
                setGameOver(true);
                setIsPlaying(false);
                // Force render for game over screen
                return; 
            }

            // Remove if off screen
            if (e.y > height) {
                s.enemies.splice(i, 1);
                // Optional: Penalty for missing enemies?
            }
        }

        // Collision Bullets <-> Enemies
        for (let i = s.bullets.length - 1; i >= 0; i--) {
            let bulletHit = false;
            for (let j = s.enemies.length - 1; j >= 0; j--) {
                const b = s.bullets[i];
                const e = s.enemies[j];

                if (
                    b.x < e.x + e.w &&
                    b.x + b.w > e.x &&
                    b.y < e.y + e.h &&
                    b.y + b.h > e.y
                ) {
                    s.enemies.splice(j, 1);
                    bulletHit = true;
                    s.score += 100;
                    setScore(s.score); // Trigger React update for score
                    break;
                }
            }
            if (bulletHit) s.bullets.splice(i, 1);
        }

        // --- DRAW ---
        ctx.clearRect(0, 0, width, height);

        // Player
        ctx.fillStyle = '#3b82f6'; // Blue 500
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#2563eb';
        ctx.fillRect(s.playerX, height - s.playerH - 10, s.playerW, s.playerH);
        
        // Player Glow Engine
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(s.playerX + 5, height - s.playerH - 10 + 5, s.playerW - 10, s.playerH - 10);
        ctx.shadowBlur = 0;

        // Bullets
        ctx.fillStyle = '#facc15'; // Yellow 400
        s.bullets.forEach(b => {
            ctx.fillRect(b.x, b.y, b.w, b.h);
        });

        // Enemies
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#22c55e'; // Green 500 glow
        s.enemies.forEach(e => {
            ctx.fillStyle = '#4ade80'; // Green 400
            ctx.fillRect(e.x, e.y, e.w, e.h);
            
            // Alien Eyes (Simple pixel art style)
            ctx.fillStyle = '#064e3b'; // Dark Green
            const eyeSize = e.w * 0.2;
            ctx.fillRect(e.x + e.w * 0.2, e.y + e.h * 0.4, eyeSize, eyeSize);
            ctx.fillRect(e.x + e.w * 0.6, e.y + e.h * 0.4, eyeSize, eyeSize);
        });
        ctx.shadowBlur = 0;

        animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => {
        if (isPlaying && !gameOver) {
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPlaying, gameOver]);

    return (
        <div ref={containerRef} className="h-full w-full bg-zinc-950 relative overflow-hidden flex flex-col items-center justify-center select-none" tabIndex={0}>
            
            {/* Game Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 z-0 block" />

            {/* UI Overlay - Score */}
            <div className="absolute top-4 left-4 z-10 font-mono text-green-500 font-bold text-xl select-none pointer-events-none drop-shadow-md">
                SCORE: {score}
            </div>

            {/* Start / Game Over Screen */}
            {(!isPlaying || gameOver) && (
                <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-green-400 to-green-700 mb-6 tracking-tighter drop-shadow-[0_0_25px_rgba(74,222,128,0.4)]">
                        ALIEN DEFENSE
                    </div>
                    
                    {gameOver && <div className="text-3xl text-red-500 font-bold mb-2 animate-pulse">GAME OVER</div>}
                    {gameOver && <div className="text-zinc-400 mb-6 font-mono">FINAL SCORE: {score}</div>}
                    
                    {!gameOver && (
                        <div className="text-zinc-400 mb-8 text-center space-y-2 text-sm">
                            <p>Use <span className="text-white font-bold bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">←</span> <span className="text-white font-bold bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">→</span> to move</p>
                            <p>Press <span className="text-white font-bold bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">SPACE</span> to fire</p>
                        </div>
                    )}

                    <button 
                        onClick={initGame} 
                        className="group relative px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.4)] flex items-center gap-3"
                    >
                        {gameOver ? <RotateCcw size={20} /> : <Play size={20} fill="currentColor" />}
                        {gameOver ? "RETRY MISSION" : "START GAME"}
                    </button>
                </div>
            )}
        </div>
    );
};
