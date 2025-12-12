import React, { useState, useRef, useEffect } from 'react';
import { Track, PlayerState, Workspace, PlayMode } from './types';
import BrandSidebar from './components/BrandSidebar';
import PlayerHeader from './components/PlayerHeader';
import { saveTracks, loadTracks, getWorkspaces, saveWorkspace, deleteWorkspace } from './services/storage';
import { parseRssFeed } from './services/rss';

const App: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [playlist, setPlaylist] = useState<Track[]>([]);
  
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  });
  const [playMode, setPlayMode] = useState<PlayMode>('linear');
  
  // Tracks which workspace the current playlist data actually belongs to.
  // Prevents saving data to the wrong workspace during switching transitions.
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // 1. Initialize Workspaces
  useEffect(() => {
    const init = async () => {
        const loadedWorkspaces = await getWorkspaces();
        if (loadedWorkspaces.length === 0) {
            // Create default if none exist
            const defaultWs = { id: 'default', name: 'main' };
            await saveWorkspace(defaultWs);
            setWorkspaces([defaultWs]);
            setActiveWorkspaceId('default');
        } else {
            setWorkspaces(loadedWorkspaces);
            // Default to first available or stored preference (keeping simple: first)
            setActiveWorkspaceId(loadedWorkspaces[0].id);
        }
    };
    init();
  }, []);

  // 2. Load Tracks when Workspace Changes
  useEffect(() => {
    if (!activeWorkspaceId) return;

    // Invalidate loaded status immediately to prevent 'save' effects from writing old data to new ID
    setLoadedWorkspaceId(null);
    
    // Stop playback when switching
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
    }
    setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: 0, duration: 0 }));
    setCurrentTrackIndex(-1);

    loadTracks(activeWorkspaceId).then(tracks => {
        setPlaylist(tracks);
        if (tracks.length > 0) {
            setCurrentTrackIndex(0);
        }
        // Only mark as loaded if the ID hasn't changed again while we were loading
        setLoadedWorkspaceId(activeWorkspaceId);
    });
  }, [activeWorkspaceId]);

  // 3. Save Tracks on Playlist Change
  useEffect(() => {
      // CRITICAL: Only save if the playlist currently in state belongs to the active workspace.
      if (activeWorkspaceId && loadedWorkspaceId === activeWorkspaceId) {
          saveTracks(activeWorkspaceId, playlist);
      }
  }, [playlist, activeWorkspaceId, loadedWorkspaceId]);

  // --- Workspace Actions ---

  const handleCreateWorkspace = async (name: string) => {
      const newId = crypto.randomUUID();
      const newWs = { id: newId, name };
      await saveWorkspace(newWs);
      setWorkspaces(prev => [...prev, newWs]);
      setActiveWorkspaceId(newId); // Switch to new
  };

  const handleSwitchWorkspace = (id: string) => {
      if (id === activeWorkspaceId) return;
      setActiveWorkspaceId(id);
  };

  const handleDeleteWorkspace = async (id: string) => {
      if (workspaces.length <= 1) {
          alert("Cannot delete the last workspace.");
          return;
      }
      
      try {
          // 1. Determine new active workspace BEFORE deleting from state if needed
          const remaining = workspaces.filter(w => w.id !== id);
          let nextActiveId = activeWorkspaceId;
          
          if (activeWorkspaceId === id) {
              // Switch to the first available workspace
              nextActiveId = remaining[0].id;
          }

          // 2. Perform DB deletion
          await deleteWorkspace(id);
          
          // 3. Update State
          if (activeWorkspaceId !== nextActiveId) {
              setActiveWorkspaceId(nextActiveId);
          }
          setWorkspaces(remaining);
          
          console.log('Workspace deleted successfully:', id);
      } catch (e) {
          console.error("Failed to delete workspace:", e);
          alert("Error deleting workspace. Please try again.");
      }
  };

  // --- Track Actions ---

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newTracks: Track[] = (Array.from(files) as File[]).map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(file),
        isFavorite: false,
        source: 'local',
        workspaceId: activeWorkspaceId
      }));

      setPlaylist((prev) => {
        const updated = [...prev, ...newTracks];
        if (prev.length === 0) {
           setCurrentTrackIndex(0);
        }
        return updated;
      });
    }
  };

  const handleRssImport = async (url: string) => {
      const tracks = await parseRssFeed(url);
      const taggedTracks = tracks.map(t => ({ ...t, workspaceId: activeWorkspaceId }));
      setPlaylist(prev => {
          const updated = [...prev, ...taggedTracks];
          if (prev.length === 0 && updated.length > 0) {
              setCurrentTrackIndex(0);
          }
          return updated;
      });
  };

  const handleClearPlaylist = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
    }
    setPlaylist([]);
    setCurrentTrackIndex(-1);
    setPlayerState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        currentTime: 0, 
        duration: 0 
    }));
  };

  // Triggered when track index changes
  useEffect(() => {
    if (currentTrackIndex >= 0 && playlist[currentTrackIndex]) {
      const track = playlist[currentTrackIndex];
      setPlayerState(prev => ({ ...prev, currentTime: 0, duration: 0 }));
      
      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.load();
        audioRef.current.play()
          .then(() => {
              setPlayerState(prev => ({ ...prev, isPlaying: true }));
          })
          .catch(e => console.error(e));
      }
    }
  }, [currentTrackIndex]);

  // Audio Event Handlers
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (playerState.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
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
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  };

  const handleTogglePlayMode = () => {
      const modes: PlayMode[] = ['linear', 'random', 'loop'];
      const nextIndex = (modes.indexOf(playMode) + 1) % modes.length;
      setPlayMode(modes[nextIndex]);
  };

  const handleNext = () => {
    if (playlist.length === 0) return;

    if (playMode === 'loop') {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        }
        return;
    }

    if (playMode === 'random') {
        let nextIndex = Math.floor(Math.random() * playlist.length);
        // Try not to pick the exact same song unless it's the only one
        if (playlist.length > 1 && nextIndex === currentTrackIndex) {
            nextIndex = (nextIndex + 1) % playlist.length;
        }
        setCurrentTrackIndex(nextIndex);
        return;
    }

    // Linear
    setCurrentTrackIndex(prev => (prev + 1) % playlist.length);
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    // Simple logic: Prev always goes to previous track in list, 
    // even in random mode, to allow user to check "what was before".
    setCurrentTrackIndex(prev => (prev - 1 + playlist.length) % playlist.length);
  };

  const selectTrack = (index: number) => {
    setCurrentTrackIndex(index);
  };

  const toggleFavorite = () => {
    if (currentTrackIndex === -1) return;
    setPlaylist(prev => prev.map((t, i) => 
        i === currentTrackIndex ? { ...t, isFavorite: !t.isFavorite } : t
    ));
  };

  const deleteTrack = (e: React.MouseEvent, indexToDelete: number) => {
    e.stopPropagation();
    setPlaylist(prev => {
        const newPlaylist = prev.filter((_, i) => i !== indexToDelete);
        if (indexToDelete === currentTrackIndex) {
            if (newPlaylist.length === 0) {
                setCurrentTrackIndex(-1);
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.src = "";
                }
                setPlayerState(ps => ({ ...ps, isPlaying: false, currentTime: 0, duration: 0 }));
            } else if (indexToDelete === prev.length - 1) {
                setCurrentTrackIndex(newPlaylist.length - 1);
            }
        } else if (indexToDelete < currentTrackIndex) {
            setCurrentTrackIndex(currentTrackIndex - 1);
        }
        return newPlaylist;
    });
  };

  const currentTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex] : null;

  const totalSize = playlist.reduce((acc, track) => acc + (track.file?.size || 0), 0);

  return (
    <div className="min-h-screen font-mono text-sm flex flex-col md:flex-row p-6 md:p-12 gap-12 relative z-10 select-none bg-syntax-bg text-syntax-fg">
      
      {/* Left Column: Brand & Stats */}
      <BrandSidebar 
        totalTracks={playlist.length} 
        totalSize={totalSize}
        onImport={handleFileUpload}
        onRssImport={handleRssImport}
        onClear={handleClearPlaylist}
        audioRef={audioRef}
        isPlaying={playerState.isPlaying}
        // Workspace Props
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onCreateWorkspace={handleCreateWorkspace}
        onSwitchWorkspace={handleSwitchWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
      />

      {/* Right Column: Player & Playlist */}
      <div className="flex-1 flex flex-col md:h-screen md:overflow-y-auto pb-12 scrollbar-hide">
        
        <PlayerHeader
            currentTrack={currentTrack}
            playerState={playerState}
            playMode={playMode}
            onPlayPause={togglePlayPause}
            onSeek={handleSeek}
            onNext={handleNext}
            onPrev={handlePrev}
            onToggleFavorite={toggleFavorite}
            onToggleMode={handleTogglePlayMode}
        />

        {/* Playlist List */}
        <div className="space-y-1">
            {playlist.length === 0 && loadedWorkspaceId && (
                <div className="text-syntax-comment opacity-50 italic">
                    // No modules loaded in current workspace.
                </div>
            )}
            
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
                        {track.name} {track.source === 'rss' && <span className="text-[10px] bg-syntax-string text-black px-1 ml-2 rounded-[1px]">RSS</span>} {track.isFavorite && <span className="text-syntax-keyword ml-2">*</span>}
                    </span>
                    {idx === currentTrackIndex && (
                         <span className="text-syntax-keyword text-xs animate-pulse">&lt;</span>
                    )}
                    
                    <button
                        onClick={(e) => deleteTrack(e, idx)}
                        className="opacity-0 group-hover:opacity-100 text-syntax-keyword hover:bg-syntax-keyword hover:text-black px-1 -mx-1 transition-all text-xs"
                        title="Delete Track"
                    >
                        [x]
                    </button>
                </div>
            ))}
        </div>

        {/* Extra Playlist Filler */}
        <div className="mt-8 text-syntax-comment opacity-30 text-xs">
            {Array.from({length: 5}).map((_, i) => (
                <div key={i}>{(playlist.length + i + 1).toString().padStart(2, '0')}: [Data corrupted or missing]</div>
            ))}
        </div>
      </div>

      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnded}
      />
    </div>
  );
};

export default App;