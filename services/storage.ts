import { Track, Workspace } from '../types';

const DB_NAME = 'SyntaxAudioDB';
const STORE_PLAYLIST = 'playlist';
const STORE_WORKSPACES = 'workspaces';
const DB_VERSION = 3; // Bumped to force migration check

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = (e.currentTarget as IDBOpenDBRequest).transaction;
      
      // Create Playlist Store if not exists
      let playlistStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_PLAYLIST)) {
        playlistStore = db.createObjectStore(STORE_PLAYLIST, { keyPath: 'id' });
        playlistStore.createIndex('workspaceId', 'workspaceId', { unique: false });
      } else {
        playlistStore = tx!.objectStore(STORE_PLAYLIST);
        if (!playlistStore.indexNames.contains('workspaceId')) {
           playlistStore.createIndex('workspaceId', 'workspaceId', { unique: false });
        }
      }

      // Create Workspaces Store if not exists
      if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
        db.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
      }

      // MIGRATION: Ensure all tracks have a workspaceId
      if (playlistStore) {
          const cursorReq = playlistStore.openCursor();
          cursorReq.onsuccess = (ev) => {
              const cursor = (ev.target as IDBRequest).result;
              if (cursor) {
                  const track = cursor.value;
                  if (!track.workspaceId) {
                      // Assign legacy tracks to default workspace
                      track.workspaceId = 'default';
                      cursor.update(track);
                  }
                  cursor.continue();
              }
          };
      }
    };
  });
};

// --- WORKSPACE OPERATIONS ---

export const getWorkspaces = async (): Promise<Workspace[]> => {
    const db = await initDB();
    const tx = db.transaction(STORE_WORKSPACES, 'readonly');
    const store = tx.objectStore(STORE_WORKSPACES);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const saveWorkspace = async (workspace: Workspace): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(STORE_WORKSPACES, 'readwrite');
    const store = tx.objectStore(STORE_WORKSPACES);
    store.put(workspace);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const deleteWorkspace = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        const tx = db.transaction([STORE_WORKSPACES, STORE_PLAYLIST], 'readwrite');
        
        // 1. Delete the workspace definition
        tx.objectStore(STORE_WORKSPACES).delete(id);
        
        // 2. Delete all tracks associated with this workspace
        const playlistStore = tx.objectStore(STORE_PLAYLIST);
        
        // Check if index exists before using it to prevent crashes
        if (playlistStore.indexNames.contains('workspaceId')) {
            const index = playlistStore.index('workspaceId');
            const request = index.getAllKeys(id);
            
            request.onsuccess = () => {
                const keys = request.result;
                if (Array.isArray(keys)) {
                    keys.forEach(key => playlistStore.delete(key));
                }
            };
        } else {
            console.error("WorkspaceId index missing on playlist store, cannot delete tracks efficiently.");
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => {
                console.error("Transaction Error in deleteWorkspace:", tx.error);
                reject(tx.error);
            };
        });
    } catch (e) {
        console.error("deleteWorkspace failed:", e);
        throw e;
    }
};

// --- TRACK OPERATIONS ---

export const saveTracks = async (workspaceId: string, tracks: Track[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_PLAYLIST, 'readwrite');
  const store = tx.objectStore(STORE_PLAYLIST);
  
  const index = store.index('workspaceId');
  const getKeysReq = index.getAllKeys(workspaceId);

  getKeysReq.onsuccess = () => {
      const keys = getKeysReq.result;
      keys.forEach(key => store.delete(key));

      // 2. Add new tracks
      for (const track of tracks) {
        const trackToStore = {
            id: track.id,
            workspaceId: workspaceId,
            name: track.name,
            source: track.source,
            isFavorite: track.isFavorite,
            blob: track.file || track.blob, 
            remoteUrl: track.source === 'rss' ? track.url : undefined
        };
        store.put(trackToStore);
      }
  };
  
  return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
  });
};

export const loadTracks = async (workspaceId: string): Promise<Track[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_PLAYLIST, 'readonly');
  const store = tx.objectStore(STORE_PLAYLIST);
  const index = store.index('workspaceId');
  
  const request = index.getAll(workspaceId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const stored = request.result;
      
      const tracks: Track[] = stored.map((item: any) => {
          let url = item.remoteUrl;
          let file = undefined;
          
          if (item.source === 'local' && item.blob) {
              url = URL.createObjectURL(item.blob);
              file = new File([item.blob], item.name, { type: item.blob.type });
          }
          
          return {
              id: item.id,
              workspaceId: item.workspaceId,
              name: item.name,
              source: item.source || 'local',
              isFavorite: item.isFavorite,
              url: url,
              file: file,
              blob: item.blob
          };
      });
      resolve(tracks);
    };
    request.onerror = () => reject(request.error);
  });
};