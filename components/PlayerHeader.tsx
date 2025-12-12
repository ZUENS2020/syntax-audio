import React from 'react';
import { PlayerState, Track } from '../types';

interface PlayerHeaderProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  onPlayPause: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleFavorite: () => void;
}

const PlayerHeader: React.FC<PlayerHeaderProps> = ({
  currentTrack,
  playerState,
  onPlayPause,
  onSeek,
  onNext,
  onPrev,
  onToggleFavorite
}) => {
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mb-12">
      {/* Big Title */}
      <h1 className="text-4xl md:text-5xl font-light mb-8 text-syntax-fg leading-tight">
        {currentTrack ? (
          <>
            Episode <span className="text-syntax-fg">{currentTrack.name.substring(0, 20)}...</span>:<br/>
            <span className="text-syntax-fg">{currentTrack.name}</span>
          </>
        ) : (
          <span className="text-syntax-comment">Episode 00: Waiting for Input...</span>
        )}
      </h1>

      {/* Controls Block */}
      <div className="font-mono text-sm space-y-2">
        
        {/* Play/Time Row */}
        <div className="flex items-center gap-4">
            <button 
                onClick={onPrev} 
                className="text-syntax-class hover:bg-syntax-class hover:text-black px-1 -mx-1 transition-colors"
            >
                [prev]
            </button>
            <button 
                onClick={onNext} 
                className="text-syntax-class hover:bg-syntax-class hover:text-black px-1 -mx-1 transition-colors"
            >
                [next]
            </button>
            <button 
                onClick={onPlayPause}
                className="text-syntax-class hover:bg-syntax-class hover:text-black px-1 -mx-1 transition-colors font-bold"
            >
                {playerState.isPlaying ? '[stop]' : '[play]'}
            </button>
            
            <span className="text-syntax-comment pl-4">
                {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
            </span>
        </div>

        {/* Seek Bar (Text + Input) */}
        <div className="relative w-full max-w-md h-4 flex items-center group mt-2">
            <div className="absolute inset-0 flex items-center text-syntax-comment text-xs tracking-widest pointer-events-none opacity-50">
                 {/* Visual Mock of Progress */}
                 {playerState.duration > 0 ? (
                    '-'.repeat(50) 
                 ) : (
                    '..................................................'
                 )}
            </div>
            {/* The actual progress bar visual */}
            <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-syntax-class pointer-events-none"
                style={{ width: `${(playerState.currentTime / (playerState.duration || 1)) * 100}%` }}
            />
            
            <input
                type="range"
                min={0}
                max={playerState.duration || 100}
                value={playerState.currentTime}
                onChange={onSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
        </div>

        {/* Extra Links Row */}
        <div className="flex gap-4 pt-2 text-xs">
            <button 
                onClick={onToggleFavorite}
                className={`px-1 -mx-1 transition-colors ${
                    currentTrack?.isFavorite 
                    ? 'text-syntax-keyword bg-white/10' 
                    : 'text-syntax-string hover:bg-syntax-string hover:text-black'
                }`}
            >
                {currentTrack?.isFavorite ? '[★ favourite]' : '[favourite]'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerHeader;