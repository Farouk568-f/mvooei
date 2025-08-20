import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';

const TopNavbar: React.FC = () => {
  const { isKidsMode } = useProfile();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const hasHero = location.pathname === '/home' || location.pathname.startsWith('/details/') || location.pathname.startsWith('/actor/');

  // The navbar is now absolute, so it scrolls with the page.
  // The background is solid on non-hero pages and transparent on hero pages.
  // The scroll-based effect is removed as per the user's request.
  const headerClasses = `absolute top-0 left-0 right-0 z-40 flex items-center justify-between h-16 px-4 transition-colors duration-300 ${
    hasHero
      ? 'bg-transparent border-b border-transparent'
      : 'bg-[var(--background)] border-b border-[var(--border)]'
  }`;


  return (
    <>
      <header className={headerClasses}>
        <div className="flex items-center">
            <h1 onClick={() => navigate('/home')} className="text-2xl font-extrabold text-white animate-fade-in cursor-pointer" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>
                CineStream
            </h1>
        </div>
        {isKidsMode && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase shadow-lg pointer-events-none">{t('kidsMode')}</div>}
      </header>
    </>
  );
};

export const BottomNavbar: React.FC = () => {
    const { t } = useTranslation();
    const { activeProfile } = useProfile();

    const navItems = [
      { to: '/home', icon: 'fa-home', text: t('home') },
      { to: '/movies', icon: 'fa-solid fa-film', text: t('movies') },
      { to: '/you', icon: 'fa-solid fa-circle-user', text: t('you'), isCenter: true },
      { to: '/tv', icon: 'fa-solid fa-tv', text: t('series') },
      { to: '/search', icon: 'fa-solid fa-magnifying-glass', text: t('search') }
    ];
    
    return (
      <nav className="fixed bottom-0 left-0 z-40 w-full bg-[#121212] border-t border-zinc-800 h-16">
        <div className="relative flex items-center justify-around h-full max-w-5xl mx-auto">
          {navItems.map((item) => {
              if (item.isCenter) {
                return (
                    <div key={item.to} className="relative w-1/5 h-full flex justify-center">
                        <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              `absolute -top-5 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 p-1 ${isActive ? 'bg-gradient-to-tr from-purple-500 to-pink-500' : 'bg-zinc-700'}`
                            }
                            style={{ boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}
                        >
                            {() => (
                                <div className="w-full h-full bg-[#121212] rounded-full p-0.5">
                                    <img 
                                        src={activeProfile?.avatar} 
                                        alt="You" 
                                        className="w-full h-full rounded-full object-cover" 
                                    />
                                </div>
                            )}
                        </NavLink>
                    </div>
                )
              }
              return (
                 <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 h-full p-2 transition-colors duration-200 ${isActive ? 'text-white' : 'text-zinc-400 hover:text-white'}`
                  }
                >
                  <i className={`fa ${item.icon} text-xl mb-1`}></i>
                  <span className="text-[10px] font-medium">{item.text}</span>
                </NavLink>
              )
          })}
        </div>
      </nav>
    );
};


const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeProfile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!activeProfile) {
      navigate('/', { replace: true });
    }
  }, [activeProfile, navigate]);

  if (!activeProfile) {
    return null; 
  }

  const noPaddingTop = location.pathname === '/home' || location.pathname.startsWith('/details/') || location.pathname.startsWith('/player') || location.pathname.startsWith('/actor/');
  const isYouPage = location.pathname.startsWith('/you');
  const noLayout = location.pathname.startsWith('/shorts') || location.pathname.startsWith('/live/');

  if (noLayout) {
      return <>{children}</>
  }

  return (
    <div className="min-h-screen text-[var(--text-light)] bg-[#101010] transition-colors duration-300">
        {!location.pathname.startsWith('/player') &&
         !isYouPage &&
         !location.pathname.startsWith('/search') && <TopNavbar />}
        <main
            key={location.pathname}
            className={`pb-28 ${
            !noPaddingTop && !isYouPage && !location.pathname.startsWith('/search') ? 'pt-20' : ''
            } animate-page-enter`}
        >
            {children}
        </main>
      { !location.pathname.startsWith('/player') && <BottomNavbar /> }
    </div>
  );
};

export default Layout;