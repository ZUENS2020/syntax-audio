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
