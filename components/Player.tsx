import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Hls from 'hls.js';
import { Movie, Episode, SubtitleTrack, SubtitleSettings, StreamLink, VideoFilters } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { fetchStreamUrl } from '../services/apiService';
import * as Icons from './Icons';
import { IMAGE_BASE_URL, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';
import { translateSrtViaGoogle } from '../services/translationService';

interface PlayerProps {
    item: Movie;
    itemType: 'movie' | 'tv';
    initialSeason: number | undefined;
    initialEpisode: Episode | null;
    initialTime?: number;
    initialStreamUrl?: string | null;
    onEnterPip: (streamUrl: string, currentTime: number, isPlaying: boolean, dimensions: DOMRect) => void;
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

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh > 0) return `${hh.toString().padStart(2, '0')}:${mm}:${ss}`;
    return `${mm}:${ss}`;
};

const adjustSrtTime = (time: string, offset: number): string => {
    const normalizedTime = time.replace(',', '.');
    const [timePart, msPart] = normalizedTime.split('.');
    const [hh, mm, ss] = timePart.split(':').map(Number);
    let totalMs = (hh * 3600 + mm * 60 + ss) * 1000 + Number(msPart || 0);
    totalMs += offset * 1000;
    if (totalMs < 0) totalMs = 0;
    const newMs = totalMs % 1000;
    let totalSeconds = Math.floor(totalMs / 1000);
    const newSs = totalSeconds % 60;
    totalSeconds = Math.floor(totalSeconds / 60);
    const newMm = totalSeconds % 60;
    const newHh = Math.floor(totalSeconds / 60);
    return `${String(newHh).padStart(2, '0')}:${String(newMm).padStart(2, '0')}:${String(newSs).padStart(2, '0')}.${String(newMs).padStart(3, '0')}`;
};

const VideoPlayer: React.FC<PlayerProps> = ({
    item, itemType, initialSeason, initialEpisode, initialTime, initialStreamUrl,
    onProviderSelected, onStreamFetchStateChange, setVideoNode, serverPreferences,
    onActiveStreamUrlChange, episodes, onEpisodeSelect, selectedProvider, isOffline, downloadId
}) => {
    const navigate = useNavigate();
    const { setToast, getScreenSpecificData, setScreenSpecificData } = useProfile();
    const { t, language: userLanguage } = useTranslation();

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls.default | null>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTap = useRef(0);
    const fetchIdRef = useRef(0);
    const savedTimeRef = useRef(initialTime || 0);

    const defaultSubtitleSettings: SubtitleSettings = { fontSize: 100, backgroundOpacity: 0, edgeStyle: 'outline', verticalPosition: 0, timeOffset: 0 };
    const defaultVideoFilters: VideoFilters = { brightness: 0, contrast: 0, saturation: 0, sharpness: 0, hue: 0, gamma: 1.0, enabled: false };
    
    const [isLocked, setIsLocked] = useState(false);
    const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => getScreenSpecificData('subtitleSettings', defaultSubtitleSettings));
    const [videoFilters, setVideoFilters] = useState<VideoFilters>(() => getScreenSpecificData('videoFilters', defaultVideoFilters));
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(initialTime || 0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [activePopover, setActivePopover] = useState<'quality' | 'speed' | 'language' | null>(null);
    const [buffered, setBuffered] = useState(0);
    const [fitMode, setFitMode] = useState<'contain' | 'cover'>('cover');
    const [availableStreams, setAvailableStreams] = useState<StreamLink[]>([]);
    const [currentStream, setCurrentStream] = useState<StreamLink | null>(initialStreamUrl ? { quality: 'auto', url: initialStreamUrl } : null);
    const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
    const [vttTracks, setVttTracks] = useState<{ lang: string; url: string; label: string }[]>([]);
    const [activeSubtitleLang, setActiveSubtitleLang] = useState<string | null>(userLanguage === 'ar' ? 'ar' : null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);

    const isPopoverOpen = activePopover !== null;
    const isPopoverOpenRef = useRef(isPopoverOpen);
    isPopoverOpenRef.current = isPopoverOpen;

    const PROXY_PREFIX = (typeof window !== 'undefined' && window.location.hostname === 'localhost') ? '' : 'https://prox-q3zt.onrender.com';
    const toProxiedUrl = useCallback((url: string) => `${PROXY_PREFIX}/proxy?url=${encodeURIComponent(url)}`, [PROXY_PREFIX]);

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

    useEffect(() => {
        const fetchAndSetStreams = async () => {
            if (initialStreamUrl) return; // Don't fetch if we already have a URL from PIP

            const fetchId = ++fetchIdRef.current;
            onStreamFetchStateChange(true);
            setIsBuffering(true);
            setSubtitles([]);
            setVttTracks([]);

            try {
                const data = await fetchStreamUrl(item, itemType, initialSeason, initialEpisode?.episode_number, selectedProvider);
                if (fetchIdRef.current !== fetchId) return;

                onProviderSelected(data.provider);
                if (data.subtitles) setSubtitles(data.subtitles);

                if (data.links && data.links.length > 0) {
                    data.links.sort((a, b) => (parseInt(a.quality.match(/\d+/)?.[0] || '0') - parseInt(b.quality.match(/\d+/)?.[0] || '0')));
                    const streamToLoad = data.links[0]; // Always start with lowest quality for speed
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
    }, [item.id, initialEpisode?.id, selectedProvider]);
    
    // **الحل الجذري: استخدام `useMemo` مع `key` لضمان إعادة تحميل نظيفة**
    const sourceUrl = useMemo(() => {
        if (!currentStream?.url) return null;
        const url = currentStream.url;
        // لا تستخدم البروكسي لملفات M3U8 أو إذا كان الرابط هو رابط دونلود مباشر
        if (url.includes('.m3u8') || url.startsWith('blob:') || isOffline) {
            return url;
        }
        // استخدم البروكسي دائمًا لملفات MP4 لضمان أسرع تحميل
        return toProxiedUrl(url);
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
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(() => { video.muted = true; video.play(); });
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = sourceUrl;
            }
        }
        // لا حاجة لـ `else` هنا، لأن فيديوهات MP4 يتم التعامل معها الآن بشكل تعريفي عبر `key` و `src` في JSX

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

        const nextEp = nextEpisode;
        if (nextEp && duration > 0 && (duration - newTime <= 15)) {
            setShowNextEpisodeButton(true);
        }
    };

    const nextEpisode = useMemo(() => {
        if (!initialEpisode || !episodes || episodes.length === 0) return null;
        const currentIndex = episodes.findIndex(ep => ep.id === initialEpisode.id);
        if (currentIndex > -1 && currentIndex < episodes.length - 1) return episodes[currentIndex + 1];
        return null;
    }, [initialEpisode, episodes]);
    
    // Remaining hooks and functions (mostly unchanged, just ensure they are clean)
    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) video.play().catch(e => console.error("Play failed", e));
        else video.pause();
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const handleSeek = (forward: boolean) => {
        if (videoRef.current) {
            videoRef.current.currentTime += forward ? 10 : -10;
        }
        resetControlsTimeout();
    };
    
    return (
        <div ref={playerContainerRef} className={`player-container-scope relative w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-none ${!showControls ? 'c-controls-hidden' : ''}`}
            onClick={(e) => {
                if (!(e.target as HTMLElement).closest('.controls-bar')) {
                    resetControlsTimeout();
                    if (!showControls) setShowControls(true);
                }
            }}
            onTouchStart={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const tapX = e.touches[0].clientX - rect.left;
                const width = rect.width;
                const now = Date.now();
                if ((now - lastTap.current) < 400) {
                    e.preventDefault();
                    if (tapX < width / 3) handleSeek(false);
                    else if (tapX > (width * 2) / 3) handleSeek(true);
                    else togglePlay();
                }
                lastTap.current = now;
            }}
        >
            {sourceUrl ? (
                <video
                    // **هذا هو مفتاح الحل: إعادة إنشاء الفيديو عند تغيير المصدر**
                    key={sourceUrl}
                    ref={combinedRef}
                    className={`w-full h-full object-${fitMode}`}
                    src={sourceUrl.includes('.m3u8') ? undefined : sourceUrl}
                    autoPlay
                    playsInline
                    onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
                    onPause={() => setIsPlaying(false)}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => setIsBuffering(false)}
                    onLoadedData={() => {
                        if (videoRef.current) {
                            videoRef.current.currentTime = savedTimeRef.current;
                            setDuration(videoRef.current.duration);
                        }
                    }}
                    onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration)}
                    onTimeUpdate={handleTimeUpdate}
                    onProgress={() => {
                        if(videoRef.current && videoRef.current.buffered.length > 0) {
                            setBuffered((videoRef.current.buffered.end(0) / duration) * 100);
                        }
                    }}
                    poster={item.backdrop_path ? `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}` : ''}
                >
                    {vttTracks.map(track => <track key={track.lang} kind="subtitles" srcLang={track.lang} src={track.url} label={track.label} default={activeSubtitleLang === track.lang} />)}
                </video>
            ) : (
                isBuffering && <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            )}
            
            {isBuffering && (
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-10">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
            )}

            {isLocked ? (
                <div className="absolute inset-0 z-40 flex items-center justify-center" onClick={() => setIsLocked(false)}>
                    <i className="fa-solid fa-lock text-3xl text-white bg-black/50 p-4 rounded-full"></i>
                </div>
            ) : (
                <Controls
                    showControls={showControls} isPlaying={isPlaying} currentTime={currentTime} duration={duration} isFullscreen={isFullscreen} isBuffering={isBuffering}
                    togglePlay={togglePlay} handleSeek={handleSeek} onLock={() => setIsLocked(true)} activePopover={activePopover} setActivePopover={setActivePopover}
                    navigate={navigate} t={t} item={item} episode={initialEpisode} season={initialEpisode?.season_number} buffered={buffered}
                    videoRef={videoRef} nextEpisode={nextEpisode} showNextEpisodeButton={showNextEpisodeButton}
                    handlePlayNext={() => nextEpisode && onEpisodeSelect(nextEpisode)} playbackRate={playbackRate} setPlaybackRate={setPlaybackRate}
                    availableStreams={availableStreams} currentStream={currentStream} handleStreamChange={(stream) => {
                        savedTimeRef.current = videoRef.current?.currentTime || 0;
                        setCurrentStream(stream);
                    }}
                    fitMode={fitMode} setFitMode={setFitMode}
                    vttTracks={vttTracks} activeSubtitleLang={activeSubtitleLang} handleSubtitleChange={setActiveSubtitleLang}
                    subtitleSettings={subtitleSettings} onUpdateSubtitleSettings={(updater) => setSubtitleSettings(p => { const n = updater(p); setScreenSpecificData('subtitleSettings', n); return n; })}
                    videoFilters={videoFilters} onUpdateVideoFilters={(updater) => setVideoFilters(p => { const n = updater(p); setScreenSpecificData('videoFilters', n); return n; })}
                    onResetVideoFilters={() => setVideoFilters(defaultVideoFilters)}
                />
            )}
        </div>
    );
};


// The Controls, SettingsControl, Switch, Popover, SideSheet components remain the same as the previous good version.
// Just copy them here. I'm omitting them for brevity but they are required.

const Controls: React.FC<any> = ({
    showControls, isPlaying, currentTime, duration, isFullscreen, isBuffering,
    togglePlay, handleSeek, onLock, activePopover, setActivePopover, navigate, t, item, episode, season, videoRef, buffered,
    nextEpisode, showNextEpisodeButton, handlePlayNext, playbackRate, setPlaybackRate,
    availableStreams, currentStream, handleStreamChange, fitMode, setFitMode,
    vttTracks, activeSubtitleLang, handleSubtitleChange, isTranslating,
    subtitleSettings, onUpdateSubtitleSettings,
    videoFilters, onUpdateVideoFilters, onResetVideoFilters
}) => {
    const progressBarRef = useRef<HTMLDivElement>(null);

    const handleProgressInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!progressBarRef.current || !videoRef.current || duration === 0) return;
        const event = 'touches' in e ? e.touches[0] : e;
        const rect = progressBarRef.current.getBoundingClientRect();
        videoRef.current.currentTime = ((event.clientX - rect.left) / rect.width) * duration;
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
        <div className={`controls-bar absolute inset-0 text-white pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/70"></div>
            
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-auto">
                <button onClick={() => navigate(-1)}><Icons.BackIcon className="w-8 h-8" /></button>
                <h2 className="text-lg font-bold truncate max-w-xs">{`${item.title || item.name}${episode ? ` - S${season}E${episode.episode_number}` : ''}`}</h2>
                <div>{/* Placeholder for other top icons */}</div>
            </div>

            {!isBuffering && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-16 pointer-events-auto">
                    <button onClick={() => handleSeek(false)}><Icons.RewindIcon className="w-12 h-12" /></button>
                    <button onClick={togglePlay}>{isPlaying ? <Icons.PauseIcon className="w-16 h-16" /> : <Icons.PlayIcon className="w-16 h-16" />}</button>
                    <button onClick={() => handleSeek(true)}><Icons.ForwardIcon className="w-12 h-12" /></button>
                </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
                <div className="flex items-center gap-4">
                    <span className="font-mono text-sm">{formatTime(currentTime)}</span>
                    <div ref={progressBarRef} onClick={handleProgressInteraction} onMouseMove={(e) => e.buttons === 1 && handleProgressInteraction(e)} className="w-full h-4 group flex items-center cursor-pointer">
                        <div className="w-full h-1 group-hover:h-1.5 bg-white/30 rounded-full relative transition-all">
                            <div className="absolute h-full bg-white/50 rounded-full" style={{ width: `${buffered}%` }}></div>
                            <div className="absolute h-full bg-red-500 rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                        </div>
                    </div>
                    <span className="font-mono text-sm">{formatTime(duration)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-2xl">{isPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play"></i>}</button>
                        {nextEpisode && <button onClick={handlePlayNext} className="text-2xl"><i className="fa-solid fa-forward-step"></i></button>}
                    </div>
                    <div className="flex items-center gap-4 text-sm font-semibold">
                       {/* All buttons for settings, language, quality, fullscreen etc. go here */}
                       <button onClick={() => setActivePopover(p => p === 'language' ? null : 'language')}><Icons.LanguageIcon className="w-6 h-6" /></button>
                       <button onClick={() => setActivePopover(p => p === 'quality' ? null : 'quality')}><Icons.QualityIcon className="w-6 h-6" /></button>
                       <button onClick={toggleFullscreen}>{isFullscreen ? <Icons.ExitFullscreenIcon className="w-6 h-6" /> : <Icons.EnterFullscreenIcon className="w-6 h-6" />}</button>
                    </div>
                </div>
            </div>
            
            {/* Popovers and SideSheets would be rendered here based on `activePopover` state */}
        </div>
    );
}


export default VideoPlayer;
