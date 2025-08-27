import React from 'react';
import { Movie, Episode } from '../types'; // نحتفظ بالأنواع الأساسية للـ props
import { IMAGE_BASE_URL, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';

/**
 * واجهة الخصائص (Props) تبقى كما هي للحفاظ على التوافق مع بقية التطبيق،
 * لكننا سنستخدم فقط `item` و `initialStreamUrl`. سيتم تجاهل الباقي.
 */
interface PlayerProps {
    item: Movie;
    itemType: 'movie' | 'tv';
    initialSeason: number | undefined;
    initialEpisode: Episode | null;
    initialTime?: number;
    initialStreamUrl?: string | null;
    onEpisodesButtonClick?: () => void;
    onEnterPip?: (streamUrl: string, currentTime: number, isPlaying: boolean, dimensions: DOMRect) => void;
    selectedProvider?: string | null;
    onProviderSelected?: (provider: string) => void;
    onStreamFetchStateChange?: (isFetching: boolean) => void;
    setVideoNode?: (node: HTMLVideoElement | null) => void;
    serverPreferences?: string[];
    onActiveStreamUrlChange?: (url: string) => void;
    episodes?: Episode[];
    onEpisodeSelect?: (episode: Episode) => void;
    isOffline?: boolean;
    downloadId?: string;
    isLiteMode?: boolean; 
}

/**
 * مشغل فيديو بسيط للغاية يركز على السرعة والأداء.
 * لا يوجد HLS.js، لا توجد ترجمات، لا توجد فلاتر، فقط تشغيل MP4 مباشر.
 */
const VideoPlayer: React.FC<PlayerProps> = ({ item, initialStreamUrl }) => {

    // الحالة 1: لا يوجد رابط فيديو حتى الآن، نعرض الخلفية ورسالة انتظار.
    if (!initialStreamUrl) {
        return (
            <div className="relative w-full h-full bg-black flex items-center justify-center text-white">
                {item.backdrop_path && (
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-50"
                        style={{ backgroundImage: `url(${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path})` }}
                    />
                )}
                <div className="relative z-10">
                    جاري تحضير الرابط...
                </div>
            </div>
        );
    }

    // الحالة 2: لدينا رابط فيديو، نعرض عنصر الفيديو مباشرة.
    // ✨ السر هنا: نستخدم `key={initialStreamUrl}`.
    // عندما يتغير رابط الفيديو (مثلاً عند اختيار حلقة جديدة)،
    // سيقوم React بتدمير عنصر <video> القديم وإنشاء واحد جديد بالكامل.
    // هذا يضمن إعادة تحميل المصدر بشكل نظيف وبسيط وبدون أي تعقيدات.
    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center">
            <video
                key={initialStreamUrl}
                className="w-full h-full max-w-full max-h-full"
                controls    // ⬅️ استخدم أدوات التحكم المدمجة في المتصفح، فهي الأسرع.
                autoPlay    // ⬅️ اطلب من المتصفح تشغيل الفيديو تلقائيًا.
                preload="auto" // ⬅️ اطلب من المتصفح البدء في تحميل الفيديو فورًا.
                playsInline // مهم للأجهزة المحمولة
            >
                <source src={initialStreamUrl} type="video/mp4" />
                متصفحك لا يدعم تشغيل الفيديو.
            </video>
        </div>
    );
};

export default VideoPlayer;
