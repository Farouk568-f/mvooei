import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Movie, Episode, StreamLink } from '../types';
import * as Icons from './Icons';
import { IMAGE_BASE_URL, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';
import { useTranslation } from '../contexts/LanguageContext';

// --- تم تبسيط الواجهة، لم نعد بحاجة لكل الخصائص المعقدة ---
interface PlayerProps {
    item: Movie;
    itemType: 'movie' | 'tv';
    initialSeason: number | undefined;
    initialEpisode: Episode | null;
    initialStreamUrl?: string | null;
    episodes: Episode[];
    onEpisodeSelect: (episode: Episode) => void;
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

const VideoPlayer: React.FC<PlayerProps> = ({ item, itemType, initialSeason, initialEpisode, initialStreamUrl, episodes, onEpisodeSelect }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);

    const hideControls = useCallback(() => {
        if (!videoRef.current?.paused) {
            setShowControls(false);
        }
    }, []);

    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(hideControls, 3000);
    }, [hideControls]);

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

    const handleSeek = (forward: boolean) => {
        const video = videoRef.current;
        if (video) {
            video.currentTime += forward ? 10 : -10;
        }
        resetControlsTimeout();
    };
    
    const handleProgressInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!progressBarRef.current || !videoRef.current || !duration) return;
        const event = 'touches' in e ? e.touches[0] : e;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const newTime = (clickX / rect.width) * duration;
        videoRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
    }, [duration]);

    const handleProgressClick = useCallback((e: React.MouseEvent) => {
        handleProgressInteraction(e);
        resetControlsTimeout();
    }, [handleProgressInteraction, resetControlsTimeout]);

    const handleProgressDrag = useCallback((e: React.MouseEvent) => {
        if (e.buttons !== 1) return;
        handleProgressInteraction(e);
    }, [handleProgressInteraction]);

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

    const nextEpisode = useMemo(() => {
        if (!initialEpisode || !episodes || episodes.length === 0) return null;
        const currentIndex = episodes.findIndex(ep => ep.id === initialEpisode.id);
        if (currentIndex > -1 && currentIndex < episodes.length - 1) {
            return episodes[currentIndex + 1];
        }
        return null;
    }, [initialEpisode, episodes]);

    const handlePlayNext = useCallback(() => {
        if (nextEpisode) {
            onEpisodeSelect(nextEpisode);
        }
    }, [nextEpisode, onEpisodeSelect]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onDurationChange = () => setDuration(video.duration || 0);
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => setIsBuffering(false);
        const onProgress = () => {
            if (video.buffered.length > 0 && duration > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                setBuffered((bufferedEnd / duration) * 100);
            }
        };
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('progress', onProgress);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('progress', onProgress);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [duration]);

    // البدء بإخفاء المؤشر بعد فترة
    useEffect(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    // الحالة 1: لا يوجد رابط فيديو
    if (!initialStreamUrl) {
        return (
            <div className="relative w-full h-full bg-black flex items-center justify-center text-white">
                 {item.backdrop_path && (
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-50"
                        style={{ backgroundImage: `url(${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path})` }}
                    />
                )}
                <div className="relative z-10 text-lg">
                    جاري تحضير الرابط...
                </div>
            </div>
        );
    }
    
    // الحالة 2: يوجد رابط فيديو، اعرض المشغل
    return (
        <div 
            ref={playerContainerRef} 
            className={`player-container-scope relative w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-none ${!showControls ? 'c-controls-hidden' : ''}`}
            onMouseMove={resetControlsTimeout}
            onClick={resetControlsTimeout}
        >
            <video
                key={initialStreamUrl} // ✨ أهم جزء: لإعادة تحميل الفيديو عند تغيير الحلقة
                ref={videoRef}
                className="w-full h-full object-contain" // contain أفضل كبداية
                autoPlay
                preload="auto"
                playsInline
            >
                <source src={initialStreamUrl} type="video/mp4" />
            </video>

            {isBuffering && (
                <div className="absolute inset-0 flex justify-center items-center text-white z-20 pointer-events-none">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
            )}
            
            {/* واجهة التحكم المبسطة */}
            <Controls
                showControls={showControls}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                isFullscreen={isFullscreen}
                togglePlay={togglePlay}
                handleSeek={handleSeek}
                handleProgressClick={handleProgressClick}
                handleProgressDrag={handleProgressDrag}
                toggleFullscreen={toggleFullscreen}
                navigate={navigate}
                t={t}
                item={item}
                episode={initialEpisode}
                season={initialSeason}
                buffered={buffered}
                progressBarRef={progressBarRef}
                nextEpisode={nextEpisode}
                handlePlayNext={handlePlayNext}
            />
        </div>
    );
};

// --- مكون واجهة التحكم (مبسط وبدون popovers) ---
const Controls: React.FC<any> = ({
    showControls, isPlaying, currentTime, duration, isFullscreen,
    togglePlay, handleSeek, toggleFullscreen,
    navigate, t, item, episode, season, progressBarRef, buffered,
    nextEpisode, handlePlayNext, handleProgressClick, handleProgressDrag
}) => {
    return (
        <div className={`absolute inset-0 text-white controls-bar pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/60"></div>
            
            {/* الشريط العلوي */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-auto">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 text-xl"><Icons.BackIcon className="w-8 h-8" /></button>
                    <div>
                        <h2 className="text-lg font-bold truncate max-w-[calc(100vw-200px)]">{`${item.title || item.name} ${episode ? ` - S${season} E${episode.episode_number}` : ''}`}</h2>
                    </div>
                </div>
            </div>
            
            {/* أزرار التحكم في المنتصف (فقط في وضع ملء الشاشة) */}
            {isFullscreen && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-x-16 pointer-events-auto">
                    <button onClick={() => handleSeek(false)}><Icons.RewindIcon className="w-12 h-12" /></button>
                    <button onClick={togglePlay}>{isPlaying ? <Icons.PauseIcon className="w-16 h-16" /> : <Icons.PlayIcon className="w-16 h-16" />}</button>
                    <button onClick={() => handleSeek(true)}><Icons.ForwardIcon className="w-12 h-12" /></button>
                </div>
            )}

            {/* الشريط السفلي */}
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
                            <div className="absolute bg-[var(--primary)] rounded-full -translate-x-1/2 -translate-y-[5px] transition-transform duration-200 z-10 w-3.5 h-3.5 scale-0 group-hover:scale-100" style={{ left: `${(currentTime / duration) * 100}%` }}/>
                        </div>
                    </div>
                    <span className="font-mono text-sm">{formatTime(duration)}</span>
                 </div>

                 <div className="flex items-center justify-between gap-x-2 mt-2">
                    <div className="flex items-center gap-x-4">
                        <button onClick={togglePlay} className="text-2xl w-8"><i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i></button>
                        {nextEpisode && <button onClick={handlePlayNext} className="text-2xl w-8"><i className="fa-solid fa-forward-step"></i></button>}
                    </div>
                    <div className="flex items-center gap-x-2">
                        <button onClick={toggleFullscreen} className="text-xl w-8 text-center">
                            {isFullscreen ? <Icons.ExitFullscreenIcon className="w-5 h-5" /> : <Icons.EnterFullscreenIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VideoPlayer;
