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
    const { t, language: userLanguage } = useTranslation();

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
        backgroundOpacity: 0,
        edgeStyle: 'outline',
        verticalPosition: 0,
        timeOffset: 0,
    };

    const defaultVideoFilters: VideoFilters = {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        sharpness: 0,
        hue: 0,
        gamma: 1.0,
        enabled: false,
    };
    
    const [isLocked, setIsLocked] = useState(false);
    const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => getScreenSpecificData('subtitleSettings', defaultSubtitleSettings));
    const [videoFilters, setVideoFilters] = useState<VideoFilters>(() => getScreenSpecificData('videoFilters', defaultVideoFilters));

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

    // Live loading metrics
    const [livePercent, setLivePercent] = useState(0);
    const [liveSpeed, setLiveSpeed] = useState(0); // in KB/s
    const lastProgressData = useRef({ lastLoaded: 0, lastTime: Date.now() });

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
    const [activeSubtitleLang, setActiveSubtitleLang] = useState<string | null>(userLanguage === 'ar' ? 'ar' : null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [selectedDub, setSelectedDub] = useState<'ar' | 'fr' | null>(null);
    const [shouldResetTime, setShouldResetTime] = useState(false);
    const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);

    const isPopoverOpen = activePopover !== null;
    const isPopoverOpenRef = useRef(isPopoverOpen);
    isPopoverOpenRef.current = isPopoverOpen;

    // Proxy helpers to mitigate mid-playback stalls for direct MP4 links
    const PROXY_PREFIX = (typeof window !== 'undefined' && location?.hostname === 'localhost') ? '' : 'https://prox-q3zt.onrender.com';
    const isProxiedUrl = useCallback((url: string) => {
        try {
            return url.includes('/proxy?url=');
        } catch {
            return false;
        }
    }, []);
    const toProxiedUrl = useCallback((url: string) => {
        if (!PROXY_PREFIX) return `/proxy?url=${encodeURIComponent(url)}`;
        return `${PROXY_PREFIX}/proxy?url=${encodeURIComponent(url)}`;
    }, [PROXY_PREFIX]);

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

    const resetVideoFilters = useCallback(() => {
        setVideoFilters(defaultVideoFilters);
        setScreenSpecificData('videoFilters', defaultVideoFilters);
    }, [setScreenSpecificData]);

    const updateVideoFilters = useCallback((updater: (prev: VideoFilters) => VideoFilters) => {
        setVideoFilters(prev => {
            const next = updater(prev);
            setScreenSpecificData('videoFilters', next);
            return next;
        });
    }, [setScreenSpecificData]);

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

    // Apply video filters
    useEffect(() => {
        if (!videoRef.current) return;
        
        const video = videoRef.current;
        
        if (videoFilters.enabled) {
            // Apply CSS filters
            const filterString = [
                `brightness(${100 + videoFilters.brightness}%)`,
                `contrast(${100 + videoFilters.contrast}%)`,
                `saturate(${100 + videoFilters.saturation}%)`,
                `hue-rotate(${videoFilters.hue}deg)`,
                `contrast(${videoFilters.gamma})`,
            ].join(' ');
            
            video.style.filter = filterString;
            
            // Apply sharpness using CSS backdrop-filter (limited support)
            if (videoFilters.sharpness > 0) {
                video.style.backdropFilter = `contrast(${100 + videoFilters.sharpness}%)`;
            }
        } else {
            // Reset filters
            video.style.filter = '';
            video.style.backdropFilter = '';
        }
    }, [videoFilters]);

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

            // التحقق من وجود ترجمة عربية أصلية
            const hasArabicSub = processedLangs.has('ar');
            
            // إذا كانت اللغة المحددة هي العربية ولا توجد ترجمة عربية أصلية، قم بإنشاء ترجمة تلقائية
            if (userLanguage === 'ar' && !hasArabicSub && subtitles.length > 0) {
                // ترتيب أولوية اللغات للترجمة: إنجليزية > فرنسية > أي لغة أخرى
                const languagePriority = ['en', 'fr', 'es', 'de', 'it'];
                let sourceSub = null;
                
                // البحث عن أفضل ترجمة متاحة للترجمة منها
                for (const lang of languagePriority) {
                    sourceSub = subtitles.find(s => s.language === lang);
                    if (sourceSub) break;
                }
                
                // إذا لم توجد ترجمة من اللغات المفضلة، استخدم أول ترجمة متاحة
                if (!sourceSub && subtitles.length > 0) {
                    sourceSub = subtitles[0];
                }
                
                if (sourceSub) {
                    if (active) setIsTranslating(true);
                    try {
                        console.log(`Attempting to translate subtitles from ${sourceSub.language} to Arabic...`);
                        const sourceRes = await fetch(sourceSub.url);
                        if (sourceRes.ok) {
                            const sourceSrt = await sourceRes.text();
                            // ترجمة الترجمة المختارة إلى العربية
                            const translatedSrt = await translateSrtViaGoogle(sourceSrt, 'ar');
                            if (translatedSrt && active) {
                                const vttUrl = processSrtToVtt(translatedSrt);
                                const aiLangCode = 'ar-ai';
                                newTracks.push({ 
                                    lang: aiLangCode, 
                                    url: vttUrl, 
                                    label: t('arabicAi') + ` (${t('from')} ${sourceSub.display || sourceSub.language})`
                                });
                                console.log("Arabic AI translation created successfully");
                                // اختر الترجمة العربية المترجمة تلقائياً تلقائياً
                                setActiveSubtitleLang(aiLangCode);
                            }
                        }
                    } catch (e) {
                        console.error("Error during AI subtitle translation process", e);
                    } finally {
                        if (active) setIsTranslating(false);
                    }
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
    }, [subtitles, subtitleSettings, t, userLanguage]);
    
    // تحسين اختيار الترجمة العربية المترجمة تلقائياً
    useEffect(() => {
        if (userLanguage === 'ar' && vttTracks.length > 0) {
            // البحث عن الترجمة العربية الأصلية أولاً
            const arabicTrack = vttTracks.find(track => track.lang === 'ar');
            if (arabicTrack) {
                setActiveSubtitleLang('ar');
            } else {
                // إذا لم توجد ترجمة عربية أصلية، اختر الترجمة العربية المترجمة تلقائياً
                const arabicAiTrack = vttTracks.find(track => track.lang === 'ar-ai');
                if (arabicAiTrack) {
                    setActiveSubtitleLang('ar-ai');
                }
            }
        }
    }, [vttTracks, userLanguage]);
    
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

                // Listen for fragment buffering to calculate live speed for HLS streams
                hls.on(Hls.default.Events.FRAG_BUFFERED, (event, data) => {
                    const stats = data.stats as any;
                    if (stats && typeof stats.tload === 'number' && typeof stats.tfirst === 'number') {
                        const durationMs = stats.tload - stats.tfirst;
                        if (durationMs > 0) {
                            const speedKbps = (stats.loaded / 1024) / (durationMs / 1000);
                            setLiveSpeed(speedKbps);
                        }
                    }
                });
                
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

            // If the direct file stalls mid-playback, switch to proxied URL to improve stability
            let stallTimer: ReturnType<typeof setTimeout> | null = null;
            const handleWaiting = () => {
                if (stallTimer) clearTimeout(stallTimer);
                stallTimer = setTimeout(() => {
                    // Only switch if not already proxied and stream still the same
                    const current = currentStream;
                    if (current && !isProxiedUrl(current.url)) {
                        const proxied = { ...current, url: toProxiedUrl(current.url) };
                        setCurrentStream(proxied);
                    }
                }, 8000); // 8s of continuous waiting considered a stall
            };
            const handlePlayingClear = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };
            const handleErrorFallback = () => {
                const current = currentStream;
                if (current && !isProxiedUrl(current.url)) {
                    const proxied = { ...current, url: toProxiedUrl(current.url) };
                    setCurrentStream(proxied);
                }
            };
            video.addEventListener('waiting', handleWaiting);
            video.addEventListener('playing', handlePlayingClear);
            video.addEventListener('stalled', handleWaiting);
            video.addEventListener('error', handleErrorFallback, { once: true });

            // Cleanup listeners
            return () => {
                if (stallTimer) clearTimeout(stallTimer);
                video.removeEventListener('waiting', handleWaiting);
                video.removeEventListener('playing', handlePlayingClear);
                video.removeEventListener('stalled', handleWaiting);
                video.removeEventListener('error', handleErrorFallback as any);
            };
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
                
                // Calculate live percentage of total video buffered
                const percent = (bufferedEnd / duration) * 100;
                setLivePercent(percent);

                // Calculate live speed for non-HLS streams (fallback using provided logic)
                if (!hlsRef.current) {
                    const now = Date.now();
                    const { lastLoaded, lastTime } = lastProgressData.current;
                    
                    const loaded = bufferedEnd * (video.videoWidth * video.videoHeight ? 250 : 1000); 

                    const elapsed = (now - lastTime) / 1000;
                    const diff = loaded - lastLoaded;

                    if (elapsed > 0.5 && diff > 0) { // Update roughly every half-second
                        const speed = (diff / 1024 / elapsed);
                        setLiveSpeed(speed);
                        lastProgressData.current = { lastLoaded: loaded, lastTime: now };
                    }
                }
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
                <div id="loader" className="absolute inset-0 flex flex-col justify-center items-center text-white z-20 pointer-events-none" style={{fontFamily: 'sans-serif'}}>
                    <div className="w-[70px] h-[70px] border-[6px] border-solid border-[rgba(255,255,255,0.2)] border-t-white rounded-full animate-spin mb-2.5"></div>
                    <div id="percent" className="text-lg my-[3px]">{livePercent.toFixed(1)}%</div>
                    <div id="speed" className="text-sm opacity-70">{liveSpeed > 0 ? `${liveSpeed.toFixed(1)} KB/s` : ''}</div>
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
                    isTranslating={isTranslating}
                    subtitleSettings={subtitleSettings}
                    onUpdateSubtitleSettings={(updater: (prev: SubtitleSettings) => SubtitleSettings) => {
                        setSubtitleSettings(prev => {
                            const next = updater(prev);
                            setScreenSpecificData('subtitleSettings', next);
                            return next;
                        });
                    }}
                    videoFilters={videoFilters}
                    onUpdateVideoFilters={updateVideoFilters}
                    onResetVideoFilters={resetVideoFilters}
                />
            )}
        </div>
    );
};

const Controls: React.FC<any> = ({
    showControls, isPlaying, itemType, currentTime, duration, isFullscreen, isBuffering,
    togglePlay, handleSeek, toggleFullscreen, onLock,
    activePopover, setActivePopover, navigate, t, item, episode, season, progressBarRef, buffered,
    nextEpisode, showNextEpisodeButton, handlePlayNext,
    playbackRate, setPlaybackRate, videoRef, availableQualities, currentQuality, autoLevelIndex,
    handleQualityChange, vttTracks, activeSubtitleLang, handleSubtitleChange,
    fitMode, setFitMode,
    availableStreams, handleStreamChange, currentStream, isTranslating,
    subtitleSettings, onUpdateSubtitleSettings, videoFilters, onUpdateVideoFilters, onResetVideoFilters
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
            
            {showNextEpisodeButton && (
                <div className="absolute bottom-28 right-4 z-20 pointer-events-auto animate-slide-in-from-right">
                    <button
                        onClick={handlePlayNext}
                        className="relative w-40 h-12 bg-black/70 backdrop-blur-md rounded-lg overflow-hidden flex items-center justify-center text-white font-semibold text-sm btn-press"
                    >
                        <span>{t('nextEpisode')}</span>
                        <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full">
                            <div className="h-full bg-white animate-fill-progress"></div>
                        </div>
                    </button>
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
                            </button>
                            {activePopover === 'language' && (
                                <SideSheet onClose={() => setActivePopover(null)} title={t('language')}>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold opacity-80">{t('subtitles', { defaultValue: 'Subtitles' })}</h4>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => handleSubtitleChange(null)} className={`text-left px-3 py-2 rounded-md ${!activeSubtitleLang ? 'bg-white/10' : 'hover:bg-white/5'}`}>{t('off')}</button>
                                            {vttTracks.map((sub: any) => (
                                                <button key={sub.lang} onClick={() => handleSubtitleChange(sub.lang)} className={`text-left px-3 py-2 rounded-md ${activeSubtitleLang === sub.lang ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                                    {sub.label}
                                                </button>
                                            ))}
                                            {isTranslating && <div className="text-center text-xs p-2 text-gray-300 animate-pulse">{t('translating', { defaultValue: 'Translating...'})}</div>}
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <h4 className="text-sm font-semibold opacity-80">{t('subtitleSettings', { defaultValue: 'Subtitle Settings' })}</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex items-center justify-between text-xs opacity-80 mb-1"><span>{t('fontSize', { defaultValue: 'Font Size' })}</span><span>{subtitleSettings.fontSize}%</span></div>
                                                <input type="range" min={50} max={200} value={subtitleSettings.fontSize} onChange={(e) => onUpdateSubtitleSettings((prev: any) => ({ ...prev, fontSize: Number(e.target.value) }))} className="w-full" />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between text-xs opacity-80 mb-1"><span>{t('backgroundOpacity', { defaultValue: 'Background Opacity' })}</span><span>{subtitleSettings.backgroundOpacity}%</span></div>
                                                <input type="range" min={0} max={100} value={subtitleSettings.backgroundOpacity} onChange={(e) => onUpdateSubtitleSettings((prev: any) => ({ ...prev, backgroundOpacity: Number(e.target.value) }))} className="w-full" />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between text-xs opacity-80 mb-1"><span>{t('edgeStyle', { defaultValue: 'Edge Style' })}</span></div>
                                                <select value={subtitleSettings.edgeStyle} onChange={(e) => onUpdateSubtitleSettings((prev: any) => ({ ...prev, edgeStyle: e.target.value }))} className="w-full bg-white/10 rounded-md px-3 py-2">
                                                    <option value="none">{t('none', { defaultValue: 'None' })}</option>
                                                    <option value="drop-shadow">{t('dropShadow', { defaultValue: 'Drop Shadow' })}</option>
                                                    <option value="outline">{t('outline', { defaultValue: 'Outline' })}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between text-xs opacity-80 mb-1"><span>{t('verticalPosition', { defaultValue: 'Vertical Position' })}</span><span>{subtitleSettings.verticalPosition}</span></div>
                                                <input type="range" min={-20} max={20} value={subtitleSettings.verticalPosition} onChange={(e) => onUpdateSubtitleSettings((prev: any) => ({ ...prev, verticalPosition: Number(e.target.value) }))} className="w-full" />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between text-xs opacity-80 mb-1"><span>{t('timeOffset', { defaultValue: 'Time Offset (s)' })}</span><span>{subtitleSettings.timeOffset}s</span></div>
                                                <input type="range" min={-5} max={5} step={0.5} value={subtitleSettings.timeOffset} onChange={(e) => onUpdateSubtitleSettings((prev: any) => ({ ...prev, timeOffset: Number(e.target.value) }))} className="w-full" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Video Filters */}
                                    <div className="mt-6 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold opacity-80">{t('videoFilters', { defaultValue: 'Video Filters' })}</h4>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => onUpdateVideoFilters(prev => ({ ...prev, enabled: !prev.enabled }))}
                                                    className={`px-3 py-1 rounded text-xs ${videoFilters.enabled ? 'bg-green-600' : 'bg-gray-600'}`}
                                                >
                                                    {videoFilters.enabled ? t('enableFilters', { defaultValue: 'ON' }) : t('enableFilters', { defaultValue: 'OFF' })}
                                                </button>
                                                <button 
                                                    onClick={onResetVideoFilters}
                                                    className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700"
                                                >
                                                    {t('resetFilters', { defaultValue: 'Reset' })}
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {videoFilters.enabled && (
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex items-center justify-between text-xs opacity-80 mb-1">
                                                        <span>{t('brightness', { defaultValue: 'Brightness' })}</span>
                                                        <span>{videoFilters.brightness}</span>
                                                    </div>
                                                    <input 
                                                        type="range" 
                                                        min={-100} 
                                                        max={100} 
                                                        value={videoFilters.brightness} 
                                                        onChange={(e) => onUpdateVideoFilters(prev => ({ ...prev, brightness: Number(e.target.value) }))} 
                                                        className="w-full" 
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <div className="flex items-center justify-between text-xs opacity-80 mb-1">
                                                        <span>{t('contrast', { defaultValue: 'Contrast' })}</span>
                                                        <span>{videoFilters.contrast}</span>
                                                    </div>
                                                    <input 
                                                        type="range" 
                                                        min={-100} 
                                                        max={100} 
                                                        value={videoFilters.contrast} 
                                                        onChange={(e) => onUpdateVideoFilters(prev => ({ ...prev, contrast: Number(e.target.value) }))} 
                                                        className="w-full" 
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <div className="flex items-center justify-between text-xs opacity-80 mb-1">
                                                        <span>{t('saturation', { defaultValue: 'Saturation' })}</span>
                                                        <span>{videoFilters.saturation}</span>
                                                    </div>
                                                    <input 
                                                        type="range" 
                                                        min={-100} 
                                                        max={100} 
                                                        value={videoFilters.saturation} 
                                                        onChange={(e) => onUpdateVideoFilters(prev => ({ ...prev, saturation: Number(e.target.value) }))} 
                                                        className="w-full" 
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <div className="flex items-center justify-between text-xs opacity-80 mb-1">
                                                        <span>{t('sharpness', { defaultValue: 'Sharpness' })}</span>
                                                        <span>{videoFilters.sharpness}</span>
                                                    </div>
                                                    <input 
                                                        type="range" 
                                                        min={0} 
                                                        max={100} 
                                                        value={videoFilters.sharpness} 
                                                        onChange={(e) => onUpdateVideoFilters(prev => ({ ...prev, sharpness: Number(e.target.value) }))} 
                                                        className="w-full" 
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <div className="flex items-center justify-between text-xs opacity-80 mb-1">
                                                        <span>{t('hue', { defaultValue: 'Hue' })}</span>
                                                        <span>{videoFilters.hue}</span>
                                                    </div>
                                                    <input 
                                                        type="range" 
                                                        min={-180} 
                                                        max={180} 
                                                        value={videoFilters.hue} 
                                                        onChange={(e) => onUpdateVideoFilters(prev => ({ ...prev, hue: Number(e.target.value) }))} 
                                                        className="w-full" 
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <div className="flex items-center justify-between text-xs opacity-80 mb-1">
                                                        <span>{t('gamma', { defaultValue: 'Gamma' })}</span>
                                                        <span>{videoFilters.gamma.toFixed(1)}</span>
                                                    </div>
                                                    <input 
                                                        type="range" 
                                                        min={0.1} 
                                                        max={2.0} 
                                                        step={0.1}
                                                        value={videoFilters.gamma} 
                                                        onChange={(e) => onUpdateVideoFilters(prev => ({ ...prev, gamma: Number(e.target.value) }))} 
                                                        className="w-full" 
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </SideSheet>
                            )}
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
                            </button>
                            {activePopover === 'quality' && (
                                <SideSheet onClose={() => setActivePopover(null)} title={t('quality')}>
                                    <div className="space-y-2">
                                        {hasHlsQualities ? (
                                            <>
                                                <h4 className="text-sm font-semibold opacity-80">{t('mode', { defaultValue: 'Mode' })}</h4>
                                                <div className="flex flex-col gap-1">
                                                    <button onClick={() => handleQualityChange(-1)} className={`text-left px-3 py-2 rounded-md ${currentQuality === -1 ? 'bg-white/10' : 'hover:bg-white/5'}`}>{t('auto')}</button>
                                                </div>
                                                <h4 className="text-sm font-semibold opacity-80 mt-3">{t('qualities', { defaultValue: 'Qualities' })}</h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {sortedQualities.map((level: any) => (
                                                        <button key={level.originalIndex} onClick={() => handleQualityChange(level.originalIndex)} className={`text-left px-3 py-2 rounded-md ${currentQuality === level.originalIndex ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                                            {level.height}p
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <h4 className="text-sm font-semibold opacity-80">{t('streams', { defaultValue: 'Streams' })}</h4>
                                                <div className="flex flex-col gap-1">
                                                    {availableStreams.length > 0 ? (
                                                        availableStreams.map((stream: StreamLink) => (
                                                            <button key={stream.url} onClick={() => handleStreamChange(stream)} className={`text-left px-3 py-2 rounded-md ${currentStream?.url === stream.url ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                                                {stream.quality}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <button disabled className="cursor-not-allowed opacity-50 text-left px-3 py-2 rounded-md">{t('auto')}</button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </SideSheet>
                            )}
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

const SideSheet: React.FC<{ onClose: () => void, title: string, children: React.ReactNode }> = ({ onClose, title, children }) => {
    const [closing, setClosing] = React.useState(false);
    const requestClose = () => {
        if (closing) return;
        setClosing(true);
        setTimeout(() => onClose(), 400);
    };
    return (
        <div className="fixed inset-0 z-50 pointer-events-auto">
            <div className="absolute inset-0 bg-black/50" onClick={requestClose}></div>
            <div className={`absolute right-0 top-0 h-full w-1/2 max-w-[420px] min-w-[280px] bg-black/90 backdrop-blur-md border-l border-white/10 shadow-2xl ${closing ? 'animate-slide-out-right' : 'animate-slide-in-from-right'}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h3 className="font-semibold">{title}</h3>
                    <button onClick={requestClose} className="text-xl"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="p-4 overflow-y-auto h-[calc(100%-52px)]">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
