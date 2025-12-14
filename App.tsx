import React, { useState, useRef, useEffect } from 'react';
import { Track, PlayerState, Workspace, PlayMode } from './types';
import BrandSidebar from './components/BrandSidebar';
import PlayerHeader from './components/PlayerHeader';
import { getSongs, uploadSong } from './services/api';
import socket from './services/socket';

const App: React.FC = () => {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  });
  const [playMode, setPlayMode] = useState<PlayMode>('linear');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Fetch initial song list
    getSongs().then(songNames => {
      const tracks = songNames.map(name => ({
        id: name,
        name,
        url: `/api/songs/${name}`,
        source: 'local',
      })) as Track[];
      setPlaylist(tracks);
    });

    // Listen for workspace updates
    socket.on('workspace-update', (newState) => {
      const { playlist: newPlaylist, currentTrack, isPlaying, timestamp } = newState;

      const tracks = newPlaylist.map((name: string) => ({
        id: name,
        name,
        url: `/api/songs/${name}`,
        source: 'local',
      })) as Track[];
      setPlaylist(tracks);

      if (currentTrack) {
        const newIndex = tracks.findIndex(t => t.name === currentTrack);
        setCurrentTrackIndex(newIndex);
      }

      setPlayerState(prev => ({ ...prev, isPlaying }));

      if (audioRef.current && audioRef.current.src !== `/api/songs/${currentTrack}`) {
        audioRef.current.src = `/api/songs/${currentTrack}`;
        audioRef.current.load();
      }
      
      if (audioRef.current) {
        audioRef.current.currentTime = timestamp;
        if (isPlaying) {
          audioRef.current.play().catch(e => console.error(e));
        } else {
          audioRef.current.pause();
        }
      }
    });

    socket.on('playlist-update', (newPlaylist) => {
      const tracks = newPlaylist.map((name: string) => ({
        id: name,
        name,
        url: `/api/songs/${name}`,
        source: 'local',
      })) as Track[];
      setPlaylist(tracks);
    });

    return () => {
      socket.off('workspace-update');
      socket.off('playlist-update');
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        await uploadSong(file);
      }
    }
  };

  const handleClearPlaylist = () => {
    // This should be a server-side action
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    const action = {
      type: playerState.isPlaying ? 'PAUSE' : 'PLAY',
      payload: {
        track: playlist[currentTrackIndex]?.name,
        timestamp: audioRef.current.currentTime
      },
    };
    socket.emit('player-control', action);
  };

  const selectTrack = (index: number) => {
    const track = playlist[index];
    if(track) {
      socket.emit('player-control', {
        type: 'SELECT_TRACK',
        payload: { track: track.name },
      });
    }
  };

  const handleNext = () => {
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    selectTrack(nextIndex);
  };

  const handlePrev = () => {
    const prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    selectTrack(prevIndex);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audioRef.current!.currentTime,
      }));
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setPlayerState(prev => ({
        ...prev,
        duration: audioRef.current!.duration,
      }));
    }
  };

  const handleTrackEnded = () => {
    handleNext();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Seeking should also be synced, but for simplicity, we'll keep it local for now
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  };

  const currentTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex] : null;

  return (
    <div className="min-h-screen font-mono text-sm flex flex-col md:flex-row p-6 md:p-12 gap-12 relative z-10 select-none bg-syntax-bg text-syntax-fg">
      <BrandSidebar 
        totalTracks={playlist.length} 
        totalSize={0}
        onImport={handleFileUpload}
        onRssImport={() => {}}
        onClear={handleClearPlaylist}
        audioRef={audioRef}
        isPlaying={playerState.isPlaying}
        workspaces={[]}
        activeWorkspaceId=""
        onCreateWorkspace={() => {}}
        onSwitchWorkspace={() => {}}
        onDeleteWorkspace={() => {}}
      />
      <div className="flex-1 flex flex-col md:h-screen md:overflow-y-auto pb-12 scrollbar-hide">
        <PlayerHeader
            currentTrack={currentTrack}
            playerState={playerState}
            playMode={playMode}
            onPlayPause={togglePlayPause}
            onSeek={handleSeek}
            onNext={handleNext}
            onPrev={handlePrev}
            onToggleFavorite={() => {}}
            onToggleMode={() => {}}
        />
        <div className="space-y-1">
            {playlist.map((track, idx) => (
                <div 
                    key={track.id}
                    onClick={() => selectTrack(idx)}
                    className={`cursor-pointer group flex items-baseline gap-4 transition-colors pr-4 ${
                        idx === currentTrackIndex ? 'text-white font-bold' : 'text-syntax-comment hover:text-white'
                    }`}
                >
                    <span className={`w-8 text-right shrink-0 ${idx === currentTrackIndex ? 'text-syntax-class' : 'text-syntax-class opacity-70'}`}>
                        {(idx + 1).toString().padStart(2, '0')}:
                    </span>
                    <span className="truncate flex-1 group-hover:underline decoration-syntax-class underline-offset-4">
                        {track.name}
                    </span>
                </div>
            ))}
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnded}
      />
    </div>
  );
};

export default App;
