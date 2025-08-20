


import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/Player';
import { Movie, Episode, Season, HistoryItem, YTPlayer } from '../types';
import { fetchFromTMDB } from '../services/apiService';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { usePlayer, PipData } from '../contexts/PlayerContext';
import { IMAGE_BASE_URL, POSTER_SIZE, BACKDROP_SIZE, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';

const SimilarItemCard: React.FC<{ item: Movie }> = ({ item }) => {
  const navigate = useNavigate();
  const type = item.media_type || (item.title ? 'movie' : 'tv');
  
  const handleClick = () => {
    navigate(`/details/${type}/${item.id}`);
  };

  if (!item.poster_path) return null;

  return (
    <div
      onClick={handleClick}
      className="flex-shrink-0 w-28 md:w-32 cursor-pointer group"
    >
      <div className="relative overflow-hidden transition-all duration-300 ease-in-out transform rounded-xl shadow-lg bg-[var(--surface)]">
        <img
          src={`${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}`}
          srcSet={`${IMAGE_BASE_URL}w342${item.poster_path} 342w, ${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path} 500w`}
          sizes="(max-width: 767px) 112px, 128px"
          alt={item.title || item.name}
          className="object-cover w-full aspect-[2/3]"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 opacity-0 bg-black/50 group-hover:opacity-100">
           <i className="text-3xl text-white fa-solid fa-play"></i>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 p-2">
            <h3 className="text-sm font-semibold text-white truncate">{item.title || item.name}</h3>
        </div>
      </div>
    </div>
  );
};

const DUMMY_COMMENTS_DATA = {
    ar: [
        { id: 1, user: 'أحمد علي', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', text: 'فيلم رائع! أحببت القصة والمؤثرات البصرية.', time: 'منذ ساعتين' },
        { id: 2, user: 'فاطمة الزهراء', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', text: 'نهاية غير متوقعة على الإطلاق. أنصح بمشاهدته.', time: 'منذ 5 ساعات' },
        { id: 3, user: 'خالد عبدالله', avatar: 'https://randomuser.me/api/portraits/men/55.jpg', text: 'لم يعجبني كثيرا، كان مملاً في بعض الأجزاء.', time: 'منذ يوم واحد' },
    ],
    en: [
        { id: 1, user: 'Ahmed Ali', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', text: 'Great movie! I loved the story and the visual effects.', time: '2 hours ago' },
        { id: 2, user: 'Fatima Al-Zahra', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', text: 'A completely unexpected ending. I recommend watching it.', time: '5 hours ago' },
        { id: 3, user: 'Khalid Abdullah', avatar: 'https://randomuser.me/api/portraits/men/55.jpg', text: "I didn't like it that much, it was boring in some parts.", time: '1 day ago' },
    ]
}

interface YouTubePlayerProps {
    videoId: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId }) => {
    const playerDivId = `yt-player-${videoId}-${Math.random().toString(36).substring(7)}`;

    useEffect(() => {
        let player: YTPlayer | null = null;
        const createPlayer = () => {
             if (window.YT && window.YT.Player) {
                player = new window.YT.Player(playerDivId, {
                    videoId: videoId,
                    playerVars: {
                        autoplay: 1,
                        controls: 1,
                        rel: 0,
                        playsinline: 1,
                        modestbranding: 1,
                    },
                });
            }
        }
        
        if (!window.YT || !window.YT.Player) {
            const existingCallback = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if(existingCallback) existingCallback();
                createPlayer();
            };
        } else {
            createPlayer();
        }

        return () => {
            player?.destroy();
        };
    }, [videoId, playerDivId]);

    return <div id={playerDivId} className="w-full h-full"></div>;
};


const PlayerPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { item: initialItem, type, season: initialSeason, episode: initialEpisode, currentTime, streamUrl: initialUrlFromState, youtubeVideoId } = (location.state as any) || {};
    const { setToast, activeProfile, updateHistory, getScreenSpecificData, isFavorite, toggleFavorite, addDownload } = useProfile();
    const { t, language } = useTranslation();
    const { setPipData, setPipAnchor } = usePlayer();

    const [item, setItem] = useState<Movie | null>(initialItem);
    const [currentSeason, setCurrentSeason] = useState<number | undefined>(initialSeason);
    const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(initialEpisode);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [isEpisodesPanelOpen, setIsEpisodesPanelOpen] = useState(false);
    const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
    const DUMMY_COMMENTS = DUMMY_COMMENTS_DATA[language];
    
    const [manualProviderSelection, setManualProviderSelection] = useState<string | null>(null);
    const [activeProvider, setActiveProvider] = useState<string | null>(null);
    const [isFetchingStream, setIsFetchingStream] = useState(true);

    const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const serverPreferences = getScreenSpecificData('serverPreferences', []);
    
    const [activeStreamUrl, setActiveStreamUrl] = useState<string | null>(initialUrlFromState);
    const [contentChanged, setContentChanged] = useState(false);

    const pageWrapperRef = useRef<HTMLDivElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const infoSectionRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState({ isDragging: false, startY: 0, startX: 0, moved: false });

    const isFav = useMemo(() => item ? isFavorite(item.id) : false, [isFavorite, item]);

    const handleToggleFavorite = useCallback(() => {
        if (item) {
            toggleFavorite(item);
        }
    }, [item, toggleFavorite]);

    const handleShare = useCallback(() => {
        const shareData = {
            title: item?.title || item?.name || 'Untitled',
            text: `Check out ${item?.title || item?.name || 'this content'}!`,
            url: window.location.origin + `/#/details/${type}/${item?.id}`
        };

        if (navigator.share) {
            navigator.share(shareData)
                .catch((error) => console.log('Error sharing', error));
        } else {
            navigator.clipboard.writeText(shareData.url);
            setToast({ message: t('shareLinkCopied'), type: 'success' });
        }
    }, [item, type, t, setToast]);

    const handleDownload = useCallback(() => {
        if (item) {
            addDownload({
                title: item.title || item.name || 'Unknown',
                poster: item.poster_path ? `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}` : ''
            });
        }
    }, [item, addDownload]);


    useEffect(() => {
        const video = videoNode;
        const canvas = canvasRef.current;

        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const drawFrame = () => {
            if (canvas.width > 0 && canvas.height > 0) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
        };

        const animate = () => {
            if (video.paused || video.ended) {
                cancelAnimationFrame(animationFrameId);
                return;
            }
            drawFrame();
            animationFrameId = requestAnimationFrame(animate);
        };

        const handlePlay = () => requestAnimationFrame(animate);
        const handlePause = () => {
            cancelAnimationFrame(animationFrameId);
            drawFrame();
        };
        const handleSeeked = () => {
            if (video.paused) {
                drawFrame();
            }
        };
        const handleLoadedData = () => {
            drawFrame();
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('seeked', handleSeeked);
        video.addEventListener('loadeddata', handleLoadedData);

        if (video.readyState >= 2) {
            drawFrame();
            if (!video.paused) {
                handlePlay();
            }
        }
        
        return () => {
            cancelAnimationFrame(animationFrameId);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('loadeddata', handleLoadedData);
        };
    }, [videoNode]);

    const handleProviderSelect = (providerName: string) => {
        if (providerName !== manualProviderSelection) {
            setManualProviderSelection(providerName);
            setActiveProvider(providerName);
            setContentChanged(true);
        }
    };
    
    const handleProviderSelected = useCallback((providerName: string) => {
        setActiveProvider(providerName);
    }, []);

    const handleStreamFetchStateChange = useCallback((isFetching: boolean) => {
        setIsFetchingStream(isFetching);
    }, []);


    const formatCount = (num: number | undefined) => {
        if (num === undefined) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    };


    useEffect(() => {
        setPipData(null); // Clear any existing PiP when the main player opens

        if (!initialItem) {
            navigate('/home', { replace: true });
            return;
        }

        const fetchAllData = async () => {
            setLoading(true);
            try {
                const data = await fetchFromTMDB(`/${type}/${initialItem.id}`, { append_to_response: 'recommendations,content_ratings' });
                setItem(data);
                
                if (type === 'tv') {
                    const seasonToFetch = currentSeason || (data.seasons?.find((s: Season) => s.season_number > 0 && s.episode_count > 0)?.season_number ?? 1);
                    if (currentSeason === undefined) setCurrentSeason(seasonToFetch);

                    if (data.id && seasonToFetch) {
                        const seasonData = await fetchFromTMDB(`/tv/${data.id}/season/${seasonToFetch}`);
                        setEpisodes(seasonData.episodes);

                        if (!currentEpisode) {
                           const firstEpisode = seasonData.episodes.find((ep: Episode) => ep.episode_number > 0) || seasonData.episodes[0];
                           setCurrentEpisode(firstEpisode);
                        } else if (currentEpisode && !currentEpisode.name) {
                            const fullEpisodeDetails = seasonData.episodes.find((ep: Episode) => ep.id === currentEpisode.id);
                            if(fullEpisodeDetails) setCurrentEpisode(fullEpisodeDetails);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch player page data:", error);
                setToast({ message: t('failedToLoadDetails'), type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();

    }, [initialItem?.id]);
    
    useEffect(() => {
        if (youtubeVideoId && !window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            if (firstScriptTag && firstScriptTag.parentNode) {
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            }
        }
    }, [youtubeVideoId]);
    
     useEffect(() => {
        const video = document.querySelector('video'); // A more direct way to get the video element from the player
        return () => {
            if (video && item && video.duration > 0 && video.currentTime > 0) {
                const progress = (video.currentTime / video.duration) * 100;
                if (progress > 5 && progress < 95) { // Only save meaningful progress
                    const historyItem: HistoryItem = {
                        id: item.id,
                        type: type,
                        title: initialEpisode ? `${item.name}: S${initialSeason}E${initialEpisode.episode_number}` : (item.name || item.title),
                        itemImage: item.backdrop_path ? `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}` : '',
                        currentTime: video.currentTime,
                        duration: video.duration,
                        timestamp: Date.now(),
                        episodeId: initialEpisode?.id,
                    };
                    updateHistory(historyItem);
                }
            }
        };
    }, [item, type, initialSeason, initialEpisode, updateHistory]);


    const handleSeasonChange = async (seasonNumber: number) => {
        if (!item?.id || seasonNumber === currentSeason) return;
        setContentChanged(true);
        setCurrentSeason(seasonNumber);
        setEpisodes([]); // Clear old episodes
        try {
            const seasonData = await fetchFromTMDB(`/tv/${item.id}/season/${seasonNumber}`);
            setEpisodes(seasonData.episodes);
            // Automatically select the first episode of the new season
            if (seasonData.episodes && seasonData.episodes.length > 0) {
                setCurrentEpisode(seasonData.episodes[0]);
            }
        } catch (error) {
            console.error("Failed to fetch season", error);
            setToast({ message: t('failedToLoadEpisodes'), type: 'error' });
        }
    };
    
    const handleEpisodeSelect = (episode: Episode) => {
        if (episode.id === currentEpisode?.id) return;
        setContentChanged(true);
        setCurrentEpisode(episode);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSelectEpisodeAndClosePanel = (episode: Episode) => {
        handleEpisodeSelect(episode);
        setIsEpisodesPanelOpen(false);
    };

    const handleEnterPip = (url: string, time: number, playing: boolean, dimensions: DOMRect) => {
        if (!item || !type) return;
        const pipState: PipData = {
            item,
            type,
            season: currentSeason,
            episode: currentEpisode,
            currentTime: time,
            isPlaying: playing,
            streamUrl: url,
        };
        setPipAnchor({
            top: dimensions.top,
            left: dimensions.left,
            width: dimensions.width,
            height: dimensions.height,
        });
        setPipData(pipState);
        navigate(-1);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (playerContainerRef.current?.contains(target) && !target.closest('.controls-bar')) {
            if (e.touches.length === 1) {
                setDragState({ 
                    isDragging: false, 
                    startY: e.touches[0].clientY,
                    startX: e.touches[0].clientX,
                    moved: false,
                });
                if (playerContainerRef.current) playerContainerRef.current.style.transition = 'none';
                if (infoSectionRef.current) infoSectionRef.current.style.transition = 'none';
                if (pageWrapperRef.current) pageWrapperRef.current.style.transition = 'none';
            }
        } else {
            setDragState({ isDragging: false, startY: 0, startX: 0, moved: false });
        }
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        if (dragState.startY === 0) return;
    
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const deltaY = currentY - dragState.startY;
        const deltaX = currentX - dragState.startX;
        
        let isDragging = dragState.isDragging;
        if (!dragState.moved) {
            if (Math.abs(deltaY) > 10 || Math.abs(deltaX) > 10) {
                if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0) {
                    isDragging = true;
                    setDragState(s => ({ ...s, isDragging: true, moved: true }));
                } else {
                    setDragState({ isDragging: false, startY: 0, startX: 0, moved: true });
                    return;
                }
            }
        }
        
        if (isDragging) {
            e.preventDefault();
            const effectiveDeltaY = Math.max(0, deltaY);
            const scale = Math.max(0.5, 1 - (effectiveDeltaY / (window.innerHeight * 1.5)));
            const infoOpacity = Math.max(0, 1 - (effectiveDeltaY / (window.innerHeight * 0.3)));
            const pageBgOpacity = Math.max(0.3, 1 - (effectiveDeltaY / window.innerHeight));
    
            if (playerContainerRef.current) {
                playerContainerRef.current.style.transform = `translateY(${effectiveDeltaY}px) scale(${scale})`;
                playerContainerRef.current.style.transformOrigin = 'center top';
            }
            if (infoSectionRef.current) {
                infoSectionRef.current.style.opacity = `${infoOpacity}`;
            }
             if (pageWrapperRef.current) {
                const bgValue = Math.round(16 * pageBgOpacity);
                pageWrapperRef.current.style.backgroundColor = `rgb(${bgValue}, ${bgValue}, ${bgValue})`;
            }
        }
    };
    
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!dragState.isDragging) {
            setDragState({ isDragging: false, startY: 0, startX: 0, moved: false });
            return;
        }
        
        const finalY = e.changedTouches[0].clientY;
        const deltaY = finalY - dragState.startY;
        const threshold = window.innerHeight * 0.3;
    
        if (deltaY > threshold) {
            const playerElement = playerContainerRef.current;
            if (playerElement && videoNode && activeStreamUrl) {
                const dimensions = playerElement.getBoundingClientRect();
                handleEnterPip(activeStreamUrl, videoNode.currentTime, !videoNode.paused, dimensions);
            }
        } else {
            if (playerContainerRef.current) {
                playerContainerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                playerContainerRef.current.style.transform = 'translateY(0) scale(1)';
            }
            if (infoSectionRef.current) {
                infoSectionRef.current.style.transition = 'opacity 0.3s ease';
                infoSectionRef.current.style.opacity = '1';
            }
             if (pageWrapperRef.current) {
                pageWrapperRef.current.style.transition = 'background-color 0.3s ease';
                pageWrapperRef.current.style.backgroundColor = `var(--background)`;
            }
        }
    
        setDragState({ isDragging: false, startY: 0, startX: 0, moved: false });
    };
    
    if (loading || !item) {
        return <div className="flex items-center justify-center h-screen bg-black"><div className="w-16 h-16 border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin"></div></div>;
    }
    
    const title = currentEpisode ? `${item.name || item.title}: E${currentEpisode.episode_number} "${currentEpisode.name}"` : (item.title || item.name);
    const overview = currentEpisode?.overview || item.overview;
    const ratingObj = item.content_ratings?.results.find(r => r.iso_3166_1 === 'US');
    
    return (
        <div 
            ref={pageWrapperRef}
            className="bg-[var(--background)] min-h-screen text-white"
            onTouchStart={!youtubeVideoId ? handleTouchStart : undefined}
            onTouchMove={!youtubeVideoId ? handleTouchMove : undefined}
            onTouchEnd={!youtubeVideoId ? handleTouchEnd : undefined}
            style={{ touchAction: 'pan-y' }}
        >
            <div className="w-full bg-black sticky top-0 z-30">
                <div ref={playerContainerRef} className="relative w-full aspect-[16/10] max-h-[90vh] bg-black">
                    {youtubeVideoId ? (
                        <YouTubePlayer videoId={youtubeVideoId} />
                    ) : (
                        <VideoPlayer
                            item={item}
                            itemType={type}
                            initialSeason={currentSeason}
                            initialEpisode={currentEpisode}
                            initialTime={contentChanged ? 0 : currentTime}
                            initialStreamUrl={contentChanged ? null : activeStreamUrl}
                            onEnterPip={handleEnterPip}
                            onEpisodesButtonClick={() => setIsEpisodesPanelOpen(true)}
                            selectedProvider={manualProviderSelection}
                            onProviderSelected={handleProviderSelected}
                            onStreamFetchStateChange={handleStreamFetchStateChange}
                            setVideoNode={setVideoNode}
                            serverPreferences={serverPreferences}
                            onActiveStreamUrlChange={setActiveStreamUrl}
                            episodes={episodes}
                            onEpisodeSelect={handleEpisodeSelect}
                            isOffline={location.state?.isOffline}
                            downloadId={location.state?.downloadId}
                        />
                    )}
                     {!youtubeVideoId && (
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-x-0 top-full w-full h-40 opacity-40 blur-2xl pointer-events-none"
                            style={{ maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)' }}
                            width="320"
                            height="180"
                        />
                     )}
                </div>
            </div>

            <div ref={infoSectionRef} className="p-4 space-y-4">
                {!youtubeVideoId && (
                 <div className="flex items-center gap-2 -mt-2 mb-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <span className="text-sm font-semibold text-gray-400">{t('servers')}:</span>
                    {[
                        { id: 'moviebox', label: 'MB', isPrimary: true },
                        { id: 'td', label: 'TD' },
                        { id: 'akwam', label: 'AK' },
                        { id: 'aflam', label: 'AF' },
                        { id: 'arabic-toons', label: 'AT' },
                        { id: 'ristoanime', label: 'RE' },
                        { id: 'veloratv', label: 'VE' }
                    ].map(p => {
                        const isPrimary = 'isPrimary' in p && p.isPrimary;
                        const isSelected = activeProvider === p.id;

                        let stateClasses = '';
                        if (isSelected) {
                            stateClasses = `bg-[var(--primary)] ${isPrimary ? 'border-yellow-500' : 'border-[var(--primary)]'} text-white`;
                        } else {
                            if (isPrimary) {
                                stateClasses = 'bg-zinc-800/60 border-yellow-500 text-zinc-300 hover:bg-zinc-700 hover:border-yellow-400';
                            } else {
                                stateClasses = 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600';
                            }
                        }
                        
                        return (
                            <div key={p.id} className="relative">
                                <button
                                    onClick={() => handleProviderSelect(p.id)}
                                    disabled={isFetchingStream}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 focus:outline-none btn-press border-2 ${stateClasses} ${
                                        isFetchingStream
                                        ? (isSelected ? 'animate-pulse' : 'opacity-50 cursor-not-allowed')
                                        : ''
                                    }`}
                                >
                                    {p.label}
                                </button>
                            </div>
                        );
                    })}
                    {isFetchingStream && <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin ms-2"></div>}
                </div>
                )}

                <section>
                    <h1 className="text-xl font-bold leading-tight">{title}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5"><i className="text-yellow-400 fa-solid fa-star"></i>{item.vote_average.toFixed(1)}</span>
                        <span>{item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4)}</span>
                        {ratingObj?.rating && <span className='px-1.5 py-0.5 border border-white/30 text-xs rounded'>{ratingObj.rating}</span>}
                        {item.runtime ? <span>{Math.floor(item.runtime/60)}{t('hoursShort')} {item.runtime%60}{t('minutesShort')}</span> : type === 'tv' && <span>{item.number_of_seasons} {t('seasons')}</span>}
                    </div>
                </section>
                
                <section className="flex items-center justify-around text-center text-gray-300 py-2">
                    <button onClick={handleToggleFavorite} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-zinc-800 w-20 transition-colors">
                        <i className={`fa-solid ${isFav ? 'fa-check text-[var(--primary)]' : 'fa-plus'} text-xl`}></i>
                        <span className="text-xs font-semibold">{isFav ? t('addedToList') : t('addToList')}</span>
                    </button>
                    <button onClick={handleShare} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-zinc-800 w-20 transition-colors">
                        <i className="fa-solid fa-share-nodes text-xl"></i>
                        <span className="text-xs font-semibold">{t('share')}</span>
                    </button>
                    <button onClick={handleDownload} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-zinc-800 w-20 transition-colors">
                        <i className="fa-solid fa-download text-xl"></i>
                        <span className="text-xs font-semibold">{t('downloads')}</span>
                    </button>
                    <button onClick={() => { setToast({ message: 'Clip feature coming soon!', type: 'info'}) }} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-zinc-800 w-20 transition-colors">
                        <i className="fa-solid fa-scissors text-xl"></i>
                        <span className="text-xs font-semibold">{t('clip', { defaultValue: 'Clip' })}</span>
                    </button>
                </section>
                
                {overview && (
                    <section onClick={() => setDescriptionExpanded(!descriptionExpanded)} className="p-3 rounded-xl bg-[var(--surface)] cursor-pointer">
                        <p className={`text-sm text-gray-300 transition-all duration-300 ${!descriptionExpanded && 'line-clamp-3'}`}>
                            {overview}
                        </p>
                         <button className="mt-2 text-sm font-bold text-[var(--primary)]">
                            {descriptionExpanded ? t('showLess') : t('showMore')}
                        </button>
                    </section>
                )}

                <section>
                     <button 
                        onClick={() => setIsCommentsPanelOpen(true)}
                        className="w-full text-start p-4 rounded-xl bg-[var(--surface)] transition-colors"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-bold text-base">{t('comments')}</h3>
                            <span className="text-gray-400 text-sm font-medium">{formatCount(1100)}</span>
                        </div>
                        {DUMMY_COMMENTS.length > 0 && (
                            <div className="flex items-center gap-3">
                                <img src={DUMMY_COMMENTS[0].avatar} alt="commenter avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                <p className="text-sm text-gray-200 truncate">{DUMMY_COMMENTS[0].text}</p>
                            </div>
                        )}
                    </button>
                </section>
                
                {item.recommendations?.results && item.recommendations.results.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold mb-4">{t('similar')}</h2>
                        <div className="flex pb-4 -mx-4 overflow-x-auto no-scrollbar sm:mx-0">
                            <div className="flex flex-nowrap gap-x-4 px-4">
                                {item.recommendations.results.slice(0, 10).map(rec => <SimilarItemCard key={rec.id} item={rec} />)}
                            </div>
                        </div>
                    </section>
                )}
            </div>
            
            {isEpisodesPanelOpen && (
                 <div className="fixed inset-0 bg-black/60 z-40 animate-fade-in" style={{animationDuration: '0.3s'}} onClick={() => setIsEpisodesPanelOpen(false)}>
                   <div 
                        className="absolute bottom-0 left-0 right-0 p-4 rounded-t-2xl glassmorphic-panel animate-[slide-in-bottom_0.3s_ease-out_forwards]"
                        style={{ maxHeight: '70vh' }}
                        onClick={e => e.stopPropagation()}
                   >
                        <div className="w-12 h-1.5 mx-auto mb-4 bg-gray-600 rounded-full"></div>
                        <div className="text-white">
                            <div className="flex items-center justify-between mb-4">
                                 <h3 className="text-xl font-bold">{t('episodes')}</h3>
                                 {item.seasons && (
                                     <div className="relative">
                                        <select 
                                            value={currentSeason}
                                            onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                                            className="ps-8 pe-4 py-2 text-white bg-white/10 border border-white/20 rounded-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                        >
                                        {item.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0).map(season => (
                                            <option key={season.id} value={season.season_number}>
                                                {t('season')} {season.season_number}
                                            </option>
                                        ))}
                                        </select>
                                        <div className="absolute inset-y-0 flex items-center px-2 pointer-events-none start-1">
                                            <i className="text-gray-400 fa-solid fa-chevron-down text-xs"></i>
                                        </div>
                                    </div>
                                 )}
                            </div>
                            <div className="flex flex-col gap-3 overflow-y-auto" style={{maxHeight: 'calc(70vh - 100px)'}}>
                                {episodes?.map(ep => (
                                    <div key={ep.id} onClick={() => handleSelectEpisodeAndClosePanel(ep)} 
                                        className={`flex items-start gap-4 p-2 rounded-lg cursor-pointer transition-colors duration-200 ${currentEpisode?.id === ep.id ? 'bg-[var(--primary)]/70' : 'bg-white/10'}`}>
                                        <div className="relative flex-shrink-0">
                                            <img src={ep.still_path ? `${IMAGE_BASE_URL}w300${ep.still_path}` : `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}`} 
                                                srcSet={ep.still_path ? `${IMAGE_BASE_URL}w185${ep.still_path} 185w, ${IMAGE_BASE_URL}w300${ep.still_path} 300w` : undefined}
                                                sizes="144px"
                                                alt={ep.name} className="object-cover w-36 h-20 rounded-md" />
                                            {currentEpisode?.id === ep.id && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-md">
                                                    <i className="text-3xl text-white fa-solid fa-volume-high"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 pt-1">
                                            <h4 className="font-semibold text-sm line-clamp-2">{ep.episode_number}. {ep.name}</h4>
                                            <p className="text-xs text-gray-400 line-clamp-2 mt-1">{ep.overview}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                   </div>
                 </div>
            )}

            {isCommentsPanelOpen && (
                <div className="fixed inset-0 bg-black/60 z-40 animate-fade-in" style={{animationDuration: '0.3s'}} onClick={() => setIsCommentsPanelOpen(false)}>
                  <div 
                       className="absolute bottom-0 left-0 right-0 p-4 glassmorphic-panel rounded-t-2xl animate-[slide-in-bottom_0.3s_ease-out_forwards]"
                       style={{ maxHeight: '70vh' }}
                       onClick={e => e.stopPropagation()}
                  >
                       <div className="w-12 h-1.5 mx-auto mb-4 bg-gray-600 rounded-full"></div>
                       <div className="text-white">
                           <h3 className="text-xl font-bold mb-4">{t('comments')} ({formatCount(1100)})</h3>
                           <div className="space-y-4 overflow-y-auto" style={{maxHeight: 'calc(70vh - 100px)'}}>
                               {/* Add comment form */}
                               <div className="flex items-start gap-3">
                                   <img src={activeProfile?.avatar} alt="Your avatar" className="w-10 h-10 rounded-full object-cover" />
                                   <div className="flex-1">
                                       <textarea
                                           rows={2}
                                           placeholder={t('addComment')}
                                           className="w-full p-2 text-sm text-white bg-transparent border-b-2 border-gray-600 rounded-t-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                                       ></textarea>
                                       <div className="flex justify-end mt-2">
                                           <button onClick={() => { setToast({message: t('commentPosted'), type: 'success'}); setIsCommentsPanelOpen(false); }} className="px-4 py-1.5 text-sm font-bold text-white bg-[var(--primary)] rounded-full transition-opacity">{t('post')}</button>
                                       </div>
                                   </div>
                               </div>

                               {/* Comments list */}
                               <div className="space-y-5 pt-4">
                                   {DUMMY_COMMENTS.map(comment => (
                                       <div key={comment.id} className="flex items-start gap-3">
                                           <img src={comment.avatar} alt={comment.user} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                           <div className="flex-1">
                                               <div className="flex items-baseline gap-2">
                                                   <p className="font-semibold text-white">{comment.user}</p>
                                                   <p className="text-xs text-gray-500">{comment.time}</p>
                                               </div>
                                               <p className="text-sm text-gray-300 mt-1">{comment.text}</p>
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       </div>
                  </div>
                </div>
            )}
        </div>
    );
};

export default PlayerPage;