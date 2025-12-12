import React, { useState, useEffect, useRef } from 'react';
import Visualizer from './Visualizer';
import { Workspace } from '../types';
import { Folder, FolderOpen, Plus, Trash2, X, Check } from 'lucide-react';

interface BrandSidebarProps {
  totalTracks: number;
  totalSize: number;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRssImport: (url: string) => Promise<void>;
  onClear: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  
  // Workspace Props
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onCreateWorkspace: (name: string) => void;
  onSwitchWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
}

const BrandSidebar: React.FC<BrandSidebarProps> = ({ 
  totalTracks, 
  totalSize, 
  onImport,
  onRssImport,
  onClear,
  audioRef,
  isPlaying,
  workspaces,
  activeWorkspaceId,
  onCreateWorkspace,
  onSwitchWorkspace,
  onDeleteWorkspace
}) => {
  const [time, setTime] = useState(new Date());
  const [sessionStart] = useState(new Date());
  const [showRssInput, setShowRssInput] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  
  // Workspace UI states
  const [showNewWsInput, setShowNewWsInput] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  // Track which workspace is currently confirming deletion
  const [deletingWsId, setDeletingWsId] = useState<string | null>(null);
  
  const [rssUrl, setRssUrl] = useState('');
  const [loadingRss, setLoadingRss] = useState(false);
  const rssInputRef = useRef<HTMLInputElement>(null);
  const wsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showRssInput && rssInputRef.current) {
        rssInputRef.current.focus();
    }
  }, [showRssInput]);

  useEffect(() => {
      if (showNewWsInput && wsInputRef.current) {
          wsInputRef.current.focus();
      }
  }, [showNewWsInput]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0.00 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour12: false });
  };

  const getSessionDuration = () => {
    const diff = Math.floor((time.getTime() - sessionStart.getTime()) / 1000);
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleRssSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!rssUrl.trim()) return;
      
      setLoadingRss(true);
      try {
          await onRssImport(rssUrl);
          setRssUrl('');
          setShowRssInput(false);
      } catch (err) {
          alert("Failed to load RSS feed. Check URL or CORS permissions.");
      } finally {
          setLoadingRss(false);
      }
  };

  const handleNewWsSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newWsName.trim()) return;
      onCreateWorkspace(newWsName.trim());
      setNewWsName('');
      setShowNewWsInput(false);
  };

  const handleClearConfirm = () => {
      onClear();
      setConfirmClear(false);
  };

  return (
    <div className="w-full md:w-[380px] shrink-0 flex flex-col gap-8 text-sm md:h-screen md:overflow-y-auto pb-12 scrollbar-hide">
      
      {/* Function Header */}
      <div className="font-mono leading-relaxed">
        <span className="text-syntax-function">function</span>{' '}
        <span className="text-syntax-class">musicFor</span>
        <span className="text-syntax-fg">(</span>
        <span className="text-syntax-variable">task</span>{' '}
        <span className="text-syntax-keyword">=</span>{' '}
        <span className="text-syntax-string">'programming'</span>
        <span className="text-syntax-fg">) {'{'}</span><br/>
        &nbsp;&nbsp;<span className="text-syntax-keyword">return</span>{' '}
        <span className="text-syntax-purple">`A series of mixes<br/>
        &nbsp;&nbsp;intended for listening while<br/>
        &nbsp;&nbsp;</span><span className="text-syntax-string">${'{task}'}</span>
        <span className="text-syntax-purple"> to focus the brain and<br/>
        &nbsp;&nbsp;inspire the mind.`</span>;<br/>
        <span className="text-syntax-fg">{'}'}</span>
      </div>

      {/* Visualizer Area */}
      <div className="py-2 opacity-80">
        <Visualizer audioRef={audioRef} isPlaying={isPlaying} />
      </div>

      {/* WORKSPACE EXPLORER */}
      <div className="font-mono text-xs">
          <div className="text-syntax-comment mb-2 uppercase tracking-wider font-bold">Explorer: Workspaces</div>
          <div className="border-l border-syntax-comment/20 pl-2 space-y-1">
              {workspaces.map(ws => {
                  const isActive = ws.id === activeWorkspaceId;
                  const isDeleting = ws.id === deletingWsId;

                  return (
                      <div 
                        key={ws.id} 
                        className="group flex items-center justify-between pr-2 py-0.5 min-h-[28px]"
                      >
                          {/* Case 1: Deletion Confirmation Mode */}
                          {isDeleting ? (
                              <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-left-2 duration-200">
                                  <span className="text-red-500 font-bold">Delete?</span>
                                  <div className="flex gap-2">
                                      <button
                                          onClick={() => {
                                              onDeleteWorkspace(ws.id);
                                              setDeletingWsId(null);
                                          }}
                                          className="text-red-500 hover:bg-red-500 hover:text-black px-1 rounded"
                                          title="Confirm Delete"
                                      >
                                          [yes]
                                      </button>
                                      <button
                                          onClick={() => setDeletingWsId(null)}
                                          className="text-syntax-comment hover:text-white px-1"
                                          title="Cancel"
                                      >
                                          [no]
                                      </button>
                                  </div>
                              </div>
                          ) : (
                              /* Case 2: Normal Display Mode */
                              <>
                                  <div 
                                      className={`flex-1 flex items-center gap-2 overflow-hidden cursor-pointer transition-colors ${isActive ? 'text-syntax-class font-bold' : 'text-syntax-comment hover:text-syntax-fg'}`}
                                      onClick={() => onSwitchWorkspace(ws.id)}
                                      title={`Switch to ${ws.name}`}
                                  >
                                      <span className="text-[10px] shrink-0 min-w-[10px]">{isActive ? '>' : ''}</span>
                                      {isActive ? <FolderOpen size={14} className="shrink-0" /> : <Folder size={14} className="shrink-0" />}
                                      <span className="truncate">{ws.name}</span>
                                  </div>
                                  
                                  {/* Delete Trigger Button */}
                                  {workspaces.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingWsId(ws.id);
                                        }}
                                        className="shrink-0 opacity-40 group-hover:opacity-100 text-syntax-comment hover:text-red-500 p-1 rounded transition-all ml-2"
                                        title="Delete Workspace"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                  )}
                              </>
                          )}
                      </div>
                  );
              })}

              {/* New Workspace Input */}
              {showNewWsInput ? (
                  <form onSubmit={handleNewWsSubmit} className="flex items-center gap-2 text-syntax-fg mt-2 pl-4">
                      <span className="text-syntax-keyword">+</span>
                      <input
                        ref={wsInputRef}
                        type="text"
                        value={newWsName}
                        onChange={(e) => setNewWsName(e.target.value)}
                        className="bg-transparent border-b border-syntax-comment focus:border-syntax-class outline-none w-full text-xs"
                        placeholder="workspace_name"
                        onBlur={() => !newWsName && setShowNewWsInput(false)}
                      />
                  </form>
              ) : (
                  <button 
                    onClick={() => setShowNewWsInput(true)}
                    className="flex items-center gap-2 text-syntax-comment hover:text-syntax-function mt-2 pl-4 transition-colors"
                  >
                      <Plus size={12} />
                      <span>[new_workspace]</span>
                  </button>
              )}
          </div>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-col gap-2 font-mono text-sm mt-4 border-t border-white/5 pt-4">
        
        {/* Row 1 */}
        <div className="flex flex-wrap gap-4 items-center">
            {/* Import Local */}
            <label className="text-syntax-keyword hover:text-syntax-bg hover:bg-syntax-keyword px-1 -mx-1 transition-colors cursor-pointer select-none">
                [import_local_files]
                <input 
                    type="file" 
                    accept="audio/*" 
                    multiple 
                    className="hidden" 
                    onChange={onImport}
                />
            </label>

            {/* Import RSS */}
            <button 
                onClick={() => setShowRssInput(!showRssInput)}
                className={`px-1 -mx-1 transition-colors select-none text-left ${showRssInput ? 'bg-syntax-keyword text-black' : 'text-syntax-keyword hover:text-syntax-bg hover:bg-syntax-keyword'}`}
            >
                {loadingRss ? '[fetching...]' : '[import_rss_feed]'}
            </button>

            {/* Clear Button Group */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setConfirmClear(!confirmClear)}
                    className={`text-syntax-function px-1 -mx-1 transition-colors select-none text-left ${confirmClear ? 'bg-syntax-function text-black' : 'hover:text-syntax-bg hover:bg-syntax-function'}`}
                >
                    [clear_playlist]
                </button>
                
                {confirmClear && (
                    <button 
                        onClick={handleClearConfirm}
                        className="text-syntax-keyword hover:text-syntax-bg hover:bg-syntax-keyword px-1 transition-colors select-none animate-in fade-in slide-in-from-left-2 duration-200"
                    >
                        [confirm]
                    </button>
                )}
            </div>
        </div>

        {/* RSS Input Form */}
        {showRssInput && (
            <form onSubmit={handleRssSubmit} className="mt-2 flex gap-2">
                <span className="text-syntax-variable">&gt;</span>
                <input 
                    ref={rssInputRef}
                    type="url" 
                    value={rssUrl}
                    onChange={(e) => setRssUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    className="bg-transparent border-b border-syntax-comment focus:border-syntax-keyword outline-none text-syntax-string w-full placeholder-syntax-comment/50"
                />
            </form>
        )}
      </div>

      {/* Real Statistics */}
      <div className="text-syntax-comment flex flex-col gap-1 font-mono text-xs">
        <div>// {totalTracks.toString().padStart(3, '0')} tracks initialized</div>
        <div>// {formatSize(totalSize)} total buffer size</div>
        <div>// {getSessionDuration()} session runtime</div>
        <div>// {formatTime(time)} system local time</div>
      </div>

      <div className="text-syntax-string text-xs mt-4">
        /* Ready to process input stream */<br/>
        [waiting for instructions...]
      </div>
      
    </div>
  );
};

export default BrandSidebar;