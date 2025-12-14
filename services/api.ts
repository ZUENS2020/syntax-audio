import { Track } from '../types';

export const getSongs = async (): Promise<string[]> => {
  const response = await fetch('/api/songs');
  return response.json();
};

export const uploadSong = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
};

export const clearPlaylist = async () => {
  await fetch('/api/songs', {
    method: 'DELETE',
  });
};

export const createWorkspace = async (name: string) => {
  const response = await fetch('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return response.json();
};

export const deleteWorkspace = async (id: string) => {
  await fetch(`/api/workspaces/${id}`, {
    method: 'DELETE',
  });
};

export const switchWorkspace = async (id: string) => {
  const response = await fetch('/api/workspaces/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  return response.json();
};
