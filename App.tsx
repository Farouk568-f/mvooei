import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DetailsPage from './pages/DetailsPage';
import PlayerPage from './pages/PlayerPage';
import ProfilePage from './pages/ProfilePage';
import GenericPage from './pages/GenericPage';
import SettingsPage from './pages/SettingsPage';
import ActorDetailsPage from './pages/ActorDetailsPage';
import MoviesPage from './pages/ShortsPage';
import YouPage from './pages/YouPage';
import TvShowsPage from './pages/CinemaPage';
import LiveRoomPage from './pages/LiveRoomPage';
import LiveTVPage from './pages/LiveTVPage';
import MyChannelPage from './pages/MyChannelPage';
import { ProfileProvider } from './contexts/ProfileContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { PlayerProvider } from './contexts/PlayerContext';
import { ToastContainer } from './components/common';
import PipPlayer from './components/PipPlayer';
import { useTranslation } from './contexts/LanguageContext';

const GenericPageWrapper: React.FC<{ pageType: 'favorites' | 'downloads' | 'search' | 'all' | 'subscriptions' | 'filter' }> = ({ pageType }) => {
  const { t } = useTranslation();
  const pageTitles = {
    favorites: t('favorites'),
    downloads: t('downloads'),
    search: t('search'),
    all: t('all'),
    subscriptions: t('subscriptions'),
    filter: t('filter')
  }
  return <GenericPage pageType={pageType} title={pageTitles[pageType]} />;
};


const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ProfileProvider>
        <HashRouter>
          <PlayerProvider>
            <Routes>
              <Route path="/" element={<ProfilePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/details/:type/:id" element={<DetailsPage />} />
              <Route path="/actor/:id" element={<ActorDetailsPage />} />
              <Route path="/player" element={<PlayerPage />} />
              <Route path="/movies" element={<MoviesPage />} />
              <Route path="/tv" element={<TvShowsPage />} />
              <Route path="/my-channel" element={<MyChannelPage />} />
              <Route path="/live/:type/:id" element={<LiveRoomPage />} />
              <Route path="/live-tv/:channelId" element={<LiveTVPage />} />
              <Route path="/favorites" element={<GenericPageWrapper pageType="favorites" />} />
              <Route path="/downloads" element={<GenericPageWrapper pageType="downloads" />} />
              <Route path="/search" element={<GenericPageWrapper pageType="search" />} />
              <Route path="/all/:category" element={<GenericPageWrapper pageType="all" />} />
              <Route path="/filter/:mediaType" element={<GenericPageWrapper pageType="filter" />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/you" element={<YouPage />} />
            </Routes>
            <PipPlayer />
          </PlayerProvider>
        </HashRouter>
        <ToastContainer />
      </ProfileProvider>
    </LanguageProvider>
  );
};

export default App;