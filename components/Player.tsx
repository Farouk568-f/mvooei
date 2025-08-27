// VideoPlayer.tsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';

// --- ابدأ: تعريف الأنواع (Types) ليعمل الكود بدون أخطاء ---
// من الأفضل أن تكون هذه الأنواع في ملف منفصل مثل types.ts
export interface Movie {
    id: number;
    title: string;
    name?: string; // For TV shows
    backdrop_path?: string;
}

export interface Episode {
    id: number;
    episode_number: number;
    season_number: number;
    name: string;
}

export interface StreamLink {
    quality: string;
    url: string;
}

export interface SubtitleTrack {
    lang: string;
    url: string;
    label: string;
}

export interface SubtitleSettings {
    fontSize: number;
    backgroundOpacity: number;
    edgeStyle: string;
    verticalPosition: number;
    timeOffset: number;
}

export interface VideoFilters {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    hue: number;
    gamma: number;
    enabled: boolean;
}

// واجهة الخصائص (Props) للمكون الرئيسي
interface PlayerProps {
    item: Movie;
    itemType: 'movie' | 'tv';
    initialSeason: number | undefined;
    initialEpisode: Episode | null;
    initialTime?: number;
    initialStreamUrl?: string | null;
    selectedProvider: string | null;
    onProviderSelected: (provider: string) => void;
    onStreamFetchStateChange: (isFetching: boolean) => void;
    setVideoNode?: (node: HTMLVideoElement | null) => void;
    serverPreferences: string[];
    onActiveStreamUrlChange?: (url: string) => void;
    episodes: Episode[];
    onEpisodeSelect: (episode: Episode) => void;
    isOffline?: boolean;
    downloadId?: string;
}
// --- انتهى: تعريف الأنواع ---

// --- ابدأ: مكونات الأيقونات (Icons) ---
const Icons = {
    BackIcon: ({ className = '' }) => <i className={`fa-solid fa-arrow-left ${className}`}></i>,
    RewindIcon: ({ className = '' }) => <i className={`fa-solid fa-backward ${className}`}></i>,
    PlayIcon: ({ className = '' }) => <i className={`fa-solid fa-play ${className}`}></i>,
    PauseIcon: ({ className = '' }) => <i className={`fa-solid fa-pause ${className}`}></i>,
    ForwardIcon: ({ className = '' }) => <i className={`fa-solid fa-forward ${className}`}></i>,
    LanguageIcon: ({ className = '' }) => <i className={`fa-solid fa-language ${className}`}></i>,
    QualityIcon: ({ className = '' }) => <i className={`fa-solid fa-cog ${className}`}></i>, // Using cog as a placeholder
    EnterFullscreenIcon: ({ className = '' }) => <i className={`fa-solid fa-expand ${className}`}></i>,
    ExitFullscreenIcon: ({ className = '' }) => <i className={`fa-solid fa-compress ${className}`}></i>,
};
// --- انتهى: مكونات الأيقونات ---


// دالة مساعدة لتنسيق الوقت
const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh > 0) return `${hh.toString().padStart(2, '0')}:${mm}:${ss}`;
    return `${mm}:${ss}`;
};


// ====================================================================
// المكون الرئيسي: VideoPlayer
// ====================================================================

const VideoPlayer: React.FC<PlayerProps> = ({
    item, itemType, initialSeason, initialEpisode, initialTime, initialStreamUrl,
    onProviderSelected, onStreamFetchStateChange, setVideoNode,
    onActiveStreamUrlChange, episodes, onEpisodeSelect, selectedProvider, isOffline
}) => {
    const navigate = useNavigate();
    // Assuming these contexts are set up correctly in your app
    // const { setToast, getScreenSpecificData, setScreenSpecificData } = useProfile();
    // const { t, language: userLanguage } = useTranslation();
    const setToast = (toast: { message: string, type: "error" | "success" }) => console.log(`${toast.type}: ${toast.message}`);
    const t = (key: string) => key; // Dummy translation function
    const userLanguage = 'en';


    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchIdRef = useRef(0);
    const savedTimeRef = useRef(initialTime || 0);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(initialTime || 0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
    const [availableStreams, setAvailableStreams] = useState<StreamLink[]>([]);
    const [currentStream, setCurrentStream] = useState<StreamLink | null>(initialStreamUrl ? { quality: 'auto', url: initialStreamUrl } : null);
    
    // ... other states
    const [activePopover, setActivePopover] = useState<'quality' | 'speed' | 'language' | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [vttTracks, setVttTracks] = useState<{ lang: string; url: string; label: string }[]>([]);
    const [activeSubtitleLang, setActiveSubtitleLang] = useState<string | null>(null);

    const isPopoverOpen = activePopover !== null;
    const isPopoverOpenRef = useRef(isPopoverOpen);
    isPopoverOpenRef.current = isPopoverOpen;

    const PROXY_PREFIX = 'https://prox-q3zt.onrender.com';
    const toProxiedUrl = useCallback((url: string) => `${PROXY_PREFIX}/proxy?url=${encodeURIComponent(url)}`, []);

    const combinedRef = useCallback((node: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
        if (setVideoNode) setVideoNode(node);
    }, [setVideoNode]);

    const hideControls = useCallback(() => {
        if (!videoRef.current?.paused && !isPopoverOpenRef.current) setShowControls(false);
    }, []);

    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(hideControls, 4000);
    }, [hideControls]);

    // Dummy fetchStreamUrl function for demonstration
    const fetchStreamUrl = async (item: Movie, itemType: string, season?: number, episode?: number, provider?: string | null): Promise<{ links: StreamLink[], provider: string, subtitles: any[] }> => {
        console.log("Fetching stream for:", item.title, `S${season}E${episode}`);
        // In a real app, this would make an API call.
        // Returning the link from your example for testing.
        return new Promise(resolve => setTimeout(() => resolve({
            links: [
                { quality: '1080p', url: 'https://bcdnw.hakunaymatata.com/bt/4bce3be974349fcb733f02d5581ac30d.mp4?sign=481af34387dcd187614d9181f77fa111&t=1756293825' },
                { quality: '720p', url: 'https://bcdnw.hakunaymatata.com/bt/4bce3be974349fcb733f02d5581ac30d.mp4?sign=481af34387dcd187614d9181f77fa111&t=1756293825' } // Use same URL for demo
            ],
            provider: provider || 'DefaultProvider',
            subtitles: []
        }), 500)); // Simulate network delay
    };


    useEffect(() => {
        const fetchAndSetStreams = async () => {
            if (initialStreamUrl) return; 

            const fetchId = ++fetchIdRef.current;
            onStreamFetchStateChange(true);
            setIsBuffering(true);
            setCurrentStream(null); // Clear previous stream

            try {
                const data = await fetchStreamUrl(item, itemType, initialSeason, initialEpisode?.episode_number, selectedProvider);
                if (fetchIdRef.current !== fetchId) return;

                onProviderSelected(data.provider);
                
                if (data.links && data.links.length > 0) {
                    data.links.sort((a, b) => (parseInt(b.quality) - parseInt(a.quality)));
                    const streamToLoad = data.links[0]; // Start with highest quality
                    setCurrentStream(streamToLoad);
                    setAvailableStreams(data.links);
                    if (onActiveStreamUrlChange) onActiveStreamUrlChange(streamToLoad.url);
                } else {
                    throw new Error("No stream links found.");
                }
            } catch (error: any) {
                if (fetchIdRef.current === fetchId) {
                    setToast({ message: error.message || t('failedToLoadVideo'), type: "error" });
                    setCurrentStream(null);
                }
            } finally {
                if (fetchIdRef.current === fetchId) onStreamFetchStateChange(false);
            }
        };

        fetchAndSetStreams();
    }, [item.id, initialEpisode?.id, selectedProvider, initialStreamUrl]);
    
    // **الحل الجذري: استخدام `useMemo` لتحديد الرابط النهائي بشكل نظيف**
    const sourceUrl = useMemo(() => {
        if (!currentStream?.url) return null;
        const url = currentStream.url;
        if (url.includes('.m3u8') || url.startsWith('blob:') || isOffline) {
            return url;
        }
        return toProxiedUrl(url); // استخدم البروكسي دائمًا لملفات MP4
    }, [currentStream, isOffline, toProxiedUrl]);
    
    // **`useEffect` مبسط للغاية: فقط للتحكم في HLS.js**
    useEffect(() => {
        if (!sourceUrl || !videoRef.current) return;
        const video = videoRef.current;

        if (sourceUrl.includes('.m3u8')) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hlsRef.current = hls;
                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = sourceUrl;
            }
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [sourceUrl]); // يعتمد فقط على `sourceUrl`

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const newTime = videoRef.current.currentTime;
        setCurrentTime(newTime);
        savedTimeRef.current = newTime;
        if (nextEpisode && duration > 0 && (duration - newTime <= 60)) {
            setShowNextEpisodeButton(true);
        }
    };
    
    const handlePlayNext = () => {
        if(nextEpisode) {
            savedTimeRef.current = 0;
            onEpisodeSelect(nextEpisode);
        }
    }

    const nextEpisode = useMemo(() => {
        if (!initialEpisode || !episodes || episodes.length === 0) return null;
        const currentIndex = episodes.findIndex(ep => ep.id === initialEpisode.id);
        if (currentIndex > -1 && currentIndex < episodes.length - 1) return episodes[currentIndex + 1];
        return null;
    }, [initialEpisode, episodes]);

    const togglePlay = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
            resetControlsTimeout();
        }
    }, [resetControlsTimeout]);

    const handleSeek = (forward: boolean) => {
        if (videoRef.current) {
            videoRef.current.currentTime += forward ? 10 : -10;
            resetControlsTimeout();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    
    return (
        <div 
            ref={playerContainerRef} 
            className={`player-container-scope relative w-full h-full bg-black flex items-center justify-center overflow-hidden text-white ${!showControls && !isLocked ? 'cursor-none' : ''}`}
            onClick={() => { resetControlsTimeout(); if (!showControls) setShowControls(true); }}
        >
            {!sourceUrl ? (
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
                <video
                    // **هذا هو مفتاح الحل: إعادة إنشاء الفيديو عند تغيير المصدر لضمان تحميل فوري**
                    key={sourceUrl}
                    ref={combinedRef}
                    className={`w-full h-full object-${fitMode}`}
                    src={sourceUrl.includes('.m3u8') ? undefined : sourceUrl}
                    autoPlay
                    playsInline
                    crossOrigin="anonymous"
                    onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
                    onPause={() => setIsPlaying(false)}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => setIsBuffering(false)}
                    onCanPlay={() => setIsBuffering(false)}
                    onLoadedData={() => {
                        if (videoRef.current) {
                            videoRef.current.currentTime = savedTimeRef.current;
                            setDuration(videoRef.current.duration);
                        }
                    }}
                    onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration)}
                    onTimeUpdate={handleTimeUpdate}
                    onProgress={() => {
                        if (videoRef.current && videoRef.current.buffered.length > 0 && duration > 0) {
                            setBuffered((videoRef.current.buffered.end(videoRef.current.buffered.length - 1) / duration) * 100);
                        }
                    }}
                    poster={item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : ''}
                >
                    {vttTracks.map(track => <track key={track.lang} kind="subtitles" srcLang={track.lang} src={track.url} label={track.label} default={activeSubtitleLang === track.lang} />)}
                </video>
            )}
            
            {isBuffering && sourceUrl && (
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-10 bg-black/30">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
            )}

            {isLocked ? (
                <div className="absolute inset-0 z-40 flex items-center justify-start p-4" onClick={() => setIsLocked(false)}>
                    <i className="fa-solid fa-lock text-3xl text-white bg-black/50 p-4 rounded-full cursor-pointer"></i>
                </div>
            ) : (
                <Controls
                    showControls={showControls}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    isFullscreen={isFullscreen}
                    togglePlay={togglePlay}
                    handleSeek={handleSeek}
                    onLock={() => setIsLocked(true)}
                    navigate={navigate}
                    item={item}
                    episode={initialEpisode}
                    buffered={buffered}
                    videoRef={videoRef}
                    nextEpisode={nextEpisode}
                    showNextEpisodeButton={showNextEpisodeButton}
                    handlePlayNext={handlePlayNext}
                    availableStreams={availableStreams}
                    currentStream={currentStream}
                    handleStreamChange={(stream) => {
                        savedTimeRef.current = videoRef.current?.currentTime || 0;
                        setCurrentStream(stream);
                    }}
                />
            )}
        </div>
    );
};


// ====================================================================
// مكون واجهة التحكم: Controls
// ====================================================================
interface ControlsProps {
    showControls: boolean;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isFullscreen: boolean;
    togglePlay: () => void;
    handleSeek: (forward: boolean) => void;
    onLock: () => void;
    navigate: (to: number) => void;
    item: Movie;
    episode: Episode | null;
    buffered: number;
    videoRef: React.RefObject<HTMLVideoElement>;
    nextEpisode: Episode | null;
    showNextEpisodeButton: boolean;
    handlePlayNext: () => void;
    availableStreams: StreamLink[];
    currentStream: StreamLink | null;
    handleStreamChange: (stream: StreamLink) => void;
}

const Controls: React.FC<ControlsProps> = ({
    showControls, isPlaying, currentTime, duration, isFullscreen,
    togglePlay, handleSeek, onLock, navigate, item, episode, buffered, videoRef,
    nextEpisode, showNextEpisodeButton, handlePlayNext,
    availableStreams, currentStream, handleStreamChange
}) => {
    const progressBarRef = useRef<HTMLDivElement>(null);
    const [showQualityMenu, setShowQualityMenu] = useState(false);

    const handleProgressInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!progressBarRef.current || !videoRef.current || !duration) return;
        const event = 'touches' in e ? e.touches[0] : e;
        const rect = progressBarRef.current.getBoundingClientRect();
        const newTime = ((event.clientX - rect.left) / rect.width) * duration;
        videoRef.current.currentTime = newTime;
    };

    const toggleFullscreen = () => {
        const elem = document.querySelector('.player-container-scope');
        if (!elem) return;
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    };
    
    return (
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/70"></div>
            
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-auto">
                <button onClick={() => navigate(-1)} className="p-2"><Icons.BackIcon className="w-8 h-8" /></button>
                <h2 className="text-lg font-bold text-center mx-4">{`${item.title || item.name}${episode ? ` - S${episode.season_number}E${episode.episode_number}` : ''}`}</h2>
                <button onClick={onLock} className="p-2"><i className="fa-solid fa-unlock text-2xl"></i></button>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-16 pointer-events-auto">
                <button onClick={() => handleSeek(false)}><Icons.RewindIcon className="w-12 h-12" /></button>
                <button onClick={togglePlay}>{isPlaying ? <Icons.PauseIcon className="w-16 h-16" /> : <Icons.PlayIcon className="w-16 h-16" />}</button>
                <button onClick={() => handleSeek(true)}><Icons.ForwardIcon className="w-12 h-12" /></button>
            </div>

            {showNextEpisodeButton && nextEpisode && (
                <div className="absolute bottom-24 right-4 pointer-events-auto">
                    <button onClick={handlePlayNext} className="bg-white/20 backdrop-blur-md text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                        <i className="fa-solid fa-forward-step"></i>
                        <span>Next Episode</span>
                    </button>
                </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
                <div className="flex items-center gap-4">
                    <span className="font-mono text-sm">{formatTime(currentTime)}</span>
                    <div 
                        ref={progressBarRef} 
                        onClick={handleProgressInteraction} 
                        className="w-full h-4 group flex items-center cursor-pointer"
                    >
                        <div className="w-full h-1 group-hover:h-1.5 bg-white/30 rounded-full relative transition-all">
                            <div className="absolute h-full bg-white/50 rounded-full" style={{ width: `${buffered}%` }}></div>
                            <div className="absolute h-full bg-red-500 rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                            <div 
                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
                                style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translate(-50%, -50%)' }}
                            ></div>
                        </div>
                    </div>
                    <span className="font-mono text-sm">{formatTime(duration)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-2xl">{isPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play"></i>}</button>
                        {nextEpisode && <button onClick={handlePlayNext} className="text-2xl"><i className="fa-solid fa-forward-step"></i></button>}
                    </div>
                    <div className="flex items-center gap-4 text-2xl relative">
                       <button onClick={() => setShowQualityMenu(prev => !prev)}><Icons.QualityIcon /></button>
                       {showQualityMenu && (
                           <div className="absolute bottom-full right-0 mb-2 bg-black/80 rounded-md py-2 w-28">
                               {availableStreams.map(stream => (
                                   <button 
                                       key={stream.quality}
                                       onClick={() => {
                                           handleStreamChange(stream);
                                           setShowQualityMenu(false);
                                       }}
                                       className={`w-full text-left px-4 py-1 text-sm ${currentStream?.quality === stream.quality ? 'font-bold text-red-500' : ''}`}
                                   >
                                       {stream.quality}
                                   </button>
                               ))}
                           </div>
                       )}
                       <button onClick={toggleFullscreen}>{isFullscreen ? <Icons.ExitFullscreenIcon /> : <Icons.EnterFullscreenIcon />}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VideoPlayer;
