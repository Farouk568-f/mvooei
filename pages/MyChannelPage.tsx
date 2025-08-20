import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import Layout from '../components/Layout';
import { fetchFromTMDB } from '../services/apiService';
import { Movie, ScheduleItem, Season, Episode } from '../types';
import { IMAGE_BASE_URL, POSTER_SIZE, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';

function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const InitialStateView: React.FC<{ onStart: () => void }> = ({ onStart }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center text-center p-8">
            <i className="fa-solid fa-tower-broadcast text-7xl text-[var(--primary)]"></i>
            <h1 className="text-3xl font-bold mt-6">{t('welcomeToCreatorHub')}</h1>
            <p className="text-gray-400 mt-2 max-w-md">{t('buildYourOwnChannelPrompt')}</p>
            <button onClick={onStart} className="mt-8 px-8 py-3 bg-[var(--primary)] text-white font-bold rounded-full text-lg btn-press">
                {t('startBuilding')}
            </button>
        </div>
    );
};

const MyChannelPage: React.FC = () => {
    const { activeProfile, updateMyChannel, setToast } = useProfile();
    const { t } = useTranslation();
    const navigate = ReactRouterDOM.useNavigate();

    const [channelName, setChannelName] = useState(activeProfile?.myChannel?.name || `${activeProfile?.name}'s Channel`);
    const [schedule, setSchedule] = useState<ScheduleItem[]>(activeProfile?.myChannel?.schedule || []);
    const [totalDuration, setTotalDuration] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Movie[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const [episodeModal, setEpisodeModal] = useState<{ isOpen: boolean, tvShow: Movie | null }>({ isOpen: false, tvShow: null });
    const [view, setView] = useState<'initial' | 'creator'>('initial');

    useEffect(() => {
        if (activeProfile?.myChannel) {
            setView('creator');
        }
    }, [activeProfile]);
    
    useEffect(() => {
        const duration = schedule.reduce((acc, item) => acc + item.durationSeconds, 0);
        setTotalDuration(duration);
    }, [schedule]);

    const performSearch = useCallback(debounce(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        try {
            const res = await fetchFromTMDB('/search/multi', { query });
            const validResults = res.results.filter((item: Movie) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);
            setSearchResults(validResults);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    }, 500), []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchTerm(query);
        setIsSearching(true);
        performSearch(query);
    };

    const addItemToSchedule = (item: ScheduleItem) => {
        let currentTime = new Date();
        if (schedule.length > 0) {
            currentTime = new Date(schedule[schedule.length - 1].endTime);
        }

        const newItemWithTime = {
            ...item,
            startTime: currentTime.toISOString(),
            endTime: new Date(currentTime.getTime() + item.durationSeconds * 1000).toISOString(),
        };
        setSchedule(prev => [...prev, newItemWithTime]);
    };
    
    const handleAddMovie = async (movie: Movie) => {
        try {
            const movieDetails = await fetchFromTMDB(`/movie/${movie.id}`);
            const duration = (movieDetails.runtime || 90) * 60; // Default to 90 mins if no runtime
            addItemToSchedule({
                type: 'movie',
                tmdbId: movie.id,
                movieTitle: movie.title,
                backdrop_path: movie.backdrop_path,
                durationSeconds: duration,
                startTime: '',
                endTime: '',
            });
        } catch (error) {
            console.error("Failed to fetch movie details", error);
        }
    };
    
    const handleAddTvShow = (tvShow: Movie) => {
        setEpisodeModal({ isOpen: true, tvShow });
    };

    const handleRemoveItem = (index: number) => {
        const newSchedule = [...schedule];
        newSchedule.splice(index, 1);
        // Recalculate all timings
        let currentTime = new Date();
        const recalculatedSchedule = newSchedule.map(item => {
            const startTime = currentTime.toISOString();
            const endTime = new Date(currentTime.getTime() + item.durationSeconds * 1000).toISOString();
            currentTime = new Date(endTime);
            return { ...item, startTime, endTime };
        });
        setSchedule(recalculatedSchedule);
    };

    const handlePublish = () => {
        if (totalDuration < 24 * 3600) {
            setToast({ message: t('durationRequirement'), type: 'error' });
            return;
        }
        updateMyChannel({ name: channelName, schedule });
        setToast({ message: t('channelPublished'), type: 'success' });
        navigate(`/live-tv/my-channel`);
    };

    if (!activeProfile) {
        navigate('/');
        return null;
    }

    if (view === 'initial') {
        return <Layout><InitialStateView onStart={() => setView('creator')} /></Layout>;
    }
    
    const DURATION_GOAL = 24 * 60 * 60;
    const progress = Math.min((totalDuration / DURATION_GOAL) * 100, 100);

    return (
        <Layout>
            <div className="p-4 max-w-4xl mx-auto space-y-8">
                <h1 className="text-3xl font-bold">{t('myChannel')}</h1>

                <section className="p-4 bg-[var(--surface)] rounded-lg space-y-4">
                    <h2 className="text-xl font-bold">{t('channelName')}</h2>
                    <input
                        type="text"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        className="w-full px-4 py-2 text-white bg-zinc-800 border-2 border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        placeholder={t('channelName')}
                    />
                     <h2 className="text-xl font-bold pt-2">{t('totalDuration')}</h2>
                     <div className="w-full bg-zinc-700 rounded-full h-4 overflow-hidden">
                        <div className="bg-[var(--primary)] h-4 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="flex justify-between text-sm font-medium text-gray-400">
                        <span>{formatDuration(totalDuration)}</span>
                        <span>{Math.floor(totalDuration / 3600)} {t('hours')} / 24 {t('hours')}</span>
                    </div>

                    <button
                        onClick={handlePublish}
                        disabled={progress < 100}
                        className="w-full py-3 font-bold text-white bg-[var(--secondary)] rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed btn-press"
                    >
                        {t('publishChannel')}
                    </button>
                    {progress < 100 && <p className="text-xs text-center text-gray-500">{t('durationRequirement')}</p>}
                </section>
                
                <section>
                    <h2 className="text-xl font-bold mb-4">{t('yourSchedule')}</h2>
                    <div className="space-y-2">
                        {schedule.map((item, index) => (
                            <div key={`${item.tmdbId}-${index}`} className="flex items-center gap-4 p-2 bg-[var(--surface)] rounded-lg">
                                <span className="font-mono text-xs text-gray-400">{String(index + 1).padStart(2, '0')}</span>
                                <img src={`${IMAGE_BASE_URL}w92${item.backdrop_path}`} className="w-20 h-12 object-cover rounded-md" alt=""/>
                                <div className="flex-1">
                                    <p className="font-bold text-sm">{item.movieTitle || item.showName}</p>
                                    <p className="text-xs text-gray-400">{item.episodeTitle ? `S${item.season_number} E${item.episode_number}: ${item.episodeTitle}` : t('movie')}</p>
                                </div>
                                <span className="text-sm font-semibold">{formatDuration(item.durationSeconds)}</span>
                                <button onClick={() => handleRemoveItem(index)} className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40"><i className="fa-solid fa-trash-can"></i></button>
                            </div>
                        ))}
                         {schedule.length === 0 && <p className="text-center text-gray-500 py-4">{t('noItemsFound', {title: t('yourSchedule')})}</p>}
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4">{t('addContent')}</h2>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            placeholder={t('searchPlaceholder')}
                            className="w-full px-4 py-3 bg-[var(--surface)] rounded-lg"
                        />
                        {isSearching && <div className="absolute top-1/2 right-4 -translate-y-1/2 w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>}
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {searchResults.map(item => (
                            <div key={item.id} className="flex items-center gap-3 p-2 bg-[var(--surface)] rounded-lg">
                                <img src={`${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}`} className="w-16 h-24 object-cover rounded-md" alt=""/>
                                <div className="flex-1">
                                    <p className="font-bold text-sm">{item.title || item.name}</p>
                                    <p className="text-xs text-gray-400">{item.media_type === 'tv' ? t('series') : t('movie')}</p>
                                </div>
                                <button onClick={() => item.media_type === 'movie' ? handleAddMovie(item) : handleAddTvShow(item)} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-bold rounded-lg btn-press">{t('addToSchedule')}</button>
                            </div>
                        ))}
                    </div>
                </section>
                
                {episodeModal.isOpen && episodeModal.tvShow && (
                    <EpisodeSelectionModal 
                        tvShow={episodeModal.tvShow}
                        onClose={() => setEpisodeModal({ isOpen: false, tvShow: null })}
                        onAddEpisode={(season, episode) => {
                             addItemToSchedule({
                                type: 'show',
                                tmdbId: episodeModal.tvShow!.id,
                                showName: episodeModal.tvShow!.name,
                                season_number: season.season_number,
                                episode_number: episode.episode_number,
                                episodeTitle: episode.name,
                                backdrop_path: episode.still_path || episodeModal.tvShow!.backdrop_path,
                                durationSeconds: (episode.runtime || 22) * 60,
                                startTime: '',
                                endTime: '',
                            });
                        }}
                    />
                )}
            </div>
        </Layout>
    );
};

const EpisodeSelectionModal: React.FC<{
    tvShow: Movie;
    onClose: () => void;
    onAddEpisode: (season: Season, episode: Episode) => void;
}> = ({ tvShow, onClose, onAddEpisode }) => {
    const { t } = useTranslation();
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchSeasons = async () => {
            setLoading(true);
            try {
                const data = await fetchFromTMDB(`/tv/${tvShow.id}`);
                setSeasons(data.seasons?.filter((s: Season) => s.season_number > 0 && s.episode_count > 0));
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchSeasons();
    }, [tvShow.id]);
    
    const handleSelectSeason = async (season: Season) => {
        setSelectedSeason(season);
        setLoading(true);
        try {
            const data = await fetchFromTMDB(`/tv/${tvShow.id}/season/${season.season_number}`);
            const episodesWithRuntime = await Promise.all(
                data.episodes.map(async (ep: Episode) => {
                    const epDetails = await fetchFromTMDB(`/tv/${tvShow.id}/season/${season.season_number}/episode/${ep.episode_number}`);
                    return { ...ep, runtime: epDetails.runtime || 22 };
                })
            );
            setEpisodes(episodesWithRuntime);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--surface)] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                    <h2 className="text-xl font-bold">{selectedSeason ? `${tvShow.name} - ${selectedSeason.name}` : t('selectEpisode')}</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10"><i className="fa-solid fa-times"></i></button>
                </header>
                <main className="p-4 overflow-y-auto">
                    {loading && <div className="w-8 h-8 mx-auto border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin"></div>}
                    {!loading && !selectedSeason && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {seasons.map(season => (
                                <div key={season.id} onClick={() => handleSelectSeason(season)} className="cursor-pointer group">
                                    <img src={`${IMAGE_BASE_URL}${POSTER_SIZE}${season.poster_path || tvShow.poster_path}`} className="rounded-lg aspect-[2/3] object-cover transition-transform group-hover:scale-105"/>
                                    <p className="font-bold mt-2">{season.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                     {!loading && selectedSeason && (
                        <div className="space-y-2">
                             <button onClick={() => setSelectedSeason(null)} className="mb-4 text-sm text-[var(--primary)]"><i className="fa-solid fa-arrow-left me-2"></i>Back to Seasons</button>
                            {episodes.map(ep => (
                                <div key={ep.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg">
                                     <img src={ep.still_path ? `${IMAGE_BASE_URL}w185${ep.still_path}`: `${IMAGE_BASE_URL}w300${tvShow.backdrop_path}`} className="w-24 h-14 object-cover rounded-md" alt=""/>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{ep.episode_number}. {ep.name}</p>
                                        <p className="text-xs text-gray-400">{(ep.runtime || 22)} mins</p>
                                    </div>
                                    <button onClick={() => onAddEpisode(selectedSeason, ep)} className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-bold rounded-lg btn-press">{t('addToSchedule')}</button>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};


export default MyChannelPage;