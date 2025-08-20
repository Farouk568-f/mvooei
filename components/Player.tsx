import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Hls from 'hls.js';
import { Movie, Episode, SubtitleTrack, SubtitleSettings, StreamLink } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { fetchStreamUrl } from '../services/apiService';
import * as Icons from './Icons';
import { IMAGE_BASE_URL, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';

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

const VideoPlayer: React.FC<PlayerProps> = ({ item, itemType, initialSeason, initialEpisode, initialTime, initialStreamUrl, onEpisodesButtonClick, onEnterPip, selectedProvider, onProviderSelected, onStreamFetchStateChange, setVideoNode, serverPreferences, onActiveStreamUrlChange, episodes, onEpisodeSelect, isOffline, downloadId }) => {
    const navigate = useNavigate();
    const { setToast, getScreenSpecificData, setScreenSpecificData } = useProfile();
    const { t } = useTranslation();

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls.default | null>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTap = useRef(0);
    const seekIndicatorRef = useRef<{ el: HTMLDivElement, icon: HTMLElement, timer: ReturnType<typeof setTimeout> } | null>(null);
    const isInitialLoadRef = useRef(true);
    const fetchIdRef = useRef(0);

    const defaultSubtitleSettings: SubtitleSettings = {
        fontSize: 100,
        backgroundOpacity: 50,
        edgeStyle: 'drop-shadow',
        verticalPosition: 0,
        timeOffset: 0,
    };
    
    const [isLocked, setIsLocked] = useState(false);
    const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => getScreenSpecificData('subtitleSettings', defaultSubtitleSettings));

    const combinedRef = useCallback((node: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
        if (setVideoNode) {
            setVideoNode(node);
        }
    }, [setVideoNode]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(initialTime || 0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [activePopover, setActivePopover] = useState<'quality' | 'speed' | 'language' | null>(null);

    // Startup loading metrics
    const INITIAL_STARTUP_BUFFER_SECONDS = 5; // target buffer for initial start
    const [startupPercent, setStartupPercent] = useState(0);
    const [downloadSpeedKbps, setDownloadSpeedKbps] = useState<number | null>(null);
    const speedMeasuredRef = useRef(false);

    const [buffered, setBuffered] = useState(0);
    const [fitMode, setFitMode] = useState<'contain' | 'cover'>('cover');
    
    const [availableStreams, setAvailableStreams] = useState<StreamLink[]>([]);
    const [currentStream, setCurrentStream] = useState<StreamLink | null>(null);

    const [availableQualities, setAvailableQualities] = useState<Hls.Level[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 for auto
    const [autoLevelIndex, setAutoLevelIndex] = useState<number>(-1);

    const [provider, setProvider] = useState<string | null>(null);
    const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
    const [vttTracks, setVttTracks] = useState<{ lang: string; url: string; label: string }[]>([]);
    const [activeSubtitleLang, setActiveSubtitleLang] = useState<string | null>('ar');
    const [selectedDub, setSelectedDub] = useState<'ar' | 'fr' | null>(null);
    const [shouldResetTime, setShouldResetTime] = useState(false);
    const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);

    const isPopoverOpen = activePopover !== null;
    const isPopoverOpenRef = useRef(isPopoverOpen);
    isPopoverOpenRef.current = isPopoverOpen;

    const hideControls = useCallback(() => {
        if (!videoRef.current?.paused && !isPopoverOpenRef.current) {
            setShowControls(false);
        }
    }, []);

    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(hideControls, 5000);
    }, [hideControls]);

    const nextEpisode = useMemo(() => {
        if (!initialEpisode || !episodes || episodes.length === 0) return null;
        const currentIndex = episodes.findIndex(ep => ep.id === initialEpisode.id);
        if (currentIndex > -1 && currentIndex < episodes.length - 1) {
            return episodes[currentIndex + 1];
        }
        return null;
    }, [initialEpisode, episodes]);

    useEffect(() => {
        setShowNextEpisodeButton(false);
    }, [initialEpisode]);

    const handlePlayNext = useCallback(() => {
        if (nextEpisode) {
            onEpisodeSelect(nextEpisode);
        }
    }, [nextEpisode, onEpisodeSelect]);

    useEffect(() => {
        const styleId = 'custom-subtitle-styles';
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }
    
        const edgeStyleCss = {
            'none': 'none',
            'drop-shadow': '2px 2px 4px rgba(0,0,0,0.9)',
            'outline': 'rgb(0, 0, 0) 1px 1px 2px, rgb(0, 0, 0) -1px -1px 2px, rgb(0, 0, 0) 1px -1px 2px, rgb(0, 0, 0) -1px 1px 2px',
        }[subtitleSettings.edgeStyle];
    
        const css = `
            .player-container-scope video::cue {
                font-size: ${subtitleSettings.fontSize}% !important;
                background-color: rgba(0, 0, 0, ${subtitleSettings.backgroundOpacity / 100}) !important;
                text-shadow: ${edgeStyleCss} !important;
                color: #FFFFFF !important;
                font-weight: bold !important;
                white-space: pre-wrap !important;
            }
        `;
        
        styleElement.textContent = css;
    
    }, [subtitleSettings]);

    useEffect(() => {
        const fetchAndSetStreams = async () => {
            const fetchId = ++fetchIdRef.current;
            onStreamFetchStateChange(true);
            setIsBuffering(true);
            setSubtitles([]);
            setVttTracks([]);

            // Handle offline playback from downloads
            if (isOffline && downloadId) {
                try {
                    const { getDownloadedVideoURL } = await import('../services/apiService');
                    const offlineUrl = await getDownloadedVideoURL(downloadId);
                    if (offlineUrl) {
                        if (videoRef.current) {
                            videoRef.current.src = offlineUrl;
                            videoRef.current.load();
                            setIsBuffering(false);
                            onStreamFetchStateChange(false);
                        }
                        return;
                    }
                } catch (error) {
                    console.error('Failed to load offline video:', error);
                    setToast({ message: 'Failed to load offline video', type: 'error' });
                }
            }

            try {
                const data = await fetchStreamUrl(item, itemType, initialSeason, initialEpisode?.episode_number, selectedProvider || undefined, serverPreferences, selectedDub);
                
                if (fetchIdRef.current !== fetchId) return;

                onProviderSelected(data.provider);
                setProvider(data.provider);

                if (data.subtitles && data.subtitles.length > 0) {
                    setSubtitles(data.subtitles);
                }

                if (data.links && data.links.length > 0) {
                    data.links.sort((a, b) => {
                        const qualityA = parseInt(a.quality.match(/\d{3,4}/)?.[0] || '0');
                        const qualityB = parseInt(b.quality.match(/\d{3,4}/)?.[0] || '0');
                        return qualityA - qualityB; // Sort ascending for lowest quality first
                    });
                    
                    const lowestQualityStream = data.links[0];
                    setAvailableStreams(data.links);
                    setCurrentStream(lowestQualityStream);
                    if (onActiveStreamUrlChange) onActiveStreamUrlChange(lowestQualityStream.url);
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
                if (fetchIdRef.current === fetchId) {
                    onStreamFetchStateChange(false);
                }
            }
        };

        if (item) {
            if (isInitialLoadRef.current && initialStreamUrl) {
                isInitialLoadRef.current = false;
                const stream: StreamLink = { quality: t('auto'), url: initialStreamUrl };
                setAvailableStreams([stream]);
                setCurrentStream(stream);
                setProvider('unknown');
                if (onActiveStreamUrlChange) onActiveStreamUrlChange(initialStreamUrl);
                onStreamFetchStateChange(false);
            } else {
                fetchAndSetStreams();
            }
        }
    }, [item.id, itemType, initialSeason, initialEpisode?.id, selectedProvider, serverPreferences.join(), selectedDub]);
    
     useEffect(() => {
        let active = true;
        let createdUrls: string[] = [];

        const processSubtitles = async () => {
            const newTracks: { lang: string; url: string; label: string }[] = [];
            const processedLangs = new Set<string>();

            const baseLine = 85;
            const offsetPos = (subtitleSettings.verticalPosition || 0);
            const linePosition = Math.round(baseLine - offsetPos); 
            const finalLinePosition = Math.max(65, Math.min(90, linePosition));

            const timeOffset = subtitleSettings.timeOffset || 0;
            const srtTimestampLineRegex = /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g;


            for (const sub of subtitles) {
                if (processedLangs.has(sub.language)) {
                    console.warn(`Duplicate subtitle language skipped: ${sub.language}`);
                    continue;
                }
                try {
                    const res = await fetch(sub.url);
                    if (!res.ok) continue;

                    const buffer = await res.arrayBuffer();
                    const decoder = new TextDecoder('utf-8');
                    const srtText = decoder.decode(buffer).replace(/\uFFFD/g, '');

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
                    newTracks.push({ lang: sub.language, url: vttUrl, label: sub.display });
                    processedLangs.add(sub.language);
                } catch (e) {
                    console.error(`Failed to process subtitle: ${sub.display}`, e);
                }
            }
            if (active) {
                setVttTracks(newTracks);
            }
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
    }, [subtitles, subtitleSettings]);
    
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !video.textTracks) return;

        const handleTracksChange = () => {
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                if (track.language) {
                    const shouldShow = track.language === activeSubtitleLang;
                    if (track.mode !== (shouldShow ? 'showing' : 'hidden')) {
                         track.mode = shouldShow ? 'showing' : 'hidden';
                    }
                }
            }
        };

        handleTracksChange();
        const textTracks = video.textTracks;
        textTracks.addEventListener('addtrack', handleTracksChange);
        textTracks.addEventListener('change', handleTracksChange);

        return () => {
            textTracks.removeEventListener('addtrack', handleTracksChange);
            textTracks.removeEventListener('change', handleTracksChange);
        };
    }, [activeSubtitleLang]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !currentStream) return;
    
        const savedTime = shouldResetTime ? 0 : (video.currentTime > 0 ? video.currentTime : initialTime || 0);
        if (shouldResetTime) {
            setShouldResetTime(false); // Reset the flag after using it
        }
        const sourceUrl = currentStream.url;
    
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        setAvailableQualities([]);
        setCurrentQuality(-1);
        setAutoLevelIndex(-1);
    
        if (sourceUrl.includes('.m3u8')) {
            if (Hls.default.isSupported()) {
                const hlsConfig = {
                  lowLatencyMode: true,
                  maxBufferLength: 30,
                  maxMaxBufferLength: 60,
                  startLevel: -1, 
                  abrEwmaDefaultEstimate: 1000000,
                  fragLoadingMaxRetry: 5,
                  manifestLoadingMaxRetry: 3,
                  manifestLoadingRetryDelay: 500,
                  levelLoadingMaxRetry: 4,
                };
                const hls = new Hls.default(hlsConfig);
                hlsRef.current = hls;
                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
                
                hls.on(Hls.default.Events.MANIFEST_PARSED, (event, data) => {
                    setAvailableQualities(data.levels);
                    if (hls.startLevel !== -1) {
                        setAutoLevelIndex(hls.startLevel);
                    }
                    if (videoRef.current) {
                        videoRef.current.currentTime = savedTime;
                        videoRef.current.play().catch(e => {
                            console.log('Autoplay prevented', e);
                            const v = videoRef.current;
                            if (v) {
                                v.muted = true;
                                v.play().catch(() => setIsPlaying(false));
                            }
                        });
                    }
                });
                
                hls.on(Hls.default.Events.LEVEL_SWITCHED, (event, data) => {
                    setAutoLevelIndex(data.level);
                    setCurrentQuality(hls.autoLevelEnabled ? -1 : data.level);
                });

                hls.on(Hls.default.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.default.ErrorTypes.NETWORK_ERROR:
                                console.error('HLS.js: fatal network error, trying to recover', data);
                                hls.startLoad();
                                break;
                            case Hls.default.ErrorTypes.MEDIA_ERROR:
                                console.error('HLS.js: fatal media error, trying to recover', data);
                                hls.recoverMediaError();
                                break;
                            default:
                                console.error('HLS.js: unrecoverable fatal error', data);
                                hls.destroy();
                                setToast({ message: t('failedToLoadVideo'), type: "error" });
                                break;
                        }
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = sourceUrl;
                video.addEventListener('loadedmetadata', () => {
                    if (videoRef.current) {
                        videoRef.current.currentTime = savedTime;
                        videoRef.current.play().catch(e => {
                            console.log('Autoplay prevented on native HLS', e);
                            const v = videoRef.current;
                            if (v) {
                                v.muted = true;
                                v.play().catch(() => setIsPlaying(false));
                            }
                        });
                    }
                }, { once: true });
            }
        } else {
            video.src = sourceUrl;
            const attemptPlay = () => {
                if (videoRef.current) {
                    videoRef.current.currentTime = savedTime;
                    videoRef.current.play().catch(e => {
                        console.log('Autoplay prevented on standard video', e);
                        const v = videoRef.current;
                        if (v) {
                            v.muted = true;
                            v.play().catch(() => setIsPlaying(false));
                        }
                    });
                }
            };
            if (video.readyState >= 1) {
                attemptPlay();
            } else {
                video.addEventListener('loadedmetadata', attemptPlay, { once: true });
            }
        }
    
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
        };
    }, [currentStream, initialTime, setToast, t, shouldResetTime]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
             video.play().catch(e => {
                console.error("Play action failed.", e);
                setToast({ message: t('failedToLoadVideo'), type: "error" });
            });
        }
        else {
             video.pause();
        }
        resetControlsTimeout();
    }, [resetControlsTimeout, setToast, t]);

    const handleContainerClick = useCallback((e: React.MouseEvent) => {
        if(isLocked) return;
        const target = e.target as HTMLElement;
        if (target.closest('.controls-bar') || target.closest('.popover-content')) return;
        
        resetControlsTimeout();
        
        if (!showControls) {
            setShowControls(true);
        }

    }, [resetControlsTimeout, showControls, isLocked]);

    const showSeekAnimation = (forward: boolean) => {
        if (!playerContainerRef.current) return;
        if (seekIndicatorRef.current && seekIndicatorRef.current.el) {
            clearTimeout(seekIndicatorRef.current.timer);
        } else {
            const el = document.createElement('div');
            const label = document.createElement('span');
            el.appendChild(label);
            seekIndicatorRef.current = { el, icon: label, timer: -1 as any } as any;
        }
        const { el, icon } = seekIndicatorRef.current;
        el.className = `absolute top-1/2 -translate-y-1/2 ${forward ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'} w-64 h-64 bg-black/50 flex items-center justify-center text-white z-40 pointer-events-none`;
        (icon as HTMLElement).className = 'text-6xl font-extrabold drop-shadow-lg';
        (icon as HTMLElement).textContent = forward ? '+10' : '−10';

        // Slight upward nudge to avoid appearing a bit low on some devices
        (el as HTMLDivElement).style.top = '48%';

        if (!el.parentNode) playerContainerRef.current.appendChild(el);

        el.classList.remove('animate-double-tap');
        void el.offsetWidth;
        el.classList.add('animate-double-tap');

        seekIndicatorRef.current.timer = setTimeout(() => {
            if(el.parentNode) el.remove();
            seekIndicatorRef.current = null;
        }, 600);
    };

    const handleSeek = (forward: boolean) => {
        const video = videoRef.current;
        if (video) {
            video.currentTime += forward ? 10 : -10;
            showSeekAnimation(forward);
        }
        resetControlsTimeout();
    };

    const handleDoubleTap = (e: React.TouchEvent) => {
        if (isLocked) return;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const tapX = e.touches[0].clientX - rect.left;
        const width = rect.width;
        const now = new Date().getTime();
        if ((now - lastTap.current) < 400) {
            e.preventDefault();
            if (tapX < width / 3) handleSeek(false);
            else if (tapX > (width * 2) / 3) handleSeek(true);
            else togglePlay();
        }
        lastTap.current = now;
    };

    const handleProgressInteraction = useCallback((e: React.MouseEvent | React.TouchEvent, isDragging: boolean) => {
        if (!progressBarRef.current || !videoRef.current || duration === 0) return;
        
        const event = 'touches' in e ? e.touches[0] : e;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const width = rect.width;
        let newTime = (clickX / width) * duration;

        newTime = Math.max(0, Math.min(newTime, duration));

        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        if (!isDragging) {
             resetControlsTimeout();
        }
    }, [duration, resetControlsTimeout]);

    const handleProgressClick = useCallback((e: React.MouseEvent) => {
        handleProgressInteraction(e, false);
    }, [handleProgressInteraction]);

    const handleProgressDrag = useCallback((e: React.MouseEvent) => {
        if (e.buttons !== 1) return;
        handleProgressInteraction(e, true);
    }, [handleProgressInteraction]);

    const toggleFullscreen = useCallback(() => {
        const elem = playerContainerRef.current;
        if (!elem) return;
        if (!document.fullscreenElement) elem.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`));
        else document.exitFullscreen();
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (itemType === 'tv' && nextEpisode && duration > 0 && (duration - video.currentTime <= 15)) {
                if (!showNextEpisodeButton) {
                    setShowNextEpisodeButton(true);
                }
            }
        };
        const onDurationChange = () => setDuration(video.duration || 0);
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => {
             setIsBuffering(false);
             resetControlsTimeout();
        };
        const onProgress = () => {
            if (video.buffered.length > 0 && duration > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                setBuffered((bufferedEnd / duration) * 100);
                // Compute initial startup percent toward a small target buffer
                const initialBufferedSec = bufferedEnd;
                const percent = Math.max(0, Math.min(100, (initialBufferedSec / INITIAL_STARTUP_BUFFER_SECONDS) * 100));
                setStartupPercent(percent);
            }
        };
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('progress', onProgress);

        // One-time small-range fetch to estimate download speed at startup (only for direct MP4)
        if (!speedMeasuredRef.current && video.src && !video.src.includes('.m3u8')) {
            speedMeasuredRef.current = true;
            (async () => {
                try {
                    const controller = new AbortController();
                    const start = performance.now();
                    const resp = await fetch(video.src, { headers: { Range: 'bytes=0-262143' }, signal: controller.signal }); // 256KB
                    const end = performance.now();
                    if (resp.ok || resp.status === 206) {
                        const bytes = 262144;
                        const seconds = Math.max(0.001, (end - start) / 1000);
                        setDownloadSpeedKbps((bytes / 1024) / seconds);
                    }
                } catch {}
            })();
        }
        
        setIsPlaying(!video.paused);
        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
        setIsBuffering(video.readyState < 3 && !video.paused);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('progress', onProgress);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            onStreamFetchStateChange(false);
        };
    }, [resetControlsTimeout, onStreamFetchStateChange, duration, itemType, nextEpisode, showNextEpisodeButton]);

    useEffect(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);
    
    const handleQualityChange = (levelIndex: number) => {
        if (hlsRef.current) {
            if (levelIndex === -1) {
                hlsRef.current.currentLevel = -1;
            } else {
                hlsRef.current.nextLevel = levelIndex;
            }
            setCurrentQuality(levelIndex);
        }
        setActivePopover(null);
    };

    const handleStreamChange = (stream: StreamLink) => {
        if (stream.url !== currentStream?.url) {
            setCurrentStream(stream);
            if (onActiveStreamUrlChange) onActiveStreamUrlChange(stream.url);
        }
        setActivePopover(null);
    };

    const handleSubtitleChange = (lang: string | null) => {
        setActiveSubtitleLang(lang);
        setActivePopover(null);
    };

    return (
        <div ref={playerContainerRef} className={`player-container-scope relative w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-none ${!showControls ? 'c-controls-hidden' : ''}`} onClick={handleContainerClick} onTouchStart={handleDoubleTap}>
            <video
                ref={combinedRef}
                className={`w-full h-full object-${fitMode}`}
                playsInline
                autoPlay
                muted={false}
                poster={item.backdrop_path ? `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}` : ''}
                preload="auto"
            >
             {vttTracks.map(track => (
                    <track
                        key={track.lang}
                        kind="subtitles"
                        srcLang={track.lang}
                        src={track.url}
                        label={track.label}
                    />
                ))}
            </video>

            {isBuffering && currentTime < 1 && item.backdrop_path && (
                <div className="absolute inset-0 bg-black flex items-center justify-center pointer-events-none">
                    <img
                        src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}`}
                        alt="Loading poster"
                        className="w-full h-full object-contain opacity-80"
                    />
                </div>
            )}


            {isBuffering && (
                <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
                    <div className="w-12 h-12 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
                    <div className="text-white text-sm font-semibold drop-shadow">
                        {startupPercent.toFixed(0)}%
                    </div>
                    {downloadSpeedKbps !== null && (
                        <div className="text-white/80 text-xs">{Math.max(0, downloadSpeedKbps).toFixed(0)} KB/s</div>
                    )}
                </div>
            )}
            
            {isLocked ? (
                <div className="absolute inset-0 z-40 flex items-center justify-center animate-fade-in" onClick={() => setIsLocked(false)}>
                    <button className="flex flex-col items-center gap-2 text-white bg-black/50 p-4 rounded-full">
                        <i className="fa-solid fa-lock text-3xl"></i>
                    </button>
                </div>
            ) : (
                <Controls
                    showControls={showControls}
                    isPlaying={isPlaying}
                    itemType={itemType}
                    currentTime={currentTime}
                    duration={duration}
                    isFullscreen={isFullscreen}
                    isBuffering={isBuffering}
                    togglePlay={togglePlay}
                    handleSeek={handleSeek}
                    handleProgressClick={handleProgressClick}
                    handleProgressDrag={handleProgressDrag}
                    toggleFullscreen={toggleFullscreen}
                    onLock={() => setIsLocked(true)}
                    activePopover={activePopover}
                    setActivePopover={setActivePopover}
                    navigate={navigate}
                    t={t}
                    item={item}
                    episode={initialEpisode}
                    season={initialSeason}
                    buffered={buffered}
                    progressBarRef={progressBarRef}
                    nextEpisode={nextEpisode}
                    showNextEpisodeButton={showNextEpisodeButton}
                    handlePlayNext={handlePlayNext}
                    // Popover data
                    playbackRate={playbackRate}
                    setPlaybackRate={setPlaybackRate}
                    videoRef={videoRef}
                    availableQualities={availableQualities}
                    currentQuality={currentQuality}
                    autoLevelIndex={autoLevelIndex}
                    handleQualityChange={handleQualityChange}
                    vttTracks={vttTracks}
                    activeSubtitleLang={activeSubtitleLang}
                    handleSubtitleChange={handleSubtitleChange}
                    currentStream={currentStream}
                    fitMode={fitMode}
                    setFitMode={setFitMode}
                    availableStreams={availableStreams}
                    handleStreamChange={handleStreamChange}
                />
            )}
        </div>
    );
};

const Controls: React.FC<any> = ({
    showControls, isPlaying, itemType, currentTime, duration, isFullscreen, isBuffering,
    togglePlay, handleSeek, toggleFullscreen, onLock,
    activePopover, setActivePopover, navigate, t, item, episode, season, progressBarRef, buffered,
    nextEpisode, handlePlayNext,
    playbackRate, setPlaybackRate, videoRef, availableQualities, currentQuality, autoLevelIndex,
    handleQualityChange, vttTracks, activeSubtitleLang, handleSubtitleChange,
    fitMode, setFitMode,
    availableStreams, handleStreamChange, currentStream
}) => {
    
    const handleProgressInteraction = (e: React.MouseEvent | React.TouchEvent, isDragging: boolean) => {
        if (!progressBarRef.current || !videoRef.current || duration === 0) return;
        
        const event = 'touches' in e ? e.touches[0] : e;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const width = rect.width;
        let newTime = (clickX / width) * duration;

        newTime = Math.max(0, Math.min(newTime, duration));

        videoRef.current.currentTime = newTime;
    };

    const handleProgressClick = (e: React.MouseEvent) => {
        handleProgressInteraction(e, false);
    };

    const handleProgressDrag = (e: React.MouseEvent) => {
        if (e.buttons !== 1) return;
        handleProgressInteraction(e, true);
    };
    
    const handlePopoverToggle = (popoverName: 'quality' | 'speed' | 'language') => {
        setActivePopover((p: any) => p === popoverName ? null : popoverName);
    };

    const sortedQualities = useMemo(() => {
        return [...availableQualities]
            .map((level, index) => ({ ...level, originalIndex: index }))
            .sort((a, b) => b.height - a.height);
    }, [availableQualities]);

    const hasHlsQualities = sortedQualities && sortedQualities.length > 0;

    const qualityButtonText = useMemo(() => {
        if (hasHlsQualities) {
            if (currentQuality === -1) { // Auto
                const level = availableQualities[autoLevelIndex];
                return level ? `${level.height}P` : t('auto');
            }
            const level = availableQualities[currentQuality];
            return level ? `${level.height}P` : t('quality');
        }
        return currentStream?.quality || t('quality');
    }, [hasHlsQualities, currentQuality, autoLevelIndex, availableQualities, currentStream, t]);
    
    return (
        <div className={`absolute inset-0 text-white controls-bar pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/70"></div>
            
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-auto">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 text-xl"><Icons.BackIcon className="w-8 h-8" /></button>
                    <div>
                        <h2 className="text-lg font-bold truncate max-w-[calc(100vw-300px)]">{`${item.title || item.name} ${episode ? ` - S${season} E${episode.episode_number}` : ''}`}</h2>
                    </div>
                </div>
                <div className="flex items-center gap-x-6 text-sm">
                    <button className="flex flex-col items-center gap-1"><i className="fa-solid fa-question-circle text-xl"></i><span className="text-xs">{t('help')}</span></button>
                    <button className="flex flex-col items-center gap-1"><i className="fa-solid fa-gear text-xl"></i><span className="text-xs">{t('setting')}</span></button>
                </div>
            </div>

            {/* Side Lock Button */}
            {isFullscreen && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto">
                    <button onClick={onLock} className="flex flex-col items-center gap-2 text-white p-3 rounded-xl transition-colors hover:bg-black/20">
                        <i className="fa-solid fa-unlock text-xl"></i>
                        <span className="text-xs font-semibold">{t('tapToLock')}</span>
                    </button>
                </div>
            )}

            {/* Center Controls (only in fullscreen) */}
            {isFullscreen && (
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center pointer-events-auto ${isFullscreen ? 'gap-x-16' : 'gap-x-12'}`}>
                    {!isBuffering && (
                        <>
                            <button onClick={() => handleSeek(false)}>
                                <Icons.RewindIcon className={`${isFullscreen ? 'w-12 h-12' : 'w-10 h-10'} text-white/90 hover:text-white transition-colors`} />
                            </button>
                            <button onClick={togglePlay} className="transform transition-transform">
                                {isPlaying ? 
                                    <Icons.PauseIcon className={`${isFullscreen ? 'w-16 h-16' : 'w-14 h-14'}`} /> : 
                                    <Icons.PlayIcon className={`${isFullscreen ? 'w-16 h-16' : 'w-14 h-14'}`} />}
                            </button>
                            <button onClick={() => handleSeek(true)}>
                                <Icons.ForwardIcon className={`${isFullscreen ? 'w-12 h-12' : 'w-10 h-10'} text-white/90 hover:text-white transition-colors`} />
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Bottom Section */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
                 <div className="flex items-center gap-x-4">
                    <span className="font-mono text-sm">{formatTime(currentTime)}</span>
                     <div
                        ref={progressBarRef}
                        onClick={handleProgressClick}
                        onMouseMove={handleProgressDrag}
                        className="w-full flex items-center cursor-pointer group h-4"
                    >
                        <div className="relative w-full bg-white/30 rounded-full transition-all duration-200 h-1 group-hover:h-1.5">
                            <div className="absolute h-full bg-white/50 rounded-full" style={{ width: `${buffered}%` }} />
                            <div className="absolute h-full bg-[var(--primary)] rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }} />
                            <div
                                className="absolute bg-[var(--primary)] rounded-full -translate-x-1/2 -translate-y-[5px] transition-transform duration-200 z-10 w-3.5 h-3.5 scale-0 group-hover:scale-100"
                                style={{ left: `${(currentTime / duration) * 100}%` }}
                            />
                        </div>
                    </div>
                    <span className="font-mono text-sm">{formatTime(duration)}</span>
                 </div>

                 <div className="flex items-center justify-between gap-x-2 mt-2">
                    <div className="flex items-center gap-x-4">
                        <button onClick={togglePlay} className={`w-8 text-center ${isFullscreen ? 'text-2xl' : 'text-xl'}`}>{isPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play"></i>}</button>
                        {nextEpisode && <button onClick={handlePlayNext} className={`w-8 text-center ${isFullscreen ? 'text-2xl' : 'text-xl'}`}><i className="fa-solid fa-forward-step"></i></button>}
                    </div>

                    {isFullscreen ? (
                        <div className="flex items-center gap-x-4 text-sm font-semibold">
                            <button onClick={() => setFitMode((f: string) => f === 'contain' ? 'cover' : 'contain')} className="flex items-center gap-2"><i className="fa-solid fa-expand text-lg"></i> {t('fit')}</button>
                            <button onClick={() => handlePopoverToggle('language')} className="flex items-center gap-2 relative"><Icons.LanguageIcon className="w-5 h-5" /> {t('language')}
                                 {activePopover === 'language' && (
                                    <Popover onClose={() => setActivePopover(null)}>
                                        <button onClick={() => handleSubtitleChange(null)} className={!activeSubtitleLang ? 'bg-white/20' : ''}>{t('off')}</button>
                                        {vttTracks.map((sub: any) => <button key={sub.lang} onClick={() => handleSubtitleChange(sub.lang)} className={activeSubtitleLang === sub.lang ? 'bg-white/20' : ''}>{sub.label}</button>)}
                                    </Popover>
                                 )}
                            </button>
                            <button onClick={() => handlePopoverToggle('speed')} className="w-8 text-center relative">{playbackRate}x
                                {activePopover === 'speed' && (
                                     <Popover onClose={() => setActivePopover(null)}>
                                        {[0.5, 1, 1.5, 2].map(rate => <button key={rate} onClick={() => { if (videoRef.current) videoRef.current.playbackRate = rate; setPlaybackRate(rate); setActivePopover(null); }} className={playbackRate === rate ? 'bg-white/20' : ''}>{rate}x</button>)}
                                     </Popover>
                                )}
                            </button>
                            <button onClick={() => handlePopoverToggle('quality')} className="w-16 text-center relative" aria-label={t('quality')}>
                                <div className="flex items-center justify-center">
                                    <Icons.QualityIcon className="w-5 h-5" />
                                </div>
                                 {activePopover === 'quality' && (
                                     <Popover onClose={() => setActivePopover(null)}>
                                        {hasHlsQualities ? (
                                            <>
                                                <button onClick={() => handleQualityChange(-1)} className={currentQuality === -1 ? 'bg-white/20' : ''}>{t('auto')}</button>
                                                {sortedQualities.map((level: any) => <button key={level.originalIndex} onClick={() => handleQualityChange(level.originalIndex)} className={currentQuality === level.originalIndex ? 'bg-white/20' : ''}>{level.height}p</button>)}
                                            </>
                                        ) : (
                                            availableStreams.length > 1 ? availableStreams.map((stream: StreamLink) => (
                                                <button key={stream.url} onClick={() => handleStreamChange(stream)} className={currentStream?.url === stream.url ? 'bg-white/20' : ''}>
                                                    {stream.quality}
                                                </button>
                                            )) : <button disabled className="cursor-not-allowed opacity-50">{t('auto')}</button>
                                        )}
                                     </Popover>
                                 )}
                            </button>
                            <button onClick={toggleFullscreen} className="text-xl w-8 text-center">
                                <Icons.ExitFullscreenIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                         <div className="flex items-center gap-x-2">
                            <button onClick={toggleFullscreen} className="text-xl w-8 text-center">
                                <Icons.EnterFullscreenIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const Popover: React.FC<{onClose: ()=>void, children: React.ReactNode}> = ({onClose, children}) => {
    return (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md rounded-lg p-2 flex flex-col gap-1 w-32 popover-content">
            {children}
        </div>
    )
}

export default VideoPlayer;