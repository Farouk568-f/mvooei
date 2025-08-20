import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFromTMDB } from '../services/apiService';
import { Movie, HistoryItem, Actor, Short, LiveChannel, Trailer } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import Layout from '../components/Layout';
import { IMAGE_BASE_URL, POSTER_SIZE, BACKDROP_SIZE, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';
import { CHANNELS } from '../services/aiScheduleService';

const MovieCard: React.FC<{ movie: Movie }> = ({ movie }) => {
  const navigate = useNavigate();
  const type = movie.media_type || (movie.title ? 'movie' : 'tv');
  
  const handleClick = () => {
    navigate(`/details/${type}/${movie.id}`);
  };

  if (!movie.poster_path) return null;

  return (
    <div
      onClick={handleClick}
      className="flex-shrink-0 w-36 md:w-44 cursor-pointer"
    >
      <div className="flex flex-col overflow-hidden transition-all duration-300 ease-in-out transform rounded-md shadow-lg bg-[var(--surface)] interactive-card">
        <div className="relative">
          <img
            src={`${IMAGE_BASE_URL}${POSTER_SIZE}${movie.poster_path}`}
            srcSet={`${IMAGE_BASE_URL}w342${movie.poster_path} 342w, ${IMAGE_BASE_URL}${POSTER_SIZE}${movie.poster_path} 500w`}
            sizes="(max-width: 767px) 144px, 176px"
            alt={movie.title || movie.name}
            className="object-cover w-full h-52 md:h-60 filter brightness-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 p-2">
              <p className="text-xs text-gray-300">{movie.release_date?.substring(0,4) || movie.first_air_date?.substring(0,4)}</p>
          </div>
        </div>
        <div className="p-2 bg-black/20 backdrop-blur-sm">
            <h3 className="text-sm font-light text-white truncate">{movie.title || movie.name}</h3>
        </div>
      </div>
    </div>
  );
};

const ActorCard: React.FC<{ actor: Actor }> = ({ actor }) => {
  const navigate = useNavigate();
  if (!actor.profile_path) return null;
  return (
    <div
      onClick={() => navigate(`/actor/${actor.id}`)}
      className="flex-shrink-0 w-24 md:w-28 text-center cursor-pointer group"
    >
      <img
        src={`${IMAGE_BASE_URL}w185${actor.profile_path}`}
        alt={actor.name}
        className="w-full h-24 md:h-28 object-cover rounded-full shadow-lg transition-transform duration-300 group-hover:scale-105 border-2 border-[var(--surface)]"
        loading="lazy"
      />
      <h3 className="mt-2 text-xs font-semibold text-white truncate">{actor.name}</h3>
    </div>
  );
};

const ActorCarousel: React.FC<{ title: string; actors: Actor[] }> = ({ title, actors }) => {
  if (actors.length === 0) return null;
  return (
    <div className="my-8">
      <div className="flex items-baseline justify-between px-4 mb-4">
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto no-scrollbar px-4">
        <div className="flex flex-nowrap gap-x-5 pb-2">
          {actors.map(actor => <ActorCard key={`actor-${actor.id}`} actor={actor} />)}
        </div>
      </div>
    </div>
  );
};


const LandscapeMovieCard: React.FC<{ movie: Movie }> = ({ movie }) => {
  const navigate = useNavigate();
  const type = movie.media_type || (movie.title ? 'movie' : 'tv');

  const handleClick = () => {
    navigate(`/details/${type}/${movie.id}`);
  };

  if (!movie.backdrop_path) return null;

  return (
    <div
      onClick={handleClick}
      className="flex-shrink-0 w-[65vw] sm:w-64 md:w-72 cursor-pointer snap-start"
    >
      <div className="relative overflow-hidden transition-all duration-300 ease-in-out rounded-xl shadow-lg bg-[var(--surface)] interactive-card">
        <img
          src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`}
          srcSet={`${IMAGE_BASE_URL}w300${movie.backdrop_path} 300w, ${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path} 780w`}
          sizes="(max-width: 639px) 65vw, (max-width: 767px) 256px, 288px"
          alt={movie.title || movie.name}
          className="object-cover w-full aspect-video filter brightness-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
        <div className="absolute inset-x-0 bottom-0 p-3">
             <h3 className="text-base font-bold text-white truncate">{movie.title || movie.name}</h3>
             <p className="text-xs text-gray-400">{movie.release_date?.substring(0,4) || movie.first_air_date?.substring(0,4)}</p>
        </div>
      </div>
    </div>
  );
};

const SpotlightCard: React.FC<{ movie: Movie }> = ({ movie }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');

    const handleClick = () => {
        navigate(`/details/${type}/${movie.id}`);
    };

    if (!movie.backdrop_path) return null;

    return (
        <div onClick={handleClick} className="flex-shrink-0 w-[85vw] sm:w-96 cursor-pointer snap-center">
            <div className="relative flex flex-col justify-end w-full overflow-hidden transition-all duration-500 rounded-xl aspect-video shadow-lg interactive-card">
                <img
                    src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`}
                    srcSet={`${IMAGE_BASE_URL}w300${movie.backdrop_path} 300w, ${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path} 780w`}
                    sizes="(max-width: 639px) 85vw, 384px"
                    alt={movie.title || movie.name}
                    className="absolute inset-0 object-cover w-full h-full filter brightness-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <div className="relative z-10 p-4 space-y-2">
                    <h3 className="text-xl font-extrabold text-white truncate drop-shadow-md">{movie.title || movie.name}</h3>
                    <div className="flex items-center gap-x-3 text-sm text-gray-200">
                        <span className="flex items-center gap-1"><i className="text-yellow-400 fa-solid fa-star"></i>{movie.vote_average.toFixed(1)}</span>
                        <span>{movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4)}</span>
                        <span className="px-2 py-0.5 text-xs font-semibold uppercase border rounded-full border-white/50 bg-white/10">{t(type === 'tv' ? 'series' : 'movie')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


const HistoryCard: React.FC<{ item: HistoryItem }> = ({ item }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    navigate(`/details/${item.type}/${item.id}`);
  };

  const progress = (item.currentTime / item.duration) * 100;

  return (
    <div onClick={handleClick} className="relative flex-shrink-0 w-64 overflow-hidden rounded-xl cursor-pointer bg-[var(--surface)] transition-transform duration-300 shadow-lg interactive-card">
      <img src={item.itemImage} alt={item.title} className="object-cover w-full h-36 filter brightness-105" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
        <div className="w-full h-1.5 mt-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </div>
  );
};

const Carousel: React.FC<{ title: string; movies: Movie[]; category?: string }> = ({ title, movies, category }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    if (!movies || movies.length === 0) return null;
    return (
        <div className="my-8">
            <div className="flex items-baseline justify-between px-4 mb-4">
                <h2 className="text-xl font-bold text-white">{title}</h2>
                {category && <button onClick={() => navigate(`/all/${category}`)} className="text-sm font-medium text-[var(--primary)] transition-colors flex items-center gap-1">{t('viewAll')} <i className="text-xs fa-solid fa-chevron-right"></i></button>}
            </div>
            <div className="overflow-x-auto no-scrollbar px-4">
                <div className="flex flex-nowrap gap-x-2 pb-4">
                    {movies.map(movie => <MovieCard key={`${category || 'carousel'}-${movie.id}`} movie={movie} />)}
                </div>
            </div>
        </div>
    );
};

const LandscapeCarousel: React.FC<{ title: string; movies: Movie[]; category: string }> = ({ title, movies, category }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    return (
        <div className="my-8">
            <div className="flex items-baseline justify-between px-4 mb-4">
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <button onClick={() => navigate(`/all/${category}`)} className="text-sm font-medium text-[var(--primary)] transition-colors flex items-center gap-1">{t('viewAll')} <i className="text-xs fa-solid fa-chevron-right"></i></button>
            </div>
            <div className="overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 scroll-px-4">
                <div className="flex flex-nowrap gap-x-4 pb-4">
                    {movies.map(movie => <LandscapeMovieCard key={`${category}-${movie.id}`} movie={movie} />)}
                </div>
            </div>
        </div>
    );
};

const SpotlightCarousel: React.FC<{ title: string; movies: Movie[]; category: string }> = ({ title, movies, category }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    return (
        <div className="my-8">
            <div className="flex items-baseline justify-between px-4 mb-4">
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <button onClick={() => navigate(`/all/${category}`)} className="text-sm font-medium text-[var(--primary)] transition-colors flex items-center gap-1">{t('viewAll')} <i className="text-xs fa-solid fa-chevron-right"></i></button>
            </div>
            <div className="overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 scroll-px-4">
                <div className="flex flex-nowrap gap-x-4 pb-4">
                    {movies.map(movie => <SpotlightCard key={`${category}-${movie.id}`} movie={movie} />)}
                </div>
            </div>
        </div>
    );
};

const HistoryCarousel: React.FC<{ history: HistoryItem[] }> = ({ history }) => {
    const { t } = useTranslation();
    if (history.length === 0) return null;
    return (
        <div className="my-8">
            <h2 className="px-4 mb-4 text-xl font-bold text-white">{t('continueWatching')}</h2>
            <div className="overflow-x-auto no-scrollbar px-4">
                 <div className="flex flex-nowrap gap-x-4 pb-4">
                    {history.map(item => <HistoryCard key={item.id} item={item} />)}
                </div>
            </div>
        </div>
    );
}

const PosterSlider: React.FC<{ items: Movie[] }> = ({ items }) => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemsToShow = items.filter(item => item.backdrop_path && item.poster_path).slice(0, 10);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    resetTimeout();
    timeoutRef.current = setTimeout(
      () => setActiveIndex((prevIndex) => (prevIndex + 1) % itemsToShow.length),
      8000
    );
    return () => {
      resetTimeout();
    };
  }, [activeIndex, itemsToShow.length, resetTimeout]);

  if (itemsToShow.length === 0) {
    return (
      <div className="relative w-full h-[60vh] md:h-[90vh] max-h-[800px] mb-8 overflow-hidden bg-[var(--surface)] skeleton">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 flex items-end justify-between">
            <div className="w-2/3 md:w-1/2 space-y-4">
                <div className="w-full h-8 bg-white/10 rounded-lg"></div>
                <div className="w-3/4 h-5 bg-white/10 rounded-lg"></div>
                <div className="w-1/2 h-5 bg-white/10 rounded-lg"></div>
                <div className="w-32 h-10 mt-2 bg-white/10 rounded-full"></div>
            </div>
            <div className="w-1/3 md:w-1/4">
                <div className="w-full aspect-[2/3] bg-white/10 rounded-xl"></div>
            </div>
        </div>
      </div>
    );
  }
  
  const activeItem = itemsToShow[activeIndex];
  const type = activeItem.media_type || (activeItem.title ? 'movie' : 'tv');

  const handleDetailsClick = (item: Movie) => {
    const itemType = item.media_type || (item.title ? 'movie' : 'tv');
    navigate(`/details/${itemType}/${item.id}`);
  };

  return (
    <div className="relative w-full h-[60vh] md:h-[90vh] max-h-[800px] mb-8 overflow-hidden bg-[var(--background)]">
      {itemsToShow.map((item, index) => (
        <img
          key={item.id}
          src={`${IMAGE_BASE_URL}${BACKDROP_SIZE}${item.backdrop_path}`}
          srcSet={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path} 780w, ${IMAGE_BASE_URL}${BACKDROP_SIZE}${item.backdrop_path} 1280w`}
          sizes="100vw"
          className={`absolute inset-0 object-cover w-full h-full transition-opacity duration-1000 ease-in-out ken-burns ${index === activeIndex ? 'opacity-100' : 'opacity-0'}`}
          alt="background"
        />
      ))}
      
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/70 to-transparent"></div>
      <div className={`absolute inset-0 ${language === 'ar' ? 'bg-gradient-to-r' : 'bg-gradient-to-l'} from-[var(--background)]/70 via-transparent to-transparent`}></div>

      <div className="relative z-10 flex items-end justify-between h-full p-4 md:p-8">
        
        <div key={activeItem.id} className="w-full md:w-2/3 animate-hero-content-in pe-28 sm:pe-32 md:pe-0">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white drop-shadow-lg" style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>
            {activeItem.title || activeItem.name}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-200 drop-shadow">
            <span>{activeItem.release_date?.substring(0, 4) || activeItem.first_air_date?.substring(0, 4)}</span>
            <span className="flex items-center gap-1.5"><i className="text-yellow-400 fa-solid fa-star"></i>{activeItem.vote_average.toFixed(1)}</span>
            <span className="px-2 py-0.5 text-xs font-semibold uppercase border rounded-full border-white/50 bg-white/10">{t(type === 'tv' ? 'series' : 'movie')}</span>
          </div>
          <p className="hidden md:block mt-4 text-sm leading-relaxed text-gray-300 line-clamp-3 max-w-lg">
              {activeItem.overview}
          </p>
          <div className="flex items-center gap-3 mt-6">
            <button
                onClick={() => navigate('/player', { state: { item: activeItem, type } })}
                className="px-5 py-2.5 text-sm font-bold text-black bg-[var(--text-light)] rounded-full transition-transform md:px-8 md:py-3 md:text-base shadow-lg flex items-center justify-center gap-2 btn-press"
            >
                <i className="fa-solid fa-play"></i>
                <span>{t('play')}</span>
            </button>
            <button
                onClick={() => handleDetailsClick(activeItem)}
                className="px-5 py-2.5 text-sm font-bold text-white bg-white/10 backdrop-blur-md rounded-full transition-transform md:px-8 md:py-3 md:text-base shadow-lg flex items-center justify-center gap-2 btn-press"
            >
                <i className="fa-solid fa-circle-info"></i>
                <span>{t('details')}</span>
            </button>
          </div>
        </div>

        <div key={`${activeItem.id}-poster`} className="absolute bottom-4 end-4 md:relative md:bottom-auto md:end-auto w-24 sm:w-28 md:w-48 lg:w-56 flex-shrink-0 animate-hero-poster-in cursor-pointer" onClick={() => handleDetailsClick(activeItem)}>
            <img
                src={`${IMAGE_BASE_URL}${POSTER_SIZE}${activeItem.poster_path}`}
                srcSet={`${IMAGE_BASE_URL}w342${activeItem.poster_path} 342w, ${IMAGE_BASE_URL}${POSTER_SIZE}${activeItem.poster_path} 500w`}
                sizes="(max-width: 639px) 96px, (max-width: 767px) 112px, (max-width: 1023px) 192px, 224px"
                alt={activeItem.title || activeItem.name}
                className="object-cover w-full h-full rounded-xl shadow-2xl shadow-black/50 transition-all duration-300 border-2 border-[var(--border)]"
            />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 h-1.5 bg-white/20">
        <div key={activeIndex} className="h-full bg-[var(--primary)] animate-progress-bar" style={{ animationDuration: '8s' }}></div>
      </div>
    </div>
  );
};


const SkeletonLoader: React.FC = () => (
    <div>
        <div className="relative w-full h-[60vh] md:h-[90vh] max-h-[800px] mb-8 overflow-hidden skeleton">
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 flex items-end justify-between">
                <div className="w-2/3 md:w-1/2 space-y-4">
                    <div className="w-full h-8 sm:h-10 bg-white/10 rounded-lg"></div>
                    <div className="w-3/4 h-5 sm:h-6 bg-white/10 rounded-lg"></div>
                    <div className="w-1/2 h-5 bg-white/10 rounded-lg"></div>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="w-28 h-10 md:w-32 md:h-12 bg-white/10 rounded-full"></div>
                        <div className="w-28 h-10 md:w-32 md:h-12 bg-white/10 rounded-full"></div>
                    </div>
                </div>
                <div className="w-24 sm:w-28 md:w-48 lg:w-56 flex-shrink-0">
                    <div className="w-full aspect-[2/3] bg-white/10 rounded-xl"></div>
                </div>
            </div>
        </div>
        <div className="px-4">
            <div className="w-1/3 h-8 mb-4 skeleton rounded-md"></div>
            <div className="flex pb-4 -mx-4 overflow-x-auto no-scrollbar sm:mx-0">
                <div className="flex flex-nowrap gap-x-2 px-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex-shrink-0 w-36 md:w-44">
                        <div className="w-full h-52 md:h-60 skeleton rounded-t-md"></div>
                        <div className="w-full h-8 mt-0 skeleton rounded-b-md"></div>
                      </div>
                    ))}
                </div>
            </div>
        </div>
         <div className="px-4 mt-8">
            <div className="w-1/3 h-8 mb-4 skeleton rounded-md"></div>
            <div className="flex pb-4 -mx-4 overflow-x-auto no-scrollbar sm:mx-0">
                 <div className="flex flex-nowrap gap-x-2 px-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex-shrink-0 w-36 md:w-44">
                        <div className="w-full h-52 md:h-60 skeleton rounded-t-md"></div>
                        <div className="w-full h-8 mt-0 skeleton rounded-b-md"></div>
                      </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const ShortsCard: React.FC<{ short: Short; onClick: () => void; }> = ({ short, onClick }) => {
    if (!short.poster_path)
        return null;
    return (
        <div onClick={onClick} className="flex-shrink-0 w-28 h-48 md:w-32 md:h-52 cursor-pointer relative overflow-hidden rounded-xl shadow-lg bg-[var(--surface)] interactive-card-sm">
            <img src={`${IMAGE_BASE_URL}${POSTER_SIZE}${short.poster_path}`} alt={short.title || short.name} className="object-cover w-full h-full filter brightness-105" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 p-2">
                <h3 className="text-xs font-bold text-white truncate">{short.title || short.name}</h3>
            </div>
            <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                <i className="fa-solid fa-bolt text-xs"></i>
                SHORTS
            </div>
        </div>);
};

const ShortsCarousel: React.FC<{
    title: string;
    shorts: Short[];
}> = ({ title, shorts }) => {
    const navigate = useNavigate();
    if (shorts.length === 0)
        return null;
    const handleShortClick = (index: number) => {
        navigate('/shorts', { state: { items: shorts, startIndex: index } });
    };
    return (<div className="my-8">
            <div className="flex items-baseline justify-between px-4 mb-4">
                <h2 className="text-xl font-bold text-white">{title}</h2>
            </div>
            <div className="overflow-x-auto no-scrollbar px-4">
                <div className="flex flex-nowrap gap-x-4 pb-4">
                    {shorts.map((short, index) => (<ShortsCard key={`${short.id}-${index}`} short={short} onClick={() => handleShortClick(index)} />))}
                </div>
            </div>
        </div>);
};

const LiveChannelCard: React.FC<{ channel: LiveChannel }> = ({ channel }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div
      onClick={() => navigate(`/live-tv/${channel.id}`)}
      className="flex-shrink-0 w-60 md:w-72 cursor-pointer snap-start"
    >
      <div className="relative overflow-hidden transition-all duration-300 ease-in-out rounded-xl shadow-lg bg-[var(--surface)] interactive-card aspect-video">
        <img
          src={channel.logoUrl}
          alt={t(channel.name as any)}
          className="object-cover w-full h-full opacity-50"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
        <div className="absolute top-3 left-3 px-2.5 py-1 text-xs font-bold text-white bg-red-600 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse-live">
            {t('live')}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
             <h3 className="text-xl font-bold text-white truncate">{t(channel.name as any)}</h3>
             <p className="text-sm text-gray-300">{channel.description}</p>
        </div>
         <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 bg-black/50">
           <i className="text-5xl text-white fa-solid fa-play-circle"></i>
        </div>
      </div>
    </div>
  );
};


const LiveChannelCarousel: React.FC = () => {
    const { t } = useTranslation();
    const channels: LiveChannel[] = CHANNELS;

    if (channels.length === 0) return null;

    return (
        <div className="my-8">
            <div className="flex items-baseline justify-between px-4 mb-4">
                <h2 className="text-xl font-bold text-white">{t('cineStreamLive')}</h2>
            </div>
            <div className="overflow-x-auto no-scrollbar px-4">
                <div className="flex flex-nowrap gap-x-5 pb-4">
                    {channels.map(channel => <LiveChannelCard key={channel.id} channel={channel} />)}
                </div>
            </div>
        </div>
    );
};

const processToShorts = async (results: Movie[]): Promise<Short[]> => {
    if (!results || results.length === 0) return [];
    
    const shortsPromises = results.map(async (movie: Movie) => {
        try {
            const mediaType = movie.media_type || (movie.title ? 'movie' : 'tv');
            const videos = await fetchFromTMDB(`/${mediaType}/${movie.id}/videos`);
            const trailer = videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') || videos.results.find((v: any) => v.type === 'Teaser' && v.site === 'YouTube');
            if (trailer) {
                return {
                    id: movie.id,
                    title: movie.title || movie.name || '',
                    name: movie.name,
                    poster_path: movie.poster_path,
                    backdrop_path: movie.backdrop_path,
                    videoKey: trailer.key,
                    media_type: mediaType,
                } as Short;
            }
        }
        catch (e) {
            console.error(`Failed to fetch video for ${movie.id}`, e);
        }
        return null;
    });
    
    return (await Promise.all(shortsPromises)).filter((s): s is Short => s !== null).slice(0, 10);
};

const TrailerCard: React.FC<{ trailer: Trailer }> = ({ trailer }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/player', { state: { item: trailer.fullItem, type: trailer.media_type, youtubeVideoId: trailer.youtubeKey } });
  };

  return (
    <div onClick={handleClick} className="flex-shrink-0 w-[65vw] sm:w-64 md:w-72 cursor-pointer snap-start group">
      <div className="relative overflow-hidden transition-all duration-300 ease-in-out rounded-xl shadow-lg bg-[var(--surface)] interactive-card">
        <img
          src={trailer.youtubeThumbnailUrl}
          alt={trailer.title}
          className="object-cover w-full aspect-video filter brightness-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 opacity-80 group-hover:opacity-100 group-hover:scale-110">
          <i className="fa-brands fa-youtube text-red-600 text-6xl" style={{ textShadow: '0 0 10px rgba(0,0,0,0.5)' }}></i>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-bold text-white truncate text-base">{trailer.title}</h3>
        </div>
      </div>
    </div>
  );
};

const TrailerCarousel: React.FC<{ title: string; trailers: Trailer[] }> = ({ title, trailers }) => {
  if (trailers.length === 0) return null;
  return (
    <div className="my-8">
      <h2 className="px-4 mb-4 text-xl font-bold text-white">{title}</h2>
      <div className="overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 scroll-px-4">
        <div className="flex flex-nowrap gap-x-4 pb-4">
          {trailers.map(trailer => <TrailerCard key={trailer.id} trailer={trailer} />)}
        </div>
      </div>
    </div>
  );
};

const processToTrailers = async (results: Movie[]): Promise<Trailer[]> => {
    if (!results || results.length === 0) return [];
    
    const trailersPromises = results.map(async (movie: Movie) => {
        try {
            const mediaType = movie.media_type || (movie.title ? 'movie' : 'tv');
            const videos = await fetchFromTMDB(`/${mediaType}/${movie.id}/videos`);
            const trailer = videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') || videos.results.find((v: any) => v.type === 'Teaser' && v.site === 'YouTube') || videos.results.find((v: any) => v.site === 'YouTube');
            if (trailer && trailer.site === 'YouTube') {
                return {
                    id: movie.id,
                    title: movie.title || movie.name || '',
                    name: movie.name,
                    backdrop_path: movie.backdrop_path,
                    youtubeKey: trailer.key,
                    youtubeThumbnailUrl: `https://i.ytimg.com/vi/${trailer.key}/hqdefault.jpg`,
                    media_type: mediaType,
                    fullItem: movie,
                } as Trailer;
            }
        }
        catch (e) {
            console.error(`Failed to fetch video for ${movie.id}`, e);
        }
        return null;
    });
    
    return (await Promise.all(trailersPromises)).filter((t): t is Trailer => t !== null).slice(0, 10);
};


const HomePage: React.FC = () => {
  const [data, setData] = useState<{ popular: Movie[], topRated: Movie[], series: Movie[], featured: Movie[], upcoming: Movie[], nowPlaying: Movie[], trendingWeek: Movie[], popularActors: Actor[] }>({ popular: [], topRated: [], series: [], featured: [], upcoming: [], nowPlaying: [], trendingWeek: [], popularActors: [] });
  const [shortsData, setShortsData] = useState<{ movieShorts: Short[], tvShorts: Short[] }>({ movieShorts: [], tvShorts: [] });
  const [netflixTrailers, setNetflixTrailers] = useState<Trailer[]>([]);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [followedMovies, setFollowedMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const { getScreenSpecificData, isKidsMode, activeProfile } = useProfile();
  const { t } = useTranslation();
  const history = getScreenSpecificData('history', []);

  useEffect(() => {
    const fetchTasteRecommendations = async () => {
        if (activeProfile?.tastePreferences && activeProfile.tastePreferences.length > 0) {
            const randomMovieId = activeProfile.tastePreferences[Math.floor(Math.random() * activeProfile.tastePreferences.length)];
            try {
                const res = await fetchFromTMDB(`/movie/${randomMovieId}/recommendations`);
                if (res.results && res.results.length > 0) {
                    setRecommendations(res.results.filter((m: Movie) => m.poster_path));
                }
            } catch (err) { console.error("Failed to fetch taste-based recommendations", err); }
        }
    };
    
    const fetchFollowedActorsContent = async () => {
        const followedActorIds = activeProfile?.followedActors || [];
        if (followedActorIds.length > 0) {
            try {
                const promises = followedActorIds.slice(0, 3).map(id => fetchFromTMDB(`/person/${id}/combined_credits`));
                const results = await Promise.all(promises);
                const movies = results
                    .flatMap(res => res.cast || [])
                    .filter((m: Movie) => m.poster_path && (m.media_type === 'movie' || m.media_type === 'tv'))
                    .sort(() => 0.5 - Math.random()) // Shuffle
                    .slice(0, 15);
                
                // Avoid duplicates
                const uniqueMovies = Array.from(new Map(movies.map(m => [m.id, m])).values());
                setFollowedMovies(uniqueMovies);
            } catch (err) { console.error("Failed to fetch followed actors content", err); }
        }
    };

    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchTasteRecommendations(), fetchFollowedActorsContent()]);

        let popularMoviesPromise, topRatedMoviesPromise, seriesPromise, featuredPromise, upcomingPromise, nowPlayingPromise, trendingWeekPromise, popularActorsPromise, movieShortsPromise, tvShortsPromise, netflixPromise;

        if (isKidsMode) {
          const kidsParams = { 'certification_country': 'US', 'certification.lte': 'PG', sort_by: 'popularity.desc' };
          popularMoviesPromise = fetchFromTMDB('/discover/movie', { ...kidsParams, with_genres: '16,10751' });
          topRatedMoviesPromise = fetchFromTMDB('/discover/movie', { ...kidsParams, with_genres: '16,10751', sort_by: 'vote_average.desc', 'vote_count.gte': 50 });
          seriesPromise = fetchFromTMDB('/discover/tv', { ...kidsParams, with_genres: '10762,16' });
          featuredPromise = popularMoviesPromise;
          upcomingPromise = fetchFromTMDB('/discover/movie', { ...kidsParams, with_genres: '16,10751', sort_by: 'primary_release_date.desc' });
          nowPlayingPromise = popularMoviesPromise;
          trendingWeekPromise = popularMoviesPromise;
          popularActorsPromise = Promise.resolve({ results: [] });
          movieShortsPromise = fetchFromTMDB('/discover/movie', { ...kidsParams, with_genres: '16,10751' });
          tvShortsPromise = Promise.resolve({ results: [] });
          netflixPromise = Promise.resolve({ results: [] });
        } else {
          popularMoviesPromise = fetchFromTMDB('/movie/popular');
          topRatedMoviesPromise = fetchFromTMDB('/movie/top_rated');
          seriesPromise = fetchFromTMDB('/tv/popular');
          featuredPromise = fetchFromTMDB('/trending/all/day');
          upcomingPromise = fetchFromTMDB('/movie/upcoming');
          nowPlayingPromise = fetchFromTMDB('/movie/now_playing');
          trendingWeekPromise = fetchFromTMDB('/trending/movie/week');
          popularActorsPromise = fetchFromTMDB('/person/popular');
          movieShortsPromise = fetchFromTMDB('/trending/movie/day');
          tvShortsPromise = fetchFromTMDB('/trending/tv/day');
          netflixPromise = fetchFromTMDB('/discover/tv', { with_networks: '213', sort_by: 'popularity.desc' });
        }

        const [popularRes, topRatedRes, seriesRes, featuredRes, upcomingRes, nowPlayingRes, trendingWeekRes, popularActorsRes, movieShortsRes, tvShortsRes, netflixRes] = await Promise.all([
          popularMoviesPromise,
          topRatedMoviesPromise,
          seriesPromise,
          featuredPromise,
          upcomingPromise,
          nowPlayingPromise,
          trendingWeekPromise,
          popularActorsPromise,
          movieShortsPromise,
          tvShortsPromise,
          netflixPromise
        ]);
        
        setData({
          popular: popularRes.results || [],
          topRated: topRatedRes.results || [],
          series: seriesRes.results || [],
          featured: featuredRes.results || [],
          upcoming: upcomingRes.results || [],
          nowPlaying: nowPlayingRes.results || [],
          trendingWeek: trendingWeekRes.results || [],
          popularActors: popularActorsRes.results || [],
        });
        
        const [movieShorts, tvShorts, trailers] = await Promise.all([
            processToShorts(movieShortsRes.results || []),
            processToShorts(tvShortsRes.results || []),
            processToTrailers(netflixRes.results || [])
        ]);
        setShortsData({ movieShorts, tvShorts });
        setNetflixTrailers(trailers);

      } catch (error) {
        console.error("Failed to fetch home page data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (activeProfile) {
        fetchData();
    }
  }, [isKidsMode, activeProfile]);
  
  return (
    <Layout>
      {loading ? (
        <SkeletonLoader />
      ) : (
        <>
            <PosterSlider items={data.featured} />
            {!isKidsMode && <TrailerCarousel title={t('newThisWeek', {defaultValue: 'New This Week'})} trailers={netflixTrailers} />}
            {shortsData.movieShorts.length > 0 && <ShortsCarousel title={t('movieShorts')} shorts={shortsData.movieShorts} />}
            {!isKidsMode && followedMovies.length > 0 && <Carousel title={t('fromActorsYouFollow')} movies={followedMovies} />}
            {recommendations.length > 0 && <Carousel title={t('pickedForYou')} movies={recommendations} />}
            {!isKidsMode && data.trendingWeek.length > 0 && <Carousel title={t('trendingThisWeek')} movies={data.trendingWeek} category="trending_week" />}
            <Carousel title={t(isKidsMode ? 'popularKidsMovies' : 'popularMovies')} movies={data.popular} category="popular" />
            {!isKidsMode && <HistoryCarousel history={history} />}
            <LandscapeCarousel title={t('upcoming')} movies={data.upcoming} category="upcoming" />
            <Carousel title={t(isKidsMode ? 'topRatedKidsMovies' : 'topRated')} movies={data.topRated} category="top_rated" />
            {!isKidsMode && <ActorCarousel title={t('discoverActors')} actors={data.popularActors} />}
            <SpotlightCarousel title={t('nowPlaying')} movies={data.nowPlaying} category="now_playing" />
            <Carousel title={t(isKidsMode ? 'popularKidsShows' : 'popularSeries')} movies={data.series} category="series" />
            {!isKidsMode && <LiveChannelCarousel />}
            {shortsData.tvShorts.length > 0 && <ShortsCarousel title={t('tvShorts')} shorts={shortsData.tvShorts} />}
        </>
      )}
    </Layout>
  );
};

export default HomePage;