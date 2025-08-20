import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Profile, AccountData, HistoryItem, FavoriteItem, DownloadItem, Movie } from '../types';
import { useTranslation } from './LanguageContext';

interface ProfileContextType {
  accountData: AccountData | null;
  activeProfile: Profile | null;
  isKidsMode: boolean;
  isDarkMode: boolean;
  toast: { message: string, type: 'success' | 'error' | 'info' } | null;
  setToast: (toast: { message: string, type: 'success' | 'error' | 'info' } | null) => void;
  selectProfile: (profileId: string) => void;
  addProfile: (profile: Omit<Profile, 'id' | 'favorites' | 'history' | 'lastSearches' | 'downloads'>) => Profile | undefined;
  updateProfile: (profileId: string, updates: Partial<Pick<Profile, 'name' | 'avatar' | 'type'>>) => void;
  deleteProfile: (profileId: string) => void;
  getScreenSpecificData: <K extends keyof Profile>(key: K, defaultValue: Profile[K]) => Profile[K];
  setScreenSpecificData: <K extends keyof Profile>(key: K, value: Profile[K]) => void;
  toggleFavorite: (item: Movie | FavoriteItem) => void;
  isFavorite: (itemId: number) => boolean;
  updateHistory: (item: HistoryItem) => void;
  addDownload: (item: DownloadItem) => void;
  removeDownload: (title: string) => void;
  addLastSearch: (item: Movie) => void;
  clearLastSearches: () => void;
  setDarkMode: (isDark: boolean) => void;
  clearAllData: () => void;
  switchProfile: () => void;
  toggleFollowActor: (actorId: number) => void;
  isFollowingActor: (actorId: number) => boolean;
  updateMyChannel: (channel: Profile['myChannel'] | undefined) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`LS Error get ${key}:`, e);
        return defaultValue;
    }
};

const setLocalStorageItem = <T,>(key: string, value: T) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`LS Error set ${key}:`, e);
    }
};

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isKidsMode, setIsKidsMode] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getLocalStorageItem('darkMode', true));
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const data = getLocalStorageItem<AccountData>('cineStreamAccount', { screens: [], activeScreenId: null });
    setAccountData(data);
    if (data.activeScreenId) {
      const profile = data.screens.find(s => s.id === data.activeScreenId);
      if (profile) {
        setActiveProfile(profile);
        setIsKidsMode(profile.type === 'KIDS');
      }
    }
  }, []);

  useEffect(() => {
    if (accountData) {
      setLocalStorageItem('cineStreamAccount', accountData);
    }
  }, [accountData]);

  useEffect(() => {
    document.body.classList.toggle('dark', isDarkMode);
    setLocalStorageItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const selectProfile = useCallback((profileId: string) => {
    if (accountData) {
      const profile = accountData.screens.find(s => s.id === profileId);
      if (profile) {
        setActiveProfile(profile);
        setIsKidsMode(profile.type === 'KIDS');
        setAccountData(prev => prev ? { ...prev, activeScreenId: profileId } : null);
      }
    }
  }, [accountData]);

  const switchProfile = useCallback(() => {
    setActiveProfile(null);
    setIsKidsMode(false);
    setAccountData(prev => prev ? { ...prev, activeScreenId: null } : null);
  }, []);

  const updateAccountData = (updater: (prev: AccountData) => AccountData) => {
    setAccountData(prev => prev ? updater(prev) : null);
  };

  const addProfile = (profileData: Omit<Profile, 'id' | 'favorites' | 'history' | 'lastSearches' | 'downloads'>) => {
    const newProfile: Profile = {
      ...profileData,
      id: `profile_${Date.now()}`,
      favorites: [],
      history: [],
      lastSearches: [],
      downloads: [],
    };
    let createdProfile: Profile | undefined;
    updateAccountData(prev => {
      if (prev.screens.length < 5) {
        createdProfile = newProfile;
        return { ...prev, screens: [...prev.screens, newProfile] };
      }
      return prev;
    });
    setToast({ message: t('profileCreated'), type: 'success' });
    return createdProfile;
  };
  
  const updateProfile = (profileId: string, updates: Partial<Pick<Profile, 'name' | 'avatar' | 'type'>>) => {
    updateAccountData(prev => ({
      ...prev,
      screens: prev.screens.map(p => p.id === profileId ? { ...p, ...updates } : p),
    }));
    if (activeProfile?.id === profileId) {
        setActiveProfile(prev => prev ? {...prev, ...updates} : null);
        if(updates.type) setIsKidsMode(updates.type === 'KIDS');
    }
    setToast({ message: t('profileUpdated'), type: 'success' });
  };
  
  const deleteProfile = (profileId: string) => {
    updateAccountData(prev => {
      if (prev.screens.length <= 1) return prev; // Cannot delete the last profile
      return {
        ...prev,
        screens: prev.screens.filter(p => p.id !== profileId),
      };
    });
    setToast({ message: t('profileDeleted'), type: 'success' });
  };

  const setScreenSpecificData = useCallback(<K extends keyof Profile>(key: K, value: Profile[K]) => {
    if (activeProfile) {
      const updatedProfile = { ...activeProfile, [key]: value };
      setActiveProfile(updatedProfile);
      updateAccountData(prev => ({
        ...prev,
        screens: prev.screens.map(p => p.id === activeProfile.id ? updatedProfile : p),
      }));
    }
  }, [activeProfile]);
  
  const getScreenSpecificData = useCallback(<K extends keyof Profile>(key: K, defaultValue: Profile[K]): Profile[K] => {
    return activeProfile?.[key] ?? defaultValue;
  }, [activeProfile]);
  
  const isFavorite = useCallback((itemId: number) => {
    return getScreenSpecificData('favorites', []).some(fav => fav.id === itemId);
  }, [getScreenSpecificData]);
  
  const toggleFavorite = useCallback((item: Movie | FavoriteItem) => {
    if (!item || !item.id) {
        setToast({ message: t('errorInsufficientInfo'), type: 'error' });
        return;
    }
    const currentFavorites = getScreenSpecificData('favorites', []);
    if (isFavorite(item.id)) {
      setScreenSpecificData('favorites', currentFavorites.filter(fav => fav.id !== item.id));
      setToast({ message: t('removedFromFavorites'), type: 'info' });
    } else {
      const newItem: FavoriteItem = {
        id: item.id,
        title: item.title || item.name,
        name: item.name,
        poster: 'poster_path' in item ? item.poster_path : ('poster' in item ? item.poster : undefined),
        type: 'media_type' in item && item.media_type ? item.media_type : ('type' in item ? item.type : (item.title ? 'movie' : 'tv')),
        vote_average: item.vote_average
      };
      setScreenSpecificData('favorites', [...currentFavorites, newItem]);
      setToast({ message: t('addedToFavorites'), type: 'success' });
    }
  }, [getScreenSpecificData, isFavorite, setScreenSpecificData, t, setToast]);
  
  const updateHistory = useCallback((item: HistoryItem) => {
    const history = getScreenSpecificData('history', []);
    const existingIndex = history.findIndex(h => h.id === item.id && h.type === item.type && h.episodeId === item.episodeId);
    let newHistory = [...history];
    if (existingIndex > -1) {
      newHistory.splice(existingIndex, 1);
    }
    newHistory.unshift(item);
    if (newHistory.length > 20) newHistory = newHistory.slice(0, 20);
    setScreenSpecificData('history', newHistory);
  }, [getScreenSpecificData, setScreenSpecificData]);
  
  const addDownload = useCallback((item: DownloadItem) => {
    const downloads = getScreenSpecificData('downloads', []);
    const existingIndex = downloads.findIndex(d => d.title === item.title);
    if (existingIndex >= 0) {
        // Update existing download with new progress/completion status
        const updatedDownloads = [...downloads];
        updatedDownloads[existingIndex] = { ...updatedDownloads[existingIndex], ...item };
        setScreenSpecificData('downloads', updatedDownloads);
        if (item.completed) {
            setToast({ message: t('downloadCompleted', { title: item.title }), type: 'success' });
        }
        return;
    }
    setScreenSpecificData('downloads', [...downloads, item]);
    setToast({ message: t('downloadAdded', { title: item.title }), type: 'success' });
  }, [getScreenSpecificData, setScreenSpecificData, setToast, t]);

  const removeDownload = useCallback((title: string) => {
    const downloads = getScreenSpecificData('downloads', []);
    setScreenSpecificData('downloads', downloads.filter(d => d.title !== title));
    setToast({ message: t('itemRemovedFromDownloads', { title }), type: 'info' });
  }, [getScreenSpecificData, setScreenSpecificData, setToast, t]);
  
  const addLastSearch = useCallback((item: Movie) => {
    const searches = getScreenSpecificData('lastSearches', []);
    const newSearches = [item, ...searches.filter(s => s.id !== item.id)].slice(0, 10);
    setScreenSpecificData('lastSearches', newSearches);
  }, [getScreenSpecificData, setScreenSpecificData]);

  const clearLastSearches = useCallback(() => {
    setScreenSpecificData('lastSearches', []);
  }, [setScreenSpecificData]);
  
  const setDarkMode = (isDark: boolean) => {
    setIsDarkMode(isDark);
  };
  
  const clearAllData = () => {
    localStorage.removeItem('cineStreamAccount');
    localStorage.removeItem('darkMode');
    setAccountData({ screens: [], activeScreenId: null });
    setActiveProfile(null);
    setIsKidsMode(false);
    setIsDarkMode(true);
    setToast({ message: t('allDataCleared'), type: 'success' });
  };

  const isFollowingActor = useCallback((actorId: number) => {
      return getScreenSpecificData('followedActors', []).includes(actorId);
  }, [getScreenSpecificData]);

  const toggleFollowActor = useCallback((actorId: number) => {
      const followed = getScreenSpecificData('followedActors', []);
      if (isFollowingActor(actorId)) {
          setScreenSpecificData('followedActors', followed.filter(id => id !== actorId));
          setToast({ message: t('unfollowedActor'), type: 'info' });
      } else {
          setScreenSpecificData('followedActors', [...followed, actorId]);
          setToast({ message: t('followedActor'), type: 'success' });
      }
  }, [getScreenSpecificData, isFollowingActor, setScreenSpecificData, setToast, t]);

  const updateMyChannel = useCallback((channel: Profile['myChannel'] | undefined) => {
    setScreenSpecificData('myChannel', channel);
  }, [setScreenSpecificData]);

  const value: ProfileContextType = {
    accountData,
    activeProfile,
    isKidsMode,
    isDarkMode,
    toast,
    setToast,
    selectProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    getScreenSpecificData,
    setScreenSpecificData,
    toggleFavorite,
    isFavorite,
    updateHistory,
    addDownload,
    removeDownload,
    addLastSearch,
    clearLastSearches,
    setDarkMode,
    clearAllData,
    switchProfile,
    toggleFollowActor,
    isFollowingActor,
    updateMyChannel,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = (): ProfileContextType => {
    const context = useContext(ProfileContext);
    if (context === undefined) {
        throw new Error('useProfile must be used within a ProfileProvider');
    }
    return context;
};
