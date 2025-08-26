
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFromTMDB } from '../services/apiService';
import { Movie } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { TranslationKey } from '../translations';
import { IMAGE_BASE_URL, POSTER_SIZE } from '../contexts/constants';
import { BottomNavbar } from '../components/Layout';
import { useProfile } from '../contexts/ProfileContext';

const MovieCard: React.FC<{ movie: Movie }> = ({ movie }) => {
  const navigate = useNavigate();
  const type = 'movie';
  
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
            alt={movie.title || movie.name}
            className="object-cover w-full h-52 md:h-60 filter brightness-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
           <p className="absolute bottom-1 left-2 text-xs text-gray-300">{movie.release_date?.substring(0,4)}</p>
        </div>
        <div className="p-2 bg-black/20 backdrop-blur-sm">
            <h3 className="text-sm font-light text-white truncate">{movie.title || movie.name}</h3>
        </div>
      </div>
    </div>
  );
};

const Carousel: React.FC<{ title: string; movies: Movie[]; }> = ({ title, movies }) => {
    if (!movies || movies.length === 0) return null;
    return (
        <div className="my-6 animate-fade-in-up">
            <div className="flex items-baseline justify-between px-4 mb-3">
                <h2 className="text-xl font-bold text-white">{title}</h2>
            </div>
            <div className="overflow-x-auto no-scrollbar">
                <div className="flex flex-nowrap gap-x-3 pb-2 px-4">
                    {movies.map(movie => <MovieCard key={`movie-carousel-${movie.id}`} movie={movie} />)}
                </div>
            </div>
        </div>
    );
};

interface MovieCategory {
  name: TranslationKey;
  image: string;
  gradient: string;
  filterState?: {
    country?: string;
    sort?: string;
  };
  isAllCard?: boolean;
}

const movieCategories: MovieCategory[] = [
  {
    name: 'all',
    image: '',
    gradient: 'bg-zinc-800',
    isAllCard: true,
  },
  {
    name: 'trending',
    image: 'https://pacdn.aoneroom.com/image/2025/04/02/63a1a0ea3a5671b3febab182f0a3658a.jpg',
    gradient: 'linear-gradient(270deg, rgba(102, 50, 39, 0.5) 0%, rgb(117, 54, 40) 94.29%)',
    filterState: { sort: 'trending' }
  },
  {
    name: 'latest',
    image: 'https://pacdn.aoneroom.com/image/2025/04/02/f7a054227172c2f5b12834333b963620.jpg',
    gradient: 'linear-gradient(270deg, rgba(59, 70, 82, 0.5) 0%, rgb(55, 68, 82) 94.29%)',
    filterState: { sort: 'latest' }
  },
    {
    name: 'hollywood',
    image: 'https://pacdn.aoneroom.com/image/2025/04/02/3c7c1a1a91051fcad894d46ab3ae86bb.jpg',
    gradient: 'linear-gradient(270deg, rgba(36, 58, 86, 0.5) 0%, rgb(32, 57, 86) 94.29%)',
    filterState: { country: 'US' }
  },
  {
    name: 'bollywood',
    image: 'https://pacdn.aoneroom.com/image/2025/04/02/7dc1bebfb7826a9a8023102dbcecff22.jpg',
    gradient: 'linear-gradient(270deg, rgba(72, 54, 73, 0.5) 0%, rgb(71, 52, 73) 94.29%)',
    filterState: { country: 'IN' }
  },
];

const CategoryCard: React.FC<{ category: MovieCategory }> = ({ category }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/filter/movie`, { state: category.filterState });
  };
  
  const filterIconSvg = `data:image/svg+xml,%3csvg%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M4%203.25C3.72104%203.25%203.46513%203.40482%203.33567%203.65192C3.2062%203.89902%203.22457%204.19755%203.38336%204.42691L7.75%2010.7343V18C7.75%2018.3067%207.93672%2018.5825%208.22146%2018.6964L13.2215%2020.6964C13.4525%2020.7888%2013.7144%2020.7606%2013.9205%2020.621C14.1266%2020.4815%2014.25%2020.2489%2014.25%2020V10.7343L18.6166%204.42691C18.7754%204.19755%2018.7938%203.89902%2018.6643%203.65192C18.5349%203.40482%2018.279%203.25%2018%203.25H4ZM9.11665%2010.0731L5.43143%204.75H16.5686L12.8834%2010.0731C12.7965%2010.1985%2012.75%2010.3474%2012.75%2010.5V18.8922L9.25%2017.4922V10.5C9.25%2010.3474%209.20348%2010.1985%209.11665%2010.0731ZM17%2011.25C16.5858%2011.25%2016.25%2011.5858%2016.25%2012C16.25%2012.4142%2016.5858%2012.75%2017%2012.75H20C20.4142%2012.75%2020.75%2012.4142%2020.75%2012C20.75%2011.5858%2020.4142%2011.25%2020%2011.25H17ZM16.25%2015C16.25%2014.5858%2016.5858%2014.25%2017%2014.25H20C20.4142%2014.25%2020.75%2014.5858%2020.75%2015C20.75%2015.4142%2020.4142%2015.75%2020%2015.75H17C16.5858%2015.75%2016.25%2015.4142%2016.25%2015ZM17%2017.25C16.5858%2017.25%2016.25%2017.5858%2016.25%2018C16.25%2018.4142%2016.5858%2018.75%2017%2018.75H20C20.4142%2018.75%2020.75%2018.4142%2020.75%2018C20.75%2017.5858%2020.4142%2017.25%2020%2017.25H17Z'%20fill='white'/%3e%3c/svg%3e`;

  const backgroundStyle = category.isAllCard ? {} : {
    background: `${category.gradient}, url("${category.image}") 50% center / cover no-repeat lightgray`,
  };
  
  const cardClasses = "flex-shrink-0 w-48 h-24 rounded-xl overflow-hidden cursor-pointer interactive-card-sm flex items-center justify-center relative";

  if (category.isAllCard) {
    return (
      <div onClick={handleClick} className={`${cardClasses} bg-zinc-800`}>
        <div className="w-full flex items-center justify-between px-4">
          <h3 className="text-white font-bold text-lg">{t(category.name)}</h3>
          <img src={filterIconSvg} className="w-6 h-6" alt="filter icon" />
        </div>
      </div>
    );
  }

  return (
    <div onClick={handleClick} className={cardClasses} style={backgroundStyle}>
      <div className="w-full flex items-center justify-start px-4">
        <h3 className="text-white font-bold text-lg">{t(category.name)}</h3>
      </div>
    </div>
  );
};

const CategoryCarousel: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="pt-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-4 px-4">{t('categories')}</h2>
            <div className="overflow-x-auto no-scrollbar">
                <div className="flex flex-nowrap gap-3 pb-2 px-4">
                    {movieCategories.map(cat => (
                        <CategoryCard key={cat.name} category={cat} />
                    ))}
                </div>
            </div>
        </div>
    );
};


const SkeletonLoader: React.FC = () => (
    <div className="pt-6">
        <div className="h-8 w-1/3 mb-4 skeleton rounded-md px-4"></div>
        <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-3 px-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-48 h-24 skeleton rounded-xl"></div>
                ))}
            </div>
        </div>
        <div className="mt-8 px-4">
            <div className="h-8 w-1/2 mb-4 skeleton rounded-md"></div>
            <div className="flex gap-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-36">
                        <div className="w-full h-52 skeleton rounded-md"></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const MoviesPage: React.FC = () => {
    const [data, setData] = useState({ popular: [], topRated: [], upcoming: [], nowPlaying: [] });
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();
    const { isKidsMode } = useProfile();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const kidsParams = isKidsMode ? { 
                    'certification_country': 'US', 
                    'certification.lte': 'PG',
                    'with_genres': '16,10751' // Animation & Family
                } : {};
                
                const endpointSuffix = isKidsMode ? '/discover/movie' : '/movie';

                const [popularRes, topRatedRes, upcomingRes, nowPlayingRes] = await Promise.all([
                    fetchFromTMDB(`${endpointSuffix}/${isKidsMode ? '' : 'popular'}`, kidsParams),
                    fetchFromTMDB(`${endpointSuffix}/${isKidsMode ? '' : 'top_rated'}`, { ...kidsParams, sort_by: 'vote_average.desc' }),
                    fetchFromTMDB(`${endpointSuffix}/${isKidsMode ? '' : 'upcoming'}`, { ...kidsParams, sort_by: 'primary_release_date.desc' }),
                    fetchFromTMDB(`${endpointSuffix}/${isKidsMode ? '' : 'now_playing'}`, kidsParams)
                ]);

                setData({
                    popular: popularRes.results || [],
                    topRated: topRatedRes.results || [],
                    upcoming: upcomingRes.results || [],
                    nowPlaying: nowPlayingRes.results || [],
                });
            } catch (error) {
                console.error("Failed to fetch movies page data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [isKidsMode]);

    return (
        <div className="bg-[#101010] min-h-screen text-white pb-20">
            {loading ? <SkeletonLoader /> : (
                <>
                    <CategoryCarousel />
                    <Carousel title={t('popularMovies')} movies={data.popular} />
                    <Carousel title={t('topRated')} movies={data.topRated} />
                    <Carousel title={t('upcoming')} movies={data.upcoming} />
                    <Carousel title={t('nowPlaying')} movies={data.nowPlaying} />
                </>
            )}
            <BottomNavbar />
        </div>
    );
};

export default MoviesPage;
