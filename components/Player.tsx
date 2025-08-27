import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from './Icons'; // تأكد من أن مسار الأيقونات صحيح
import { Movie, Episode } from '../types'; // استيراد الأنواع الأساسية

// --- واجهة الخصائص المبسطة ---
interface SimplePlayerProps {
    item: Movie;
    episode?: Episode | null; // اختياري
    streamUrl: string;       // الرابط مطلوب
    initialTime?: number;
    onNext?: () => void; // دالة للانتقال للتالي
}

// دالة بسيطة لتنسيق الوقت
const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(seconds * 1000);
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    return `${mm}:${ss}`;
};

// --- المكون المبسط ---
const SimpleVideoPlayer: React.FC<SimplePlayerProps> = ({ item, episode, streamUrl, initialTime = 0, onNext }) => {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- حالات قليلة وضرورية فقط للواجهة ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // --- دالة البروكسي (تبقى كما هي للروابط المباشرة) ---
    const toProxiedUrl = (url: string) => {
        const PROXY_PREFIX = (typeof window !== 'undefined' && window.location.hostname === 'localhost') ? '' : 'https://prox-q3zt.onrender.com';
        if (!PROXY_PREFIX) return `/proxy?url=${encodeURIComponent(url)}`;
        return `${PROXY_PREFIX}/proxy?url=${encodeURIComponent(url)}`;
    };

    // --- التأثير الرئيسي: تشغيل الفيديو مباشرة ---
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;

        console.log("Setting new video source:", streamUrl);
        // التعامل مع البروكسي فقط إذا كان الرابط كاملاً
        video.src = streamUrl.startsWith("http") ? toProxiedUrl(streamUrl) : streamUrl;
        
        // إعادة الوقت والتشغيل
        video.currentTime = initialTime;
        video.load();
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Autoplay was prevented:", error);
                // محاولة التشغيل الصامت إذا فشل التشغيل التلقائي
                video.muted = true;
                video.play();
            });
        }

    }, [streamUrl, initialTime]); // يعمل فقط عند تغير الرابط

    // --- تأثير لإدارة حالات الواجهة وأحداث الفيديو ---
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleLoadedMetadata = () => setDuration(video.duration);
        const handleWaiting = () => setIsBuffering(true);
        const handlePlaying = () => setIsBuffering(false);
        const handleEnded = () => { if (onNext) onNext(); };
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ended', handleEnded);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        // تنظيف الأحداث عند تفكيك المكون
        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ended', handleEnded);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [onNext]);

    // --- دوال التحكم البسيطة ---
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (video) {
            video.paused ? video.play() : video.pause();
        }
    }, []);

    const handleSeek = (forward: boolean) => {
        const video = videoRef.current;
        if (video) {
            video.currentTime += forward ? 10 : -10;
        }
    };
    
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const video = videoRef.current;
        const progressRect = progressBarRef.current?.getBoundingClientRect();
        if (video && progressRect) {
            const clickPosition = e.clientX - progressRect.left;
            const percentage = clickPosition / progressRect.width;
            video.currentTime = percentage * duration;
        }
    };

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            playerContainerRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }, []);

    const hideControls = useCallback(() => {
        if (!videoRef.current?.paused) {
            setShowControls(false);
        }
    }, []);

    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(hideControls, 4000);
    }, [hideControls]);

    return (
        <div
            ref={playerContainerRef}
            className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
            onMouseMove={resetControlsTimeout}
            onClick={() => setShowControls(s => !s)}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                preload="auto" // أهم خاصية للتحميل المسبق
                poster={item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : ''}
            />

            {/* مؤشر التحميل */}
            {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
            )}

            {/* واجهة التحكم المبسطة */}
            <div
                className={`absolute inset-0 text-white transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
            >
                {/* تدرج لوني علوي وسفلي */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/60 pointer-events-none"></div>
                
                {/* الشريط العلوي */}
                <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-2xl"><Icons.BackIcon /></button>
                    <h2 className="text-lg font-bold truncate">{item.title || item.name} {episode ? `- S${episode.season_number} E${episode.episode_number}` : ''}</h2>
                </div>

                {/* أزرار التحكم في المنتصف */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-12">
                    <button onClick={() => handleSeek(false)}><Icons.RewindIcon className="w-10 h-10" /></button>
                    <button onClick={togglePlay}>{isPlaying ? <Icons.PauseIcon className="w-14 h-14" /> : <Icons.PlayIcon className="w-14 h-14" />}</button>
                    <button onClick={() => handleSeek(true)}><Icons.ForwardIcon className="w-10 h-10" /></button>
                </div>
                
                {/* الشريط السفلي */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                    {/* شريط التقدم */}
                    <div className="flex items-center gap-x-3">
                        <span className="text-sm font-mono">{formatTime(currentTime)}</span>
                        <div ref={progressBarRef} onClick={handleProgressClick} className="w-full h-4 flex items-center cursor-pointer group">
                            <div className="relative w-full h-1 bg-white/30 rounded-full">
                                <div className="absolute h-full bg-red-600 rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                                <div className="absolute w-3 h-3 bg-red-600 rounded-full -translate-x-1/2 -translate-y-1 scale-0 group-hover:scale-100" style={{ left: `${(currentTime / duration) * 100}%` }}></div>
                            </div>
                        </div>
                        <span className="text-sm font-mono">{formatTime(duration)}</span>
                    </div>

                    {/* أزرار التحكم السفلية */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-x-4">
                            <button onClick={togglePlay}>{isPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play"></i>}</button>
                            {onNext && <button onClick={onNext}><i className="fa-solid fa-forward-step"></i></button>}
                        </div>
                        <button onClick={toggleFullscreen}>
                            {isFullscreen ? <Icons.ExitFullscreenIcon /> : <Icons.EnterFullscreenIcon />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SimpleVideoPlayer;
