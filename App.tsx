import React, { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
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
  const socketRef = useRef<Socket | null>(null);

  // Socket.IO连接
  useEffect(() => {
    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('workspaces', (workspaces) => {
      setWorkspaces(workspaces);
      if (workspaces.length > 0 && !activeWorkspaceId) {
        setActiveWorkspaceId(workspaces[0].id);
      }
    });

    socketRef.current.on('songs', (songs) => {
      // 同步所有歌曲
      const remoteTracks: Track[] = songs.map((song: any) => ({
        id: song.id,
        name: song.originalName,
        url: `http://localhost:3001/stream/${song.id}`,
        isFavorite: false,
        source: 'remote',
        workspaceId: song.workspaceId
      }));
      // 只显示当前工作空间的歌曲
      const currentWorkspaceSongs = remoteTracks.filter(track => track.workspaceId === activeWorkspaceId);
      setPlaylist(currentWorkspaceSongs);
    });

    socketRef.current.on('workspace-created', (workspace) => {
      setWorkspaces(prev => [...prev, workspace]);
    });

    socketRef.current.on('workspace-updated', (workspace) => {
      setWorkspaces(prev => prev.map(w => w.id === workspace.id ? workspace : w));
      if (workspace.id === activeWorkspaceId) {
        // 更新当前工作空间的播放列表
        const remoteTracks: Track[] = workspace.playlist.map((song: any) => ({
          id: song.id,
          name: song.originalName,
          url: `http://localhost:3001/stream/${song.id}`,
          isFavorite: false,
          source: 'remote',
          workspaceId: song.workspaceId
        }));
        setPlaylist(remoteTracks);
      }
    });

    socketRef.current.on('workspace-deleted', (data) => {
      setWorkspaces(prev => prev.filter(w => w.id !== data.id));
      if (activeWorkspaceId === data.id) {
        const remaining = workspaces.filter(w => w.id !== data.id);
        setActiveWorkspaceId(remaining.length > 0 ? remaining[0].id : '');
      }
    });

    socketRef.current.on('song-uploaded', (song) => {
      if (song.workspaceId === activeWorkspaceId) {
        const newTrack: Track = {
          id: song.id,
          name: song.originalName,
          url: `http://localhost:3001/stream/${song.id}`,
          isFavorite: false,
          source: 'remote',
          workspaceId: song.workspaceId
        };
        setPlaylist(prev => [...prev, newTrack]);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [activeWorkspaceId]);

  // 初始化从服务器获取工作空间
  useEffect(() => {
    // 工作空间现在通过Socket.IO获取
  }, []);

// 播放列表现在由服务器管理，不需要本地保存
  useEffect(() => {
    // 播放列表通过Socket.IO同步
  }, [playlist, activeWorkspaceId, loadedWorkspaceId]);

  const handleCreateWorkspace = async (name: string) => {
    socketRef.current?.emit('create-workspace', { name, createdBy: 'user' });
  };

  const handleSwitchWorkspace = (id: string) => {
    if (id === activeWorkspaceId) return;
    setActiveWorkspaceId(id);
    // 重新加载工作空间的歌曲
    fetch(`http://localhost:3001/workspaces/${id}/songs`)
      .then(res => res.json())
      .then(songs => {
        const remoteTracks: Track[] = songs.map((song: any) => ({
          id: song.id,
          name: song.originalName,
          url: `http://localhost:3001/stream/${song.id}`,
          isFavorite: false,
          source: 'remote',
          workspaceId: song.workspaceId
        }));
        setPlaylist(remoteTracks);
        setCurrentTrackIndex(-1);
        setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: 0, duration: 0 }));
      });
  };

  const handleDeleteWorkspace = async (id: string) => {
    if (workspaces.length <= 1) {
      alert("不能删除最后一个工作区。");
      return;
    }
    socketRef.current?.emit('delete-workspace', id);
  };

  // --- Track Actions ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('song', file);
        formData.append('uploadedBy', 'user');
        formData.append('workspaceId', activeWorkspaceId);

        try {
          const response = await fetch('http://localhost:3001/upload', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          console.log('上传成功:', result);
        } catch (error) {
          console.error('上传失败:', error);
        }
      }
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