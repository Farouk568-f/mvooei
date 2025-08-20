

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import * as Hls from 'hls.js';
import { ScheduleItem, LiveChannel } from '../types';
import { getScheduleForChannel, CHANNELS } from '../services/aiScheduleService';
import { fetchStreamUrl } from '../services/apiService';
import { useTranslation } from '../contexts/LanguageContext';
import { useProfile } from '../contexts/ProfileContext';
import { IMAGE_BASE_URL, BACKDROP_SIZE } from '../contexts/constants';

const LivePlayer: React.FC<{ streamUrl: string | null; isMuted: boolean, seekTime: number }> = ({ streamUrl, isMuted, seekTime }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls.default | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;
        
        const isM3U8 = streamUrl.includes('.m3u8');

        if (isM3U8 && Hls.default.isSupported()) {
            if (hlsRef.current) hlsRef.current.destroy();
            const hlsConfig = {
                lowLatencyMode: true,
                backBufferLength: 90,
                startLevel: 0, // Fast start
                manifestLoadingMaxRetry: 4,
                manifestLoadingRetryDelay: 500,
                fragLoadingMaxRetry: 5,
                fragLoadingRetryDelay: 500,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 5,
            };
            const hls = new Hls.default(hlsConfig);
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.default.Events.MANIFEST_PARSED, () => {
                video.currentTime = seekTime;
                video.play().catch(e => console.error("Autoplay failed", e));
            });
        } else {
            video.src = streamUrl;
            const handleCanPlay = () => {
                video.currentTime = seekTime;
                video.play().catch(e => console.error("Autoplay failed", e));
                video.removeEventListener('canplay', handleCanPlay);
            };
            video.addEventListener('canplay', handleCanPlay);
        }

        return () => hlsRef.current?.destroy();

    }, [streamUrl, seekTime]);
    
    useEffect(() => {
        if(videoRef.current) videoRef.current.muted = isMuted;
    }, [isMuted]);

    return <video ref={videoRef} className="w-full h-full object-contain" playsInline />;
};

const ChannelGuide: React.FC<{
  isOpen: boolean;
  channels: LiveChannel[];
  activeChannelId: string;
  onChannelSelect: (channelId: string) => void;
  onToggle: () => void;
}> = ({ isOpen, channels, activeChannelId, onChannelSelect, onToggle }) => {
    const { t, language } = useTranslation();

    return (
        <div
            className={`fixed top-0 bottom-0 z-20 transition-transform duration-300 ease-in-out
            ${language === 'ar' ? 'left-0' : 'right-0'}
            ${isOpen ? 'translate-x-0' : (language === 'ar' ? '-translate-x-full' : 'translate-x-full')}`}
        >
            <div
                onClick={onToggle}
                className={`absolute top-1/2 -translate-y-1/2 w-8 h-20 bg-black/60 backdrop-blur-md flex items-center justify-center cursor-pointer
                ${language === 'ar' ? 'left-full rounded-r-xl' : 'right-full rounded-l-xl'}`}
            >
                <i className={`fa-solid ${isOpen ? (language === 'ar' ? 'fa-chevron-left' : 'fa-chevron-right') : (language === 'ar' ? 'fa-chevron-right' : 'fa-chevron-left')}`}></i>
            </div>
            <div className="w-80 max-w-[80vw] h-full bg-black/70 backdrop-blur-lg flex flex-col">
                <h2 className="text-xl font-bold p-4 flex-shrink-0">{t('channels')}</h2>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {channels.map(channel => (
                        <div
                            key={channel.id}
                            onClick={() => onChannelSelect(channel.id)}
                            className={`flex items-center gap-3 p-3 mx-2 rounded-lg cursor-pointer transition-colors ${channel.id === activeChannelId ? 'bg-[var(--primary)]' : 'hover:bg-white/10'}`}
                        >
                            <img src={channel.logoUrl} alt={channel.name} className="w-16 h-16 object-cover rounded-md flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold">{channel.name}</h3>
                                <p className="text-xs text-gray-300 line-clamp-2">{channel.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SoundIndicator: React.FC<{ isMuted: boolean }> = ({ isMuted }) => {
    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center animate-double-tap">
                <i className={`fas ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'} text-white text-4xl`}></i>
            </div>
        </div>
    );
};

const UpNextNotification: React.FC<{ item: ScheduleItem }> = ({ item }) => {
    const { t, language } = useTranslation();
    const title = item.type === 'movie' ? item.movieTitle : item.showName;
    return (
        <div
            className={`absolute bottom-6 z-20 flex items-center gap-3 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 animate-slide-in-right ${language === 'ar' ? 'left-6' : 'right-6'}`}
        >
            <div className="flex-shrink-0">
                <p className="text-xs font-bold uppercase text-gray-400">{t('upNext')}:</p>
                <h4 className="text-base font-bold text-white mt-1">{title}</h4>
            </div>
            {item.backdrop_path && (
                <img
                    src={`${IMAGE_BASE_URL}w300${item.backdrop_path}`}
                    alt={title}
                    className="w-24 h-14 object-cover rounded-md flex-shrink-0"
                />
            )}
        </div>
    );
};

const InfoBanner: React.FC<{ item: ScheduleItem; isVisible: boolean }> = ({ item, isVisible }) => {
    const { t } = useTranslation();
    return (
        <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div>
                <p className="text-sm uppercase font-bold text-gray-400">{t('nowPlaying')}</p>
                <h2 className="text-2xl font-bold text-white mt-1">{item.type === 'movie' ? item.movieTitle : item.showName}</h2>
                {item.type === 'show' && <p className="text-base text-gray-300">{`S${item.season_number} E${item.episode_number} - ${item.episodeTitle}`}</p>}
            </div>
        </div>
    );
};

const LiveTVPage: React.FC = () => {
    const { channelId } = ReactRouterDOM.useParams<{ channelId: string }>();
    const navigate = ReactRouterDOM.useNavigate();
    const { t } = useTranslation();
    const { activeProfile } = useProfile();
    
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [currentItem, setCurrentItem] = useState<ScheduleItem | null>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [seekTime, setSeekTime] = useState(0);
    
    const [showUpNext, setShowUpNext] = useState(false);
    const [showInfoBanner, setShowInfoBanner] = useState(true);
    const [showSoundIcon, setShowSoundIcon] = useState(false);

    const scheduleUpdateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const upNextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const infoBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leaveTimeRef = useRef<number | null>(null);
    
    const allChannels = useMemo(() => {
        const myChannelData = activeProfile?.myChannel;
        let myLiveChannel: LiveChannel | null = null;
        if (myChannelData && myChannelData.schedule.length > 0 && activeProfile) {
             myLiveChannel = {
                id: 'my-channel',
                name: myChannelData.name,
                description: t('yourPersonalChannel'),
                logoUrl: activeProfile.avatar,
                promptHint: 'A personalized channel based on user-created schedule.',
            };
        }
        
        const baseChannels = CHANNELS.map(c => ({...c, name: t(c.name as any), description: t(c.description as any)}));

        return myLiveChannel ? [myLiveChannel, ...baseChannels] : baseChannels;
    }, [activeProfile, t]);

    const logoUrl = useMemo(() => {
        if (channelId === 'cartoon') {
            return 'https://sdmntprwestus.oaiusercontent.com/files/00000000-0df0-6230-aefe-c648ddddb1a6/raw?se=2025-08-13T15%3A08%3A07Z&sp=r&sv=2024-08-04&sr=b&scid=e8a759be-2bcf-521d-8b96-121d804b54c5&skoid=ea0c7534-f237-4ccd-b7ea-766c4ed977ad&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-13T12%3A42%3A33Z&ske=2025-08-14T12%3A42%3A33Z&sks=b&skv=2024-08-04&sig=%2Bu93WGyh8rrBB6InzMfs4drT/cNPVDs7eqQEyIYcNL8%3D';
        }
        return 'https://sdmntprwestus.oaiusercontent.com/files/00000000-6788-6230-bb79-b74c11d2f4ca/raw?se=2025-08-13T15%3A03%3A35Z&sp=r&sv=2024-08-04&sr=b&scid=6480ff8e-75d9-5f11-9c6a-0f47227c48ae&skoid=ea0c7534-f237-4ccd-b7ea-766c4ed977ad&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-08-13T01%3A16%3A12Z&ske=2025-08-14T01%3A16%3A12Z&sks=b&skv=2024-08-04&sig=0jfXKLrsSZSUCj3pe2jomoQmJqS5RPuGhvwf8Oi5pcQ%3D';
    }, [channelId]);


    const updateCurrentItem = useCallback(() => {
        if (schedule.length === 0) return;
        const now = new Date();
        const foundItem = schedule.find(item => {
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
            return now >= startTime && now < endTime;
        });

        if (foundItem) {
            const calculatedSeekTime = (now.getTime() - new Date(foundItem.startTime).getTime()) / 1000;
            setSeekTime(Math.max(0, calculatedSeekTime));
            
            if (foundItem.startTime !== currentItem?.startTime) {
                setCurrentItem(foundItem);
                setShowUpNext(false);
            }
            const endTime = new Date(foundItem.endTime).getTime();
            const timeUntilEnd = endTime - now.getTime() + 1000;
            if (scheduleUpdateTimeout.current) clearTimeout(scheduleUpdateTimeout.current);
            scheduleUpdateTimeout.current = setTimeout(updateCurrentItem, timeUntilEnd);
        } else {
            if (scheduleUpdateTimeout.current) clearTimeout(scheduleUpdateTimeout.current);
            scheduleUpdateTimeout.current = setTimeout(updateCurrentItem, 30000);
        }
    }, [schedule, currentItem]);

    const loadSchedule = useCallback(async () => {
        if (!channelId) return;
        
        setLoading(true);
        setError(null);
        setCurrentItem(null);
        setStreamUrl(null);

        try {
             if (channelId === 'my-channel') {
                const myChannel = activeProfile?.myChannel;
                if (myChannel && myChannel.schedule.length > 0) {
                    setSchedule(myChannel.schedule);
                } else {
                    setError(t('myChannelEmpty'));
                }
            } else {
                const newSchedule = await getScheduleForChannel(channelId);
                setSchedule(newSchedule);
            }
        } catch (e: any) {
            console.error("Failed to load schedule", e);
            setError(e.message || t('scheduleFailed'));
        } finally {
            setLoading(false);
        }
    }, [channelId, t, activeProfile]);


    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                leaveTimeRef.current = Date.now();
            } else {
                if (leaveTimeRef.current) {
                    updateCurrentItem(); // Recalculate position on return
                    leaveTimeRef.current = null;
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [updateCurrentItem]);

    useEffect(() => {
        if(schedule.length > 0) {
            updateCurrentItem();
        }
        return () => { if (scheduleUpdateTimeout.current) clearTimeout(scheduleUpdateTimeout.current); };
    }, [schedule, updateCurrentItem]);

    useEffect(() => {
        const fetchContent = async () => {
            if (currentItem?.type === 'show' || currentItem?.type === 'movie') {
                try {
                    const itemType = currentItem.type === 'show' ? 'tv' : 'movie';
                    const data = await fetchStreamUrl(
                        { id: currentItem.tmdbId, media_type: itemType } as any,
                        itemType,
                        currentItem.season_number,
                        currentItem.episode_number,
                        undefined,
                        ['arabic-toons', 'veloratv']
                    );
                    setStreamUrl(data.links[0]?.url || null);
                    setError(null);
                } catch (e) {
                    console.error("Failed to get stream URL", e);
                    setStreamUrl(null);
                    setError(t('liveStreamUnavailable'));
                }
            } else {
                setStreamUrl(null);
            }
        };
        fetchContent();
    }, [currentItem, t]);

    useEffect(() => {
        setShowInfoBanner(true);
        if (infoBannerTimeoutRef.current) clearTimeout(infoBannerTimeoutRef.current);
        infoBannerTimeoutRef.current = setTimeout(() => setShowInfoBanner(false), 5000);
        return () => { if(infoBannerTimeoutRef.current) clearTimeout(infoBannerTimeoutRef.current) };
    }, [currentItem]);
    
    useEffect(() => {
        if (upNextTimeoutRef.current) clearTimeout(upNextTimeoutRef.current);
        if (currentItem) {
            const endTime = new Date(currentItem.endTime).getTime();
            const now = Date.now();
            const showTime = endTime - 30000;
            if (now < showTime) {
                upNextTimeoutRef.current = setTimeout(() => setShowUpNext(true), showTime - now);
            }
        }
        return () => { if (upNextTimeoutRef.current) clearTimeout(upNextTimeoutRef.current) };
    }, [currentItem]);
    
    const handleChannelSelect = (newChannelId: string) => {
        if(newChannelId !== channelId) {
            navigate(`/live-tv/${newChannelId}`);
        }
    };
    
    const handleScreenClick = () => {
        setIsMuted(prev => !prev);
        setShowInfoBanner(true);
        if (infoBannerTimeoutRef.current) clearTimeout(infoBannerTimeoutRef.current);
        infoBannerTimeoutRef.current = setTimeout(() => setShowInfoBanner(false), 5000);

        setShowSoundIcon(true);
        if (soundTimeoutRef.current) clearTimeout(soundTimeoutRef.current);
        soundTimeoutRef.current = setTimeout(() => setShowSoundIcon(false), 800);
    };
    
    const handleRandomChannel = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent screen click from firing
        if (!channelId || allChannels.length <= 1) return;
        let randomChannel;
        do {
            randomChannel = allChannels[Math.floor(Math.random() * allChannels.length)];
        } while (randomChannel.id === channelId);
        
        navigate(`/live-tv/${randomChannel.id}`);
    };
    
    const getNextItem = () => {
        if (!currentItem || schedule.length === 0) return null;
        const currentIndex = schedule.findIndex(item => item.startTime === currentItem.startTime);
        return schedule[currentIndex + 1] || null;
    }
    const nextItem = getNextItem();

    if (loading) {
        return (
            <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
                <div className="w-16 h-16 border-t-4 border-[var(--primary)] rounded-full animate-spin"></div>
                <p className="text-lg font-semibold animate-pulse">{t('generatingSchedule')}</p>
            </div>
        );
    }
    
    const hasErrorNoStream = error && !streamUrl;

    return (
        <div className="h-dvh w-screen bg-black flex items-center justify-center overflow-hidden text-white">
            <div className="absolute inset-0" onClick={handleScreenClick}>
                {!hasErrorNoStream && <LivePlayer streamUrl={streamUrl} isMuted={isMuted} seekTime={seekTime} />}
            </div>

            {currentItem?.backdrop_path && (
                <div className="absolute inset-0 w-full h-full -z-10">
                    <img src={`${IMAGE_BASE_URL}${BACKDROP_SIZE}${currentItem.backdrop_path}`} alt="background" className="w-full h-full object-cover opacity-20 blur-lg scale-110"/>
                </div>
            )}
            
            <div className="absolute top-5 left-5 flex items-center gap-4 z-10">
                 <img
                    src={logoUrl}
                    alt="CineStream Logo"
                    className="h-32 pointer-events-none animate-channel-logo"
                />
                <button
                    onClick={handleRandomChannel}
                    className="w-24 h-24 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm btn-press"
                    aria-label={t('randomChannel')}
                >
                    <i className="fa-solid fa-shuffle text-4xl"></i>
                </button>
            </div>
            
            {currentItem && (
                <InfoBanner item={currentItem} isVisible={showInfoBanner} />
            )}
            
            {showUpNext && nextItem && <UpNextNotification item={nextItem} />}
            
            {showSoundIcon && <SoundIndicator isMuted={isMuted} />}

            <ChannelGuide
                isOpen={isGuideOpen}
                channels={allChannels}
                activeChannelId={channelId!}
                onChannelSelect={handleChannelSelect}
                onToggle={() => setIsGuideOpen(v => !v)}
            />

            {hasErrorNoStream && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 text-center p-4">
                    <i className="fas fa-satellite-dish text-4xl text-gray-500"></i>
                    <p className="font-semibold text-white mt-2">{t('liveStreamUnavailable')}</p>
                    {error !== t('myChannelEmpty') && <button onClick={loadSchedule} className="mt-4 px-4 py-2 bg-white/20 rounded-lg">{t('retry')}</button>}
                    {error === t('myChannelEmpty') && <button onClick={() => navigate('/my-channel')} className="mt-4 px-4 py-2 bg-[var(--primary)] rounded-lg">{t('createYourChannel')}</button>}
                </div>
            )}
        </div>
    );
};

export default LiveTVPage;
