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
    onEpisodesButtonClick?: () => void;
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

// --- Helper Functions ---
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
    const [timePart, msPart] = time.split(',');
    const [hh, mm, ss] = timePart.split(':').map(Number);
    
    let totalMs = (hh * 3600 + mm * 60 + ss) * 1000 + Number(msPart);
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

// --- Main VideoPlayer Component ---
const VideoPlayer: React.FC<PlayerProps> = ({ item, itemType, initialSeason, initialEpisode, initialTime, initialStreamUrl, onEpisodesButtonClick, onEnterPip, selectedProvider, onProviderSelected, onStreamFetchStateChange, setVideoNode, serverPreferences, onActiveStreamUrlChange, episodes, onEpisodeSelect, isOffline, downloadId }) => {
    const navigate = useNavigate();
    const { setToast, getScreenSpecificData, setScreenSpecificData } = useProfile();
    const { t, language: userLanguage } = useTranslation();

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls.default | null>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTap = useRef(0);
    const fetchIdRef = useRef(0);
    const isSeeking = useRef(false);

    // --- State Management ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(initialTime || 0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [buffered, setBuffered] = useState(0);

    const [availableStreams, setAvailableStreams] = useState<StreamLink[]>([]);
    const [currentStream, setCurrentStream] = useState<StreamLink | null>(null);

    const [availableQualities, setAvailableQualities] = useState<Hls.Level[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 for auto
    const [autoLevelIndex, setAutoLevelIndex] = useState<number>(-1);

    const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
    const [vttTracks, setVttTracks] = useState<{ lang: string; url: string; label: string }[]>([]);
    const [activeSubtitleLang, setActiveSubtitleLang] = useState<string | null>(userLanguage === 'ar' ? 'ar' : null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [selectedDub, setSelectedDub] = useState<'ar' | 'fr' | null>(null);
    const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);

    // --- New ArtPlayer-inspired State ---
    const [isLocked, setIsLocked] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const [isInPip, setIsInPip] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('default');
    const [flip, setFlip] = useState('normal');

    const defaultSubtitleSettings: SubtitleSettings = { fontSize: 100, backgroundOpacity: 0, edgeStyle: 'outline', verticalPosition: 0, timeOffset: 0 };
    const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => getScreenSpecificData('subtitleSettings', defaultSubtitleSettings));
    
    const defaultVideoFilters: VideoFilters = { brightness: 0, contrast: 0, saturation: 0, sharpness: 0, hue: 0, gamma: 1.0, enabled: false };
    const [videoFilters, setVideoFilters] = useState<VideoFilters>(() => getScreenSpecificData('videoFilters', defaultVideoFilters));
    
    const combinedRef = useCallback((node: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
        if (setVideoNode) setVideoNode(node);
    }, [setVideoNode]);

    // --- Control Visibility Logic ---
    const hideControls = useCallback(() => {
        if (!videoRef.current?.paused && !showSettings && !showContextMenu) {
            setShowControls(false);
        }
    }, [showSettings, showContextMenu]);

    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(hideControls, 5000);
    }, [hideControls]);

    // --- Core Player Functions ---
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(e => console.error("Play failed", e));
        } else {
            video.pause();
        }
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const toggleFullscreen = useCallback(() => {
        const elem = playerContainerRef.current;
        if (!elem) return;
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`));
        } else {
            document.exitFullscreen();
        }
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const seek = (delta: number) => {
        const video = videoRef.current;
        if (video) {
            video.currentTime = Math.max(0, Math.min(duration, video.currentTime + delta));
            resetControlsTimeout();
        }
    };
    
    const changeVolume = (delta: number) => {
        const video = videoRef.current;
        if (video) {
            const newVolume = Math.max(0, Math.min(1, video.volume + delta));
            video.volume = newVolume;
            video.muted = false;
        }
    };
    
    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if(video) video.muted = !video.muted;
    }, []);

    const togglePip = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return;

        if (document.pictureInPictureEnabled) {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await video.requestPictureInPicture();
                }
            } catch (error) {
                console.error("PIP Error:", error);
                setToast({ message: t('pipNotSupported'), type: 'error' });
            }
        } else {
             setToast({ message: t('pipNotSupported'), type: 'error' });
        }
    }, [setToast, t]);

    const handleScreenshot = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `screenshot-${item.title}-${formatTime(video.currentTime).replace(/:/g, '_')}.png`;
            link.click();
            setToast({ message: t('screenshotTaken'), type: 'success' });
        }
    }, [item.title, setToast, t]);

    // --- Effects for Lifecycle and State Sync ---

    // Initial stream fetching
     useEffect(() => {
        const fetchAndSetStreams = async () => {
            const fetchId = ++fetchIdRef.current;
            onStreamFetchStateChange(true);
            setIsBuffering(true);
            setSubtitles([]);
            setVttTracks([]);

            // ... (rest of the fetching logic remains the same)
            try {
                const data = await fetchStreamUrl(item, itemType, initialSeason, initialEpisode?.episode_number, selectedProvider || undefined, serverPreferences, selectedDub);
                if (fetchIdRef.current !== fetchId) return;

                onProviderSelected(data.provider);
                if (data.subtitles) setSubtitles(data.subtitles);

                if (data.links && data.links.length > 0) {
                    data.links.sort((a, b) => parseInt(a.quality.match(/\d+/)?.[0] || '0') - parseInt(b.quality.match(/\d+/)?.[0] || '0'));
                    setAvailableStreams(data.links);
                    setCurrentStream(data.links[0]);
                    if (onActiveStreamUrlChange) onActiveStreamUrlChange(data.links[0].url);
                } else {
                    throw new Error("No stream links found.");
                }
            } catch (error: any) {
                if (fetchIdRef.current === fetchId) {
                    setToast({ message: error.message || t('failedToLoadVideo'), type: "error" });
                    setAvailableStreams([]);
                    setCurrentStream(null);
                }
            } finally {
                if (fetchIdRef.current === fetchId) onStreamFetchStateChange(false);
            }
        };

        if (item) {
             fetchAndSetStreams();
        }
    }, [item.id, itemType, initialSeason, initialEpisode?.id, selectedProvider, serverPreferences.join(), selectedDub]);

    // Subtitle processing
    useEffect(() => {
        let active = true;
        let createdUrls: string[] = [];
        // ... (subtitle processing logic including auto-translation remains the same)
         const processSubtitles = async () => {
            const newTracks: { lang: string; url: string; label: string }[] = [];
            const processedLangs = new Set<string>();

            const baseLine = 85;
            const offsetPos = (subtitleSettings.verticalPosition || 0);
            const linePosition = Math.round(baseLine - offsetPos);
            const finalLinePosition = Math.max(65, Math.min(90, linePosition));

            const timeOffset = subtitleSettings.timeOffset || 0;
            const srtTimestampLineRegex = /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g;

            const processSrtToVtt = (srtText: string) => {
                let vttContent = "WEBVTT\n\n";
                vttContent += srtText
                    .replace(/\r/g, '')
                    .replace(srtTimestampLineRegex, (match, startTime, endTime) => {
                        const adjustedStart = adjustSrtTime(startTime, timeOffset);
                        const adjustedEnd = adjustSrtTime(endTime, timeOffset);
                        return `${adjustedStart} --> ${adjustedEnd} line:${finalLinePosition}%`;
                    });
                const blob = new Blob([vttContent], { type: 'text/vtt' });
                const vttUrl = URL.createObjectURL(blob);
                createdUrls.push(vttUrl);
                return vttUrl;
            };

            for (const sub of subtitles) {
                if (processedLangs.has(sub.language)) continue;
                try {
                    const res = await fetch(sub.url);
                    if (!res.ok) continue;
                    const srtText = await res.text();
                    const vttUrl = processSrtToVtt(srtText);
                    newTracks.push({ lang: sub.language, url: vttUrl, label: sub.display });
                    processedLangs.add(sub.language);
                } catch (e) {
                    console.error(`Failed to process subtitle: ${sub.display}`, e);
                }
            }
            
            if (userLanguage === 'ar' && !processedLangs.has('ar') && subtitles.length > 0) {
                 const sourceSub = subtitles.find(s => s.language === 'en') || subtitles[0];
                 if (sourceSub) {
                    if (active) setIsTranslating(true);
                     try {
                        const sourceRes = await fetch(sourceSub.url);
                        if(sourceRes.ok) {
                           const sourceSrt = await sourceRes.text();
                           const translatedSrt = await translateSrtViaGoogle(sourceSrt, 'ar');
                           if (translatedSrt && active) {
                                const vttUrl = processSrtToVtt(translatedSrt);
                                const aiLangCode = 'ar-ai';
                                newTracks.push({
                                    lang: aiLangCode,
                                    url: vttUrl,
                                    label: t('arabicAi') + ` (${t('from')} ${sourceSub.display || sourceSub.language})`
                                });
                                setActiveSubtitleLang(aiLangCode);
                           }
                        }
                     } catch (e) {
                         console.error("AI translation error", e);
                     } finally {
                         if (active) setIsTranslating(false);
                     }
                 }
            }

            if (active) setVttTracks(newTracks);
        };

        if (subtitles.length > 0) {
            processSubtitles();
        } else {
            setVttTracks([]);
        }
        
        return () => {
            active = false;
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        }
    }, [subtitles, subtitleSettings, t, userLanguage]);
    
    // Video source attachment (HLS/MP4)
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !currentStream) return;
    
        const savedTime = video.currentTime > 0 ? video.currentTime : initialTime || 0;
        const sourceUrl = currentStream.url;
    
        if (hlsRef.current) hlsRef.current.destroy();
        setAvailableQualities([]);
    
        if (sourceUrl.includes('.m3u8')) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hlsRef.current = hls;
                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
                
                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    setAvailableQualities(data.levels);
                    if (videoRef.current) videoRef.current.currentTime = savedTime;
                    videoRef.current?.play();
                });
                 hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => setAutoLevelIndex(data.level));
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = sourceUrl;
                video.currentTime = savedTime;
            }
        } else {
            video.src = sourceUrl;
            video.currentTime = savedTime;
        }
        video.play().catch(() => {});

        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, [currentStream, initialTime]);

    // Video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            if (!isSeeking.current) setCurrentTime(video.currentTime);
            // ... next episode logic
        };
        const onDurationChange = () => setDuration(video.duration || 0);
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => setIsBuffering(false);
        const onProgress = () => {
            if (video.buffered.length > 0 && duration > 0) {
                setBuffered((video.buffered.end(video.buffered.length - 1) / duration) * 100);
            }
        };
        const onVolumeChange = () => { setVolume(video.volume); setIsMuted(video.muted); };
        const onRateChange = () => setPlaybackRate(video.playbackRate);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('progress', onProgress);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('ratechange', onRateChange);
        
        // PIP listeners
        video.addEventListener('enterpictureinpicture', () => setIsInPip(true));
        video.addEventListener('leavepictureinpicture', () => setIsInPip(false));

        return () => {
            // ... remove all listeners
             video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('progress', onProgress);
            video.removeEventListener('volumechange', onVolumeChange);
            video.removeEventListener('ratechange', onRateChange);
            video.removeEventListener('enterpictureinpicture', () => setIsInPip(true));
            video.removeEventListener('leavepictureinpicture', () => setIsInPip(false));
        };
    }, [duration]);

    // Hotkeys, fullscreen, context menu, and click handlers
    useEffect(() => {
        const player = playerContainerRef.current;
        if (!player) return;

        const handleKeyDown = (e: KeyboardEvent) => {
             if ((e.target as HTMLElement).tagName === 'INPUT') return;
             e.preventDefault();
             switch(e.code) {
                 case 'Space': togglePlay(); break;
                 case 'ArrowRight': seek(5); break;
                 case 'ArrowLeft': seek(-5); break;
                 case 'ArrowUp': changeVolume(0.1); break;
                 case 'ArrowDown': changeVolume(-0.1); break;
                 case 'KeyF': toggleFullscreen(); break;
                 case 'KeyM': toggleMute(); break;
             }
        };
        
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            const rect = player.getBoundingClientRect();
            setShowContextMenu(true);
            setContextMenuPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (showContextMenu) setShowContextMenu(false);
        };
        
        document.addEventListener('keydown', handleKeyDown);
        player.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('click', handleClickOutside);
        
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            player.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [togglePlay, seek, toggleFullscreen, toggleMute, showContextMenu]);

    // Apply styles for flip, aspect ratio, filters, and subtitles
    useEffect(() => {
        const styleId = 'artplayer-styles';
        let styleEl = document.getElementById(styleId) as HTMLStyleElement;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        
        // Subtitle Styles
        const edgeStyleCss = {
            'none': 'none',
            'drop-shadow': '2px 2px 4px rgba(0,0,0,0.9)',
            'outline': 'rgb(0, 0, 0) 1px 1px 2px, rgb(0, 0, 0) -1px -1px 2px, rgb(0, 0, 0) 1px -1px 2px, rgb(0, 0, 0) -1px 1px 2px',
        }[subtitleSettings.edgeStyle];

        // Video filter styles
        const filterString = videoFilters.enabled ? [
            `brightness(${100 + videoFilters.brightness}%)`,
            `contrast(${100 + videoFilters.contrast}%)`,
            `saturate(${100 + videoFilters.saturation}%)`,
            `hue-rotate(${videoFilters.hue}deg)`,
        ].join(' ') : 'none';

        styleEl.textContent = `
            .player-container-scope video::cue {
                font-size: ${subtitleSettings.fontSize}% !important;
                background-color: rgba(0, 0, 0, ${subtitleSettings.backgroundOpacity / 100}) !important;
                text-shadow: ${edgeStyleCss} !important;
            }
            .player-container-scope .video-element {
                filter: ${filterString};
            }
        `;

        const video = videoRef.current;
        if (!video) return;

        // Flip styles
        let transform = '';
        if (flip === 'horizontal') transform += 'scaleX(-1) ';
        if (flip === 'vertical') transform += 'scaleY(-1) ';
        video.style.transform = transform.trim();
        
        // Aspect ratio styles
        Object.assign(video.style, { width: '', height: '', margin: '' });
        if (aspectRatio !== 'default') {
            const [w, h] = aspectRatio.split(':').map(Number);
            const videoRatio = w / h;
            const containerRect = playerContainerRef.current?.getBoundingClientRect();
            if (containerRect) {
                const containerRatio = containerRect.width / containerRect.height;
                if(containerRatio > videoRatio) {
                    video.style.width = `${containerRect.height * videoRatio}px`;
                    video.style.height = '100%';
                    video.style.margin = '0 auto';
                } else {
                    video.style.width = '100%';
                    video.style.height = `${containerRect.width / videoRatio}px`;
                    video.style.margin = 'auto 0';
                }
            }
        }

    }, [subtitleSettings, videoFilters, flip, aspectRatio]);


    return (
        <div 
            ref={playerContainerRef} 
            className={`player-container-scope relative w-full h-full bg-black flex items-center justify-center overflow-hidden ${!showControls ? 'cursor-none' : ''}`} 
            onMouseMove={resetControlsTimeout}
            onClick={() => { setShowControls(s => !s); resetControlsTimeout(); }}
        >
            <video
                ref={combinedRef}
                className="video-element w-full h-full object-contain"
                playsInline
                autoPlay
                poster={item.backdrop_path ? `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}` : ''}
            >
                {vttTracks.map(track => (
                    <track key={track.lang} kind="subtitles" srcLang={track.lang} src={track.url} label={track.label} />
                ))}
            </video>
            
            {isBuffering && (
                 <div className="absolute inset-0 flex flex-col justify-center items-center text-white z-20 pointer-events-none">
                    <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
            )}
            
            {/* UI Overlays */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${showControls || isLocked ? 'opacity-100' : 'opacity-0'}`}>
                {isLocked ? (
                     <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
                        <button onClick={() => setIsLocked(false)} className="bg-black/50 p-4 rounded-full text-2xl">
                            <i className="fa-solid fa-lock"></i>
                        </button>
                    </div>
                ) : (
                    <Controls
                        // ... pass all necessary props to Controls component
                        showControls={showControls}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        duration={duration}
                        buffered={buffered}
                        isMuted={isMuted}
                        volume={volume}
                        playbackRate={playbackRate}
                        isFullscreen={isFullscreen}
                        togglePlay={togglePlay}
                        seek={seek}
                        toggleFullscreen={toggleFullscreen}
                        toggleMute={toggleMute}
                        onVolumeChange={(v) => { if (videoRef.current) videoRef.current.volume = v; }}
                        onPlaybackRateChange={(r) => { if (videoRef.current) videoRef.current.playbackRate = r; }}
                        onSeek={(time) => { if(videoRef.current) videoRef.current.currentTime = time; }}
                        isSeekingRef={isSeeking}
                        onLock={() => setIsLocked(true)}
                        togglePip={togglePip}
                        handleScreenshot={handleScreenshot}
                        setShowSettings={setShowSettings}
                    />
                )}
            </div>

            {showSettings && (
                 <SideSheet title={t('settings')} onClose={() => setShowSettings(false)}>
                    {/* ... Settings content for subtitles, filters, aspect ratio, flip */}
                 </SideSheet>
            )}

            {showContextMenu && (
                 <ContextMenu
                    x={contextMenuPos.x} y={contextMenuPos.y}
                    onClose={() => setShowContextMenu(false)}
                    options={[
                        { label: t('videoInfo'), action: () => setShowInfoPanel(true) },
                        { label: 'ArtPlayer v3.0', isLink: true, href: "https://artplayer.org" },
                    ]}
                 />
            )}

             {showInfoPanel && videoRef.current && (
                <InfoPanel videoEl={videoRef.current} onClose={() => setShowInfoPanel(false)} />
            )}
        </div>
    );
};

// --- Sub-components (Controls, ContextMenu, InfoPanel, etc.) ---
// These would be defined below the main component, receiving props to manage state.
// For brevity, I'll sketch out the structure.

const Controls: React.FC<any> = ({ showControls, isPlaying, ...props }) => {
    // ... JSX for the top bar, center controls, and bottom progress/button bar
    // It will contain buttons for play/pause, volume, time display, settings, screenshot, pip, fullscreen, lock
    return (
        <div className="absolute inset-0 text-white pointer-events-none">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 pointer-events-auto">
                {/* Back button and Title */}
            </div>

            {/* Middle Controls (Lock) */}
             <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto">
                <button onClick={props.onLock} className="bg-black/50 p-4 rounded-full text-2xl"><i className="fa-solid fa-unlock"></i></button>
            </div>
            
            {/* Bottom Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 pointer-events-auto">
                 {/* Progress Bar */}
                <div className="flex items-center gap-4">
                    {/* Time displays */}
                </div>
                 {/* Buttons Row */}
                <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-4">
                        <button onClick={props.togglePlay}>{isPlaying ? <Icons.PauseIcon /> : <Icons.PlayIcon />}</button>
                        {/* Volume Control */}
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={props.handleScreenshot}><i className="fa-solid fa-camera"></i></button>
                        <button onClick={props.togglePip}><i className="fa-solid fa-clone"></i></button>
                        <button onClick={() => props.setShowSettings(true)}><i className="fa-solid fa-gear"></i></button>
                        <button onClick={props.toggleFullscreen}>{props.isFullscreen ? <Icons.ExitFullscreenIcon /> : <Icons.EnterFullscreenIcon />}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContextMenu: React.FC<{x: number, y: number, onClose: () => void, options: any[]}> = ({ x, y, onClose, options }) => {
     useEffect(() => {
        const handler = () => onClose();
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, [onClose]);

    return (
        <div className="absolute bg-black/80 backdrop-blur-sm rounded-md p-2 text-sm z-50 pointer-events-auto" style={{ left: x, top: y }}>
            {options.map(opt => 
                opt.isLink ? 
                <a href={opt.href} target="_blank" rel="noopener noreferrer" className="block px-3 py-1.5 hover:bg-white/10 rounded">{opt.label}</a> :
                <button onClick={() => { opt.action(); onClose(); }} className="block w-full text-left px-3 py-1.5 hover:bg-white/10 rounded">{opt.label}</button>
            )}
        </div>
    );
};

const InfoPanel: React.FC<{videoEl: HTMLVideoElement, onClose: () => void}> = ({ videoEl, onClose }) => {
    const [stats, setStats] = useState({});

    useEffect(() => {
        const interval = setInterval(() => {
            setStats({
                'Player Version': 'ArtPlayer-React v1.0',
                'Video URL': videoEl.currentSrc.substring(0, 100) + '...',
                'Video Resolution': `${videoEl.videoWidth}x${videoEl.videoHeight}`,
                'Video Time': `${formatTime(videoEl.currentTime)} / ${formatTime(videoEl.duration)}`,
                'Video Volume': `${Math.round(videoEl.volume * 100)}% ${videoEl.muted ? '(Muted)' : ''}`,
                'Network State': videoEl.networkState,
                'Ready State': videoEl.readyState,
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [videoEl]);

    return (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm p-4 rounded-lg z-50 pointer-events-auto text-xs font-mono max-w-sm">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-base">{t('videoInfo')}</h4>
                <button onClick={onClose} className="text-lg">&times;</button>
            </div>
            {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2 border-b border-white/10 py-1">
                    <span className="opacity-70">{key}</span>
                    <span>{String(value)}</span>
                </div>
            ))}
        </div>
    );
}

// SideSheet component would be defined here...

export default VideoPlayer;
