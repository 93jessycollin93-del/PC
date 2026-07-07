import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Trophy, RefreshCcw } from 'lucide-react';

export const ZenithChessApp: React.FC = () => {
    const [game, setGame] = useState(new Chess());
    const [status, setStatus] = useState('Your turn (White)');

    useEffect(() => {
        if (game.isGameOver()) {
            if (game.isCheckmate()) setStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins!`);
            else if (game.isDraw()) setStatus('Draw!');
            else setStatus('Game over');
        } else {
            setStatus(`${game.turn() === 'w' ? 'White' : 'Black'}'s turn${game.inCheck() ? ' (Check)' : ''}`);
        }
    }, [game]);

    const makeRandomMove = () => {
        const possibleMoves = game.moves();
        if (game.isGameOver() || game.isDraw() || possibleMoves.length === 0) return;
        const randomIndex = Math.floor(Math.random() * possibleMoves.length);
        const copy = new Chess(game.fen());
        copy.move(possibleMoves[randomIndex]);
        setGame(copy);
    };

    const onDrop = (sourceSquare: string, targetSquare: string) => {
        try {
            const copy = new Chess(game.fen());
            const move = copy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q',
            });

            if (move === null) return false;
            setGame(copy);
            setTimeout(makeRandomMove, 300);
            return true;
        } catch (e) {
            return false;
        }
    };

    const resetGame = () => setGame(new Chess());

    return (
        <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center p-4">
            <div className="max-w-2xl w-full flex flex-col items-center bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-800">
                <div className="w-full bg-zinc-950 border-b border-zinc-800 p-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
                        <Trophy size={24} /> Zenith Chess AI
                    </h2>
                    <button onClick={resetGame} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors flex items-center gap-2">
                        <RefreshCcw size={16} /> Reset
                    </button>
                </div>
                
                <div className="w-full p-4 flex justify-between items-center bg-[#1a1a2e]">
                    <div className="text-sm font-bold text-zinc-300">Player vs Zenith AI</div>
                    <div className={`px-4 py-1.5 rounded-full font-bold text-sm ${game.isGameOver() ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {status}
                    </div>
                </div>

                <div className="p-8 w-full max-w-[500px] aspect-square flex items-center justify-center">
                    <Chessboard 
                        options={{
                            position: game.fen(),
                            onPieceDrop: onDrop as any,
                            darkSquareStyle: { backgroundColor: '#b58863' },
                            lightSquareStyle: { backgroundColor: '#f0d9b5' },
                            boardOrientation: "white"
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
