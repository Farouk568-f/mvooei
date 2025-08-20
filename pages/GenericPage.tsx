import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import Layout from '../components/Layout';
import { fetchFromTMDB } from '../services/apiService';
import { Movie, FavoriteItem, DownloadItem } from '../types';
import { IMAGE_BASE_URL, POSTER_SIZE } from '../contexts/constants';

const SearchResultItem: React.FC<{ item: Movie, genreMap: Map<number, string> }> = ({ item, genreMap }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const type = item.media_type || (item.title ? 'movie' : 'tv');

    const handleClick = () => {
        navigate(`/details/${type}/${item.id}`);
    };
    
    const genreIds = (item as any).genre_ids || [];
    const genre = genreIds.length > 0 ? genreMap.get(genreIds[0]) : (item.media_type === 'tv' ? 'Animation' : 'Drama');

    return (
        <div onClick={handleClick} className="flex items-center gap-4 p-2 mx-2 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors duration-200">
            <img src={item.poster_path ? `${IMAGE_BASE_URL}w342${item.poster_path}` : 'https://via.placeholder.com/150x225'} alt={item.title || item.name} className="w-[70px] h-[100px] object-cover rounded-md flex-shrink-0 bg-zinc-800" />
            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-white truncate">{item.title || item.name}</h3>
                <div className="flex items-center gap-x-2.5 text-xs text-zinc-400 mt-1.5 flex-wrap">
                    {item.media_type === 'tv' ?
                        <i className="fa-solid fa-tv"></i> :
                        <i className="fa-solid fa-film"></i>
                    }
                    {item.vote_average > 0 && 
                        <span className="flex items-center gap-1">
                            <i className="fa-solid fa-star text-yellow-500 text-[10px]"></i>
                            {item.vote_average.toFixed(1)}
                        </span>
                    }
                    <span>{item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4)}</span>
                    {genre && <span>{genre}</span>}
                </div>
            </div>
            <button aria-label={t('play')} className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-700/80 hover:bg-zinc-700 transition-colors flex-shrink-0">
                <i className="fa-solid fa-play text-white text-sm"></i>
            </button>
        </div>
    );
};

const fetchGenres = async () => {
    try {
        const movieGenresPromise = fetchFromTMDB('/genre/movie/list');
        const tvGenresPromise = fetchFromTMDB('/genre/tv/list');
        const [movieGenres, tvGenres] = await Promise.all([movieGenresPromise, tvGenresPromise]);
        
        const genreMap = new Map<number, string>();
        [...(movieGenres.genres || []), ...(tvGenres.genres || [])].forEach(genre => {
            genreMap.set(genre.id, genre.name);
        });
        return genreMap;
    } catch (error) {
        console.error("Failed to fetch genres:", error);
        return new Map<number, string>();
    }
};

const ItemCard: React.FC<{ item: Movie | FavoriteItem, onDelete?: (item: Movie | FavoriteItem) => void, index: number }> = ({ item, onDelete, index }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const id = item.id;
    const title = item.title || item.name;
    const posterUrl = 'poster_path' in item && item.poster_path ? `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}` : ('poster' in item ? item.poster : undefined);
    const posterPath = 'poster_path' in item && item.poster_path ? item.poster_path : null;
    const type = 'media_type' in item && item.media_type ? item.media_type : ('type' in item ? item.type : (item.title ? 'movie' : 'tv'));
    const year = ('release_date' in item && item.release_date && item.release_date.length > 0)
        ? item.release_date.substring(0, 4)
        : (('first_air_date' in item && item.first_air_date && item.first_air_date.length > 0) ? item.first_air_date.substring(0, 4) : '');

    if (!posterUrl) return null;

    return (
        <div 
            className="w-full animate-grid-item cursor-pointer" 
            style={{ animationDelay: `${index * 30}ms` }}
            onClick={() => navigate(`/details/${type}/${id}`)}
        >
            <div className="relative overflow-hidden transition-all duration-300 ease-in-out rounded-xl shadow-lg bg-[var(--surface)] interactive-card">
                 <img
                    src={posterUrl}
                    srcSet={posterPath ? `${IMAGE_BASE_URL}w342${posterPath} 342w, ${IMAGE_BASE_URL}${POSTER_SIZE}${posterPath} 500w` : undefined}
                    sizes="(max-width: 639px) 46vw, (max-width: 767px) 30vw, (max-width: 1023px) 22vw, (max-width: 1279px) 18vw, 15vw"
                    alt={title}
                    className="object-cover w-full aspect-[2/3] filter brightness-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                 {onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                        className="absolute z-10 flex items-center justify-center w-8 h-8 text-white transition-opacity bg-red-600 rounded-full top-2 end-2 opacity-80 hover:opacity-100"
                        aria-label={t('deleteItem', {title: title || ''})}
                    >
                        <i className="text-sm fa-solid fa-trash-can"></i>
                    </button>
                 )}
                 {item.vote_average > 0 && (
                    <div className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 text-white bg-black/60 rounded-full text-xs font-bold border border-white/50 backdrop-blur-sm">
                        {item.vote_average.toFixed(1)}
                    </div>
                )}
                 <div className="absolute bottom-0 left-0 right-0 p-2">
                    <h3 className="text-sm font-bold text-white truncate">{title}</h3>
                    <div className="flex items-center justify-between mt-1 text-xs text-gray-300">
                        <span>{year}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase border rounded-full border-white/20 bg-white/10">{t(type === 'tv' ? 'series' : 'movie')}</span>
                    </div>
                 </div>
            </div>
        </div>
    );
};

const SuggestionCarousel: React.FC<{ title: string; items: Movie[] }> = React.memo(({ title, items }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="my-4">
            <h2 className="text-xl font-bold text-white px-4 mb-3">{title}</h2>
            <div className="overflow-x-auto no-scrollbar">
                <div className="flex flex-nowrap gap-x-4 pb-2 px-4">
                    {items.slice(0, 10).map((movie, index) => (
                        <div key={`${title}-${movie.id}`} className="flex-shrink-0 w-32">
                            <ItemCard item={movie} index={index} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

interface LastSearchesProps {
    lastSearches: Movie[];
    onClear: () => void;
    onSearch: (query: string) => void;
}

const LastSearches: React.FC<LastSearchesProps> = React.memo(({ lastSearches, onClear, onSearch }) => {
    const { t } = useTranslation();
    if (lastSearches.length === 0) return null;
    
    return (
        <div className="px-4 my-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white">{t('recentSearches')}</h2>
                <button onClick={() => onClear()} className="text-sm text-zinc-400 hover:text-white">{t('clear')}</button>
            </div>
            <div className="flex flex-wrap gap-2">
                {lastSearches.map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => onSearch(item.title || item.name || '')} 
                        className="px-3 py-1.5 text-sm bg-zinc-800 text-zinc-300 rounded-full hover:bg-zinc-700 transition-colors">
                        {item.title || item.name}
                    </button>
                ))}
            </div>
        </div>
    );
});

function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

const placeholderExamples = ["breaking bad", "dexter", "the office", "interstellar", "attack on titan"];

const GenericPage: React.FC<{
    pageType: 'favorites' | 'downloads' | 'search' | 'all' | 'subscriptions' | 'filter',
    title: string
}> = ({ pageType, title }) => {
    const { getScreenSpecificData, toggleFavorite, addLastSearch, clearLastSearches, removeDownload } = useProfile();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [content, setContent] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { category, mediaType } = useParams<{category: string, mediaType: 'movie' | 'tv'}>();

    // Search page specific state
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Movie[]>([]);
    const [searchGenreMap, setSearchGenreMap] = useState<Map<number, string>>(new Map());
    const [popularSearches, setPopularSearches] = useState<Movie[]>([]);
    const [bestSeries, setBestSeries] = useState<Movie[]>([]);
    const lastSearches = getScreenSpecificData('lastSearches', []);
    const [showSuggestions, setShowSuggestions] = useState(true);

    // Filter page specific state
    const locationState = location.state as { genreId?: string, country?: string, sort?: string } | undefined;
    const [filterMediaType, setFilterMediaType] = useState<'movie' | 'tv'>(mediaType || 'movie');
    const [isAnimation, setIsAnimation] = useState(false);
    const [genres, setGenres] = useState<{id: number, name: string}[]>([]);
    const [selectedGenre, setSelectedGenre] = useState(locationState?.genreId || '');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(locationState?.country || '');
    const [sortOrder, setSortOrder] = useState(locationState?.sort || '');
    const [filterResults, setFilterResults] = useState<Movie[]>([]);
    const [filterPage, setFilterPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observer = useRef<IntersectionObserver>();
    const lastElementRef = useCallback((node: HTMLDivElement) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setFilterPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);


    // Animated placeholder state
    const [placeholder, setPlaceholder] = useState('');
    const [isInputFocused, setIsInputFocused] = useState(false);

    useEffect(() => {
        if (!searchTerm) {
            setShowSuggestions(true);
        }
    }, [searchTerm]);

    useEffect(() => {
        if (pageType !== 'search' || isInputFocused || searchTerm) {
            return;
        }

        let currentExampleIndex = 0;
        let currentCharIndex = 0;
        let isDeleting = false;
        let timeoutId: ReturnType<typeof setTimeout>;

        function type() {
            const currentExample = placeholderExamples[currentExampleIndex];
            if (isDeleting) {
                currentCharIndex--;
            } else {
                currentCharIndex++;
            }

            setPlaceholder(currentExample.substring(0, currentCharIndex));

            if (!isDeleting && currentCharIndex === currentExample.length) {
                isDeleting = true;
                timeoutId = setTimeout(type, 1500);
            } else if (isDeleting && currentCharIndex === 0) {
                isDeleting = false;
                currentExampleIndex = (currentExampleIndex + 1) % placeholderExamples.length;
                timeoutId = setTimeout(type, 500);
            } else {
                timeoutId = setTimeout(type, isDeleting ? 60 : 120);
            }
        }
        
        timeoutId = setTimeout(type, 500);
        return () => clearTimeout(timeoutId);
    }, [pageType, isInputFocused, searchTerm]);


    const performSearch = useCallback(async (query: string) => {
        if (query.trim().length === 0) {
            setSearchResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const searchRes = await fetchFromTMDB('/search/multi', { query });
            const combined = searchRes.results
                .filter((item: Movie) => item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv'))
                .sort((a: Movie, b: Movie) => (b.popularity ?? 0) - (a.popularity ?? 0));

            setSearchResults(combined);
            if(combined[0]) addLastSearch(combined[0]);
        } catch (error) {
            console.error("Search failed", error);
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    }, [addLastSearch]);
    
    useEffect(() => {
        if (pageType === 'search') {
            fetchGenres().then(setSearchGenreMap);
            const fetchSuggestions = async () => {
                try {
                    const [popularRes, seriesRes] = await Promise.all([
                        fetchFromTMDB('/trending/all/week'),
                        fetchFromTMDB('/tv/top_rated')
                    ]);
                    setPopularSearches(popularRes.results?.filter((i: Movie) => i.poster_path) || []);
                    setBestSeries(seriesRes.results?.filter((i: Movie) => i.poster_path) || []);
                } catch (error) {
                    console.error("Failed to fetch search page suggestions:", error);
                }
            };
            fetchSuggestions();
        }
    }, [pageType]);

    const loadContent = useCallback(async () => {
        if (pageType === 'search' || pageType === 'filter') return;
        setLoading(true);
        try {
            switch (pageType) {
                case 'favorites':
                    setContent([...getScreenSpecificData('favorites', [])].reverse());
                    break;
                case 'downloads':
                    setContent(getScreenSpecificData('downloads', []));
                    break;
                case 'subscriptions':
                    setContent([]); 
                    break;
                case 'all':
                    if (category) {
                        let endpoint = '';
                        switch(category) {
                            case 'series':
                                endpoint = '/tv/popular';
                                break;
                            case 'trending_week':
                                endpoint = '/trending/movie/week';
                                break;
                            default:
                                endpoint = `/movie/${category}`;
                        }
                        const allRes = await fetchFromTMDB(endpoint);
                        setContent(allRes.results || []);
                    }
                    break;
            }
        } catch (error) {
            console.error(`Failed to load content for ${pageType}`, error);
        } finally {
            setLoading(false);
        }
    }, [pageType, category, getScreenSpecificData]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);
    
    const debouncedSearch = useMemo(() => debounce(performSearch, 300), [performSearch]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        debouncedSearch(e.target.value);
    };

      const handleFavoriteDelete = (item: Movie | FavoriteItem) => {
    toggleFavorite(item);
    setContent(prev => prev.filter(c => c.id !== item.id));
  };

  const handleDownloadPlay = (item: DownloadItem) => {
    if (!item.completed) return;
    navigate('/player', { 
      state: { 
        item: { 
          id: item.originalId, // Use original TMDB ID, not download ID
          title: item.title, 
          name: item.title, 
          poster_path: null, 
          backdrop_path: null, 
          overview: '', 
          vote_average: 0, 
          vote_count: 0 
        }, 
        type: item.originalType, 
        isOffline: true,
        downloadId: item.id 
      } 
    });
  };

  const handleDownloadDelete = (item: DownloadItem) => {
    removeDownload(item.title);
    setContent(prev => prev.filter(c => (c as any).title !== item.title));
  };

    const handleLastSearchClick = useCallback((query: string) => {
        setSearchTerm(query);
        performSearch(query);
    }, [performSearch]);


    // Filter page logic
    useEffect(() => {
        if (pageType !== 'filter') return;
        setFilterResults([]);
        setFilterPage(1);
        setHasMore(true);
    }, [pageType, filterMediaType, isAnimation, selectedGenre, selectedYear, selectedCountry, sortOrder]);

    useEffect(() => {
        if (pageType !== 'filter') return;
        const fetchFilterData = async () => {
            setLoading(true);
            const params: any = { page: filterPage };
            
            if (sortOrder === 'trending') {
                params.sort_by = 'popularity.desc';
            } else if (sortOrder === 'latest') {
                 params.sort_by = filterMediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
            }

            let with_genres = selectedGenre ? [selectedGenre] : [];
            if (isAnimation) {
                 if (!with_genres.includes('16')) with_genres.push('16');
            }
            if (with_genres.length > 0) {
                params.with_genres = with_genres.join(',');
            }
            if (selectedYear) {
                 if (filterMediaType === 'movie') params.primary_release_year = selectedYear;
                 else params.first_air_date_year = selectedYear;
            }
            if(selectedCountry) {
                params.with_origin_country = selectedCountry;
            }

            try {
                const data = await fetchFromTMDB(`/discover/${filterMediaType}`, params);
                setFilterResults(prev => filterPage === 1 ? (data.results || []) : [...prev, ...(data.results || [])]);
                setHasMore(data.page < data.total_pages);
            } catch (err) {
                console.error("Error fetching filter data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchFilterData();
    }, [pageType, filterMediaType, isAnimation, selectedGenre, selectedYear, selectedCountry, filterPage, sortOrder]);

    useEffect(() => {
        if (pageType !== 'filter') return;
        const fetchGenreList = async () => {
            const data = await fetchFromTMDB(`/genre/${filterMediaType}/list`);
            setGenres(data.genres);
        };
        fetchGenreList();
    }, [pageType, filterMediaType]);
    
    const displayTitle = useMemo(() => {
        if (pageType === 'all' && category) {
            const categoryName = t(category as any, { defaultValue: category.replace(/_/g, ' ') });
            return t('allCategory', { category: categoryName });
        }
        return title;
    }, [pageType, category, title, t]);
    
    if (pageType === 'filter') {
        const years = Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i);
        const countries = [
            {code: 'US', name: 'USA'}, {code: 'GB', name: 'UK'}, {code: 'KR', name: 'Korea'}, 
            {code: 'JP', name: 'Japan'}, {code: 'FR', name: 'France'}, {code: 'IN', name: 'India'}
        ];
        
        return (
            <div className="bg-[#101010] min-h-screen text-white">
                <header className="sticky top-0 z-30 bg-[#141414] border-b border-zinc-800">
                    <div className="flex items-center gap-4 p-3">
                        <button onClick={() => navigate(-1)} className="w-8 h-8"><i className="fas fa-arrow-left text-xl"></i></button>
                        <h1 className="text-xl font-bold">{t('filter')}</h1>
                    </div>
                    <div className="flex items-center justify-center border-b border-zinc-800">
                        {['movie', 'tv', 'animation'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => {
                                    if (tab === 'animation') {
                                        setIsAnimation(true);
                                        setFilterMediaType('movie');
                                    } else {
                                        setIsAnimation(false);
                                        setFilterMediaType(tab as 'movie' | 'tv');
                                    }
                                }}
                                className={`px-4 py-2 text-sm font-semibold transition-colors ${ (isAnimation && tab === 'animation') || (!isAnimation && filterMediaType === tab) ? 'text-white border-b-2 border-white' : 'text-zinc-400'}`}
                            >
                                {t((tab === 'tv' ? 'series' : tab) as any)}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar">
                        {/* Genre */}
                        <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)} className="bg-zinc-800 rounded px-3 py-1.5 text-sm">
                            <option value="">{t('genre')}</option>
                            {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        {/* Year */}
                        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-zinc-800 rounded px-3 py-1.5 text-sm">
                            <option value="">{t('year')}</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {/* Country */}
                         <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="bg-zinc-800 rounded px-3 py-1.5 text-sm">
                            <option value="">{t('country')}</option>
                            {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>
                </header>
                <main className="p-2 pb-20">
                     <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5">
                        {filterResults.map((item, index) => {
                           if (filterResults.length === index + 1) {
                                return <div ref={lastElementRef} key={item.id}><ItemCard item={item} index={index} /></div>
                           }
                           return <ItemCard key={item.id} item={item} index={index} />
                        })}
                    </div>
                    {loading && <div className="w-8 h-8 mx-auto my-8 border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin"></div>}
                </main>
            </div>
        )
    }


    if (pageType === 'search') {
        const hasResults = searchResults.length > 0;
        const noResults = searchResults.length === 0 && searchTerm.length > 0 && !loading;
        const isIdle = searchTerm.length === 0;

        return (
            <Layout>
                <div className="bg-[#101010] min-h-screen">
                    <div className="fixed top-0 left-0 right-0 z-30 bg-[#141414] border-b border-zinc-800/70">
                        <div className="flex items-center gap-2 p-3">
                            <button onClick={() => navigate(-1)} className="w-9 h-9 flex-shrink-0">
                                <i className="fas fa-arrow-left text-xl"></i>
                            </button>
                            <div className="relative flex-1">
                                <i className="absolute top-1/2 -translate-y-1/2 left-3 text-zinc-400 fa-solid fa-magnifying-glass"></i>
                                <input
                                    type="text"
                                    placeholder={!isInputFocused && !searchTerm ? placeholder : t('search')}
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onFocus={() => setIsInputFocused(true)}
                                    onBlur={() => setIsInputFocused(false)}
                                    className="w-full bg-zinc-800 text-white rounded-md h-10 ps-10 pe-9"
                                />
                                {searchTerm && (
                                    <button onClick={() => { setSearchTerm(''); setSearchResults([]); }} className="absolute top-1/2 -translate-y-1/2 right-3 text-zinc-400">
                                        <i className="fa-solid fa-times"></i>
                                    </button>
                                )}
                            </div>
                            <button className="w-9 h-9 flex-shrink-0">
                                <i className="fas fa-microphone text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div className="pt-20">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-2 mx-2 animate-pulse">
                                    <div className="w-[70px] h-[100px] rounded-md bg-zinc-800"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 w-3/4 rounded bg-zinc-800"></div>
                                        <div className="h-3 w-1/2 rounded bg-zinc-800"></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                {hasResults && (
                                    <div className="space-y-4 animate-fade-in">
                                        {searchResults.map(item => (
                                            <SearchResultItem key={item.id} item={item} genreMap={searchGenreMap} />
                                        ))}
                                    </div>
                                )}

                                {noResults && (
                                    <div className="text-center py-16 px-4 animate-fade-in">
                                        <p className="text-lg text-zinc-400">{t('noResultsFor', {query: searchTerm})}</p>
                                    </div>
                                )}

                                {hasResults && (
                                    <div className="px-4 py-2 my-2 flex justify-center">
                                        <button
                                            onClick={() => setShowSuggestions(prev => !prev)}
                                            className="text-sm font-semibold text-blue-400 hover:bg-blue-400/10 rounded-full transition-colors px-4 py-2 flex items-center gap-2"
                                        >
                                            <span>{showSuggestions ? t('showLess') : t('more')}</span>
                                            <i className={`fa-solid transition-transform duration-300 ${showSuggestions ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                                        </button>
                                    </div>
                                )}

                                <div className={`transition-all duration-300 ease-out overflow-hidden ${isIdle || (hasResults && showSuggestions) ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="animate-fade-in-up">
                                        {hasResults && <div className="border-t border-zinc-800 mx-4 my-2"></div>}
                                        <LastSearches 
                                            lastSearches={lastSearches}
                                            onClear={clearLastSearches}
                                            onSearch={handleLastSearchClick}
                                        />
                                        <SuggestionCarousel title={t('trendingSearches')} items={popularSearches} />
                                        <SuggestionCarousel title={t('bestSeries')} items={bestSeries} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </Layout>
        );
    }
    
    if (loading) {
        return <Layout><div className="w-8 h-8 mx-auto mt-20 border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin"></div></Layout>;
    }
    if (content.length === 0) {
        return <Layout><p className="mt-8 text-center text-gray-400">{t('noItemsFound', { title: title })}</p></Layout>;
    }

    return (
        <Layout>
            <div className="p-4">
                <h1 className="mb-4 text-3xl font-bold">{displayTitle}</h1>
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {content.map((item, index) => {
                        if(pageType === 'downloads') {
                             return (
                                <div key={item.id || item.title} className="flex flex-col animate-grid-item" style={{ animationDelay: `${index * 30}ms` }}>
                                    <div className="relative rounded-xl overflow-hidden bg-zinc-900 cursor-pointer" onClick={() => handleDownloadPlay(item)}>
                                        <img src={item.poster} alt={item.title} className="w-full aspect-[2/3] object-cover" />
                                        {!item.completed && (
                                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                                                <div className="w-10 h-10 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
                                                <div className="text-xs text-white font-semibold">{Math.max(0, Math.min(100, item.progress || 0))}%</div>
                                            </div>
                                        )}
                                        {item.completed && (
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                                    <i className="fa-solid fa-play text-white text-lg"></i>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2 text-center">
                                        <p className="text-sm line-clamp-2">{item.title}</p>
                                        {item.completed && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDownloadDelete(item); }}
                                                className="mt-1 text-xs text-red-400 hover:text-red-300"
                                            >
                                                {t('delete')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                             );
                        }
                        return <ItemCard 
                                    key={item.id} 
                                    item={item} 
                                    onDelete={pageType === 'favorites' ? handleFavoriteDelete : undefined} 
                                    index={index}
                               />
                    })}
                </div>
            </div>
        </Layout>
    );
};

export default GenericPage;