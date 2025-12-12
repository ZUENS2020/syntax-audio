// Gemini is not used in this desktop build. Provide a lightweight stub to avoid runtime errors
export const generateTrackManifesto = async (_trackName: string): Promise<string> => {
  return ""; // noop: no external AI provider configured
};