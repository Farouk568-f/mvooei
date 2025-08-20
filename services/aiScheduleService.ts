

import { LiveChannel, ScheduleItem } from '../types';
import { fetchFromTMDB } from './apiService';

export const CHANNELS: LiveChannel[] = [
  {
    id: 'cartoon',
    name: 'cartoonChannel',
    description: '24/7 cartoons, classics and new hits!',
    logoUrl: 'https://sdmntprwestus.oaiusercontent.com/files/00000000-0df0-6230-aefe-c648ddddb1a6/raw?se=2025-08-13T15%3A08%3A07Z&sp=r&sv=2024-08-04&sr=b&scid=e8a759be-2bcf-521d-8b96-121d804b54c5&skoid=ea0c7534-f237-4ccd-b7ea-766c4ed977ad&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-13T12%3A42%3A33Z&ske=2025-08-14T12%3A42%3A33Z&sks=b&skv=2024-08-04&sig=%2Bu93WGyh8rrBB6InzMfs4drT/cNPVDs7eqQEyIYcNL8%3D',
    promptHint: 'A channel featuring a fixed schedule of classic and modern animated shows.',
  },
  {
    id: 'mix',
    name: 'cineStreamMixChannel',
    description: 'mixDescription',
    logoUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2825&auto=format&fit=crop',
    promptHint: 'A diverse channel with popular movies and TV shows from various genres.',
  }
];

const STATIC_CARTOON_POOL = [
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 1 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 2 },
    { tmdbId: 72530, type: 'tv', seasonNumber: 1, episodeNumber: 1 },
    { tmdbId: 72530, type: 'tv', seasonNumber: 1, episodeNumber: 2 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 4, episodeNumber: 1 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 4, episodeNumber: 2 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 5, episodeNumber: 1 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 5, episodeNumber: 2 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 1 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 2 },
    { tmdbId: 58299, type: 'tv', seasonNumber: 2, episodeNumber: 1 },
    { tmdbId: 58299, type: 'tv', seasonNumber: 2, episodeNumber: 2 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 3 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 4 },
    { tmdbId: 72530, type: 'tv', seasonNumber: 1, episodeNumber: 3 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 3 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 4 },
    { tmdbId: 58299, type: 'tv', seasonNumber: 2, episodeNumber: 3 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 5 },
    { tmdbId: 72530, type: 'tv', seasonNumber: 1, episodeNumber: 4 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 5 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 6 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 6 },
    { tmdbId: 58299, type: 'tv', seasonNumber: 2, episodeNumber: 4 },
    { tmdbId: 72530, type: 'tv', seasonNumber: 1, episodeNumber: 5 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 7 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 8 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 7 },
    { tmdbId: 58299, type: 'tv', seasonNumber: 2, episodeNumber: 5 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 9 },
    { tmdbId: 72530, type: 'tv', seasonNumber: 1, episodeNumber: 6 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 10 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 8 },
    { tmdbId: 58299, type: 'tv', seasonNumber: 2, episodeNumber: 6 },
    // Repeat first 14 to fill 24h
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 1 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 2 },
    { tmdbId: 72530, type: 'tv', seasonNumber: 1, episodeNumber: 1 },
    { tmdbId: 72530, type: 'tv', seasonNumber: 1, episodeNumber: 2 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 4, episodeNumber: 1 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 4, episodeNumber: 2 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 5, episodeNumber: 1 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 5, episodeNumber: 2 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 1 },
    { tmdbId: 33732, type: 'tv', seasonNumber: 6, episodeNumber: 2 },
    { tmdbId: 58299, type: 'tv', seasonNumber: 2, episodeNumber: 1 },
    { tmdbId: 58299, type: 'tv', seasonNumber: 2, episodeNumber: 2 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 3 },
    { tmdbId: 629, type: 'tv', seasonNumber: 1, episodeNumber: 4 },
];

const MIX_POOL = [
    { tmdbId: 1399, type: 'tv', seasonNumber: 1, episodeNumber: 1 }, // Game of Thrones
    { tmdbId: 155, type: 'movie' }, // The Dark Knight
    { tmdbId: 1396, type: 'tv', seasonNumber: 1, episodeNumber: 1 }, // Breaking Bad
    { tmdbId: 680, type: 'movie' }, // Pulp Fiction
    { tmdbId: 76600, type: 'movie' }, // Avatar: The Way of Water
    { tmdbId: 438631, type: 'movie' }, // Dune
    { tmdbId: 823464, type: 'tv', seasonNumber: 1, episodeNumber: 1 }, // The Last of Us
    { tmdbId: 1429, type: 'tv', seasonNumber: 2, episodeNumber: 3 }, // The Good Doctor
    { tmdbId: 299534, type: 'movie' }, // Avengers: Endgame
    { tmdbId: 27205, type: 'movie' }, // Inception
    { tmdbId: 119051, type: 'tv', seasonNumber: 1, episodeNumber: 1 }, // The Boys
    { tmdbId: 121, type: 'movie' }, // The Lord of the Rings: The Two Towers
    { tmdbId: 496243, type: 'movie' }, // Parasite
    { tmdbId: 94997, type: 'tv', seasonNumber: 1, episodeNumber: 1 }, // House of the Dragon
    { tmdbId: 603, type: 'movie' }, // The Matrix
];


interface CachedSchedule {
    expiry: number; // timestamp for when the schedule ends
    schedule: ScheduleItem[];
}

const getCachedSchedule = (channelId: string): ScheduleItem[] | null => {
    try {
        const key = `liveSchedule_v6_${channelId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
            const parsed: CachedSchedule = JSON.parse(cached);
            if (Date.now() < parsed.expiry && Array.isArray(parsed.schedule)) {
                 return parsed.schedule;
            }
        }
        return null;
    } catch (e) {
        console.error("Failed to read schedule from cache", e);
        return null;
    }
};

const setCachedSchedule = (channelId: string, schedule: ScheduleItem[]) => {
    try {
        if (schedule.length === 0) return;
        const key = `liveSchedule_v6_${channelId}`;
        const lastItem = schedule[schedule.length - 1];
        const expiryTime = new Date(lastItem.endTime).getTime();

        const data: CachedSchedule = {
            expiry: expiryTime,
            schedule: schedule
        };
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to write schedule to cache", e);
    }
};

const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const generateScheduleFromPool = async (pool: any[], shuffle: boolean): Promise<ScheduleItem[]> => {
    let fullSchedule: ScheduleItem[] = [];
    let currentTime = new Date();
    let totalDurationSeconds = 0;
    const DURATION_24_HOURS = 24 * 60 * 60;
    
    const contentPool = shuffle ? shuffleArray([...pool]) : [...pool];

    const showDetailsCache = new Map<number, any>();
    const episodeDetailsCache = new Map<string, any>();

    let poolIndex = 0;

    while (totalDurationSeconds < DURATION_24_HOURS) {
        if (poolIndex >= contentPool.length) {
            // Loop the pool if we run out of unique items before 24h
            poolIndex = 0;
        }
        const item = contentPool[poolIndex];
        poolIndex++;
        
        let scheduleItem: Omit<ScheduleItem, 'startTime' | 'endTime'> | null = null;
        
        try {
            if (item.type === 'movie') {
                const movieData = showDetailsCache.get(item.tmdbId) || await fetchFromTMDB(`/movie/${item.tmdbId}`);
                if(!movieData) continue;
                showDetailsCache.set(item.tmdbId, movieData);

                scheduleItem = {
                    type: 'movie',
                    tmdbId: movieData.id,
                    movieTitle: movieData.title,
                    backdrop_path: movieData.backdrop_path,
                    durationSeconds: (movieData.runtime || 90) * 60
                };
            } else { // TV Show
                const showData = showDetailsCache.get(item.tmdbId) || await fetchFromTMDB(`/tv/${item.tmdbId}`);
                if(!showData) continue;
                showDetailsCache.set(item.tmdbId, showData);

                const episodeCacheKey = `${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}`;
                const episodeData = episodeDetailsCache.get(episodeCacheKey) || await fetchFromTMDB(`/tv/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}`);
                if(!episodeData) continue;
                episodeDetailsCache.set(episodeCacheKey, episodeData);

                const duration = shuffle ? (episodeData.runtime || 22) * 60 : 30 * 60;

                scheduleItem = {
                    type: 'show',
                    tmdbId: showData.id,
                    showName: showData.name,
                    season_number: item.seasonNumber,
                    episode_number: item.episodeNumber,
                    episodeTitle: episodeData.name || `Episode ${item.episodeNumber}`,
                    backdrop_path: episodeData.still_path || showData.backdrop_path,
                    durationSeconds: duration,
                };
            }
        } catch (e) {
            console.error("Error fetching details for schedule item", item, e);
            continue;
        }

        if (scheduleItem) {
            const startTime = new Date(currentTime);
            const endTime = new Date(startTime.getTime() + scheduleItem.durationSeconds * 1000);
            
            fullSchedule.push({
                ...scheduleItem,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });

            currentTime = endTime;
            totalDurationSeconds += scheduleItem.durationSeconds;
        }
    }

    return fullSchedule;
};


export const getScheduleForChannel = async (channelId: string): Promise<ScheduleItem[]> => {
    const cached = getCachedSchedule(channelId);
    if (cached && cached.length > 0) {
        return cached;
    }

    const channel = CHANNELS.find(c => c.id === channelId);
    if (!channel) {
        throw new Error(`Channel with ID ${channelId} not found.`);
    }
    
    let fullSchedule;
    if (channelId === 'cartoon') {
        fullSchedule = await generateScheduleFromPool(STATIC_CARTOON_POOL, false);
    } else { // 'mix' channel
        fullSchedule = await generateScheduleFromPool(MIX_POOL, true);
    }
    
    setCachedSchedule(channelId, fullSchedule);
    return fullSchedule;
};