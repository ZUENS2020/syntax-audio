import { Track } from '../types';

export const parseRssFeed = async (feedUrl: string): Promise<Track[]> => {
    try {
        let text = '';
        
        try {
            // Try direct fetch first
            const response = await fetch(feedUrl);
            if (!response.ok) throw new Error("Network response was not ok");
            text = await response.text();
        } catch (directError) {
            console.warn("Direct RSS fetch failed, attempting CORS proxy...", directError);
            // If direct fetch fails (likely CORS), try via proxy
            // Using allorigins.win as a fallback CORS proxy
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("Proxy response was not ok");
            text = await response.text();
        }
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        
        const items = Array.from(xml.querySelectorAll("item"));
        
        return items.map((item): Track | null => {
            const title = item.querySelector("title")?.textContent || "Unknown Track";
            const enclosure = item.querySelector("enclosure");
            const url = enclosure?.getAttribute("url");
            
            if (!url) return null;
            
            return {
                id: crypto.randomUUID(),
                name: title,
                url: url,
                source: 'rss',
                isFavorite: false
            };
        }).filter((t): t is Track => t !== null);
    } catch (error) {
        console.error("RSS Parse Error", error);
        throw error;
    }
}