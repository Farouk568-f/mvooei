import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { AVAILABLE_PROVIDERS } from '../contexts/constants';

const SettingsRow: React.FC<{icon: string, title: string, subtitle?: string, children: React.ReactNode}> = ({icon, title, subtitle, children}) => {
    return (
        <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-4">
                <i className={`${icon} w-6 text-center text-xl text-[var(--primary)]`}></i>
                <div>
                    <h3 className="font-semibold text-white">{title}</h3>
                    {subtitle && <p className="text-sm text-[var(--text-dark)]">{subtitle}</p>}
                </div>
            </div>
            <div>
                {children}
            </div>
        </div>
    )
}

const ServerOrderSettings: React.FC = () => {
    const { getScreenSpecificData, setScreenSpecificData, setToast } = useProfile();
    const { t } = useTranslation();

    const defaultServerOrder = AVAILABLE_PROVIDERS.map(p => p.id);
    const [serverOrder, setServerOrder] = useState<string[]>(() => {
        const savedOrder = getScreenSpecificData('serverPreferences', []);
        // Ensure all providers are present, even if new ones are added later
        const fullOrder = [...new Set([...savedOrder, ...defaultServerOrder])];
        return fullOrder;
    });
    
    const [draggedItem, setDraggedItem] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, providerId: string) => {
        setDraggedItem(providerId);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging-server');
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetProviderId: string) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === targetProviderId) {
            return;
        }

        const currentIndex = serverOrder.indexOf(draggedItem);
        const targetIndex = serverOrder.indexOf(targetProviderId);
        
        const newOrder = [...serverOrder];
        const [removed] = newOrder.splice(currentIndex, 1);
        newOrder.splice(targetIndex, 0, removed);
        
        setServerOrder(newOrder);
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        setDraggedItem(null);
        e.currentTarget.classList.remove('dragging-server');
    };

    const handleSaveServerOrder = () => {
        setScreenSpecificData('serverPreferences', serverOrder);
        setToast({ message: t('serverOrderUpdated'), type: 'success' });
    };

    return (
        <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">{t('serverPreferences')}</h2>
            <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <p className="text-sm text-[var(--text-dark)] mb-4">{t('dragToReorder')}</p>
                <div className="space-y-2">
                    {serverOrder.map((providerId) => (
                        <div
                            key={providerId}
                            draggable
                            onDragStart={(e) => handleDragStart(e, providerId)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, providerId)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center p-3 bg-zinc-800 rounded-md cursor-grab active:cursor-grabbing transition-all duration-200"
                        >
                            <i className="fa-solid fa-grip-vertical text-gray-400 me-4"></i>
                            <span className="font-semibold text-white">{AVAILABLE_PROVIDERS.find(p => p.id === providerId)?.name}</span>
                        </div>
                    ))}
                </div>
                <button onClick={handleSaveServerOrder} className="mt-4 px-5 py-2 text-sm font-bold text-white bg-[var(--primary)] rounded-lg btn-press transition-colors hover:bg-purple-600">
                    {t('saveOrder')}
                </button>
            </div>
        </section>
    );
};

const SettingsPage: React.FC = () => {
  const { isDarkMode, setDarkMode, clearAllData } = useProfile();
  const { t, language, setLanguage } = useTranslation();

  const handleClearData = () => {
    if (window.confirm(t('clearAllDataConfirm'))) {
      clearAllData();
      window.location.hash = '#/';
    }
  };

  return (
    <Layout>
      <div className="p-4 max-w-2xl mx-auto">
        <h1 className="mb-8 text-3xl font-bold">{t('settings')}</h1>

        <div className="space-y-8">
          {/* App Settings Section */}
          <section className="space-y-4">
             <h2 className="text-xl font-bold text-white">{t('appSettings')}</h2>
             <SettingsRow icon="fa-solid fa-language" title={t('language')}>
                 <div className="flex gap-2">
                    <button
                        onClick={() => setLanguage('en')}
                        className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${language === 'en' ? 'bg-[var(--primary)] text-white' : 'bg-white/10 text-gray-300'}`}
                    >
                        English
                    </button>
                    <button
                        onClick={() => setLanguage('ar')}
                        className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${language === 'ar' ? 'bg-[var(--primary)] text-white' : 'bg-white/10 text-gray-300'}`}
                    >
                        العربية
                    </button>
                </div>
             </SettingsRow>
             <SettingsRow icon="fa-solid fa-circle-half-stroke" title={t('appearance')}>
                <div className="flex items-center justify-between">
                  <label htmlFor="dark-mode-toggle-settings" className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="dark-mode-toggle-settings"
                      checked={isDarkMode}
                      onChange={(e) => setDarkMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>
             </SettingsRow>
          </section>

          <ServerOrderSettings />
          
          {/* Data Management Section */}
          <section className='space-y-4'>
            <h2 className="text-xl font-bold text-white">{t('dataManagement')}</h2>
            <SettingsRow icon="fa-solid fa-database" title={t('dataManagement')}>
                <button
                    onClick={handleClearData}
                    className="px-4 py-1.5 text-sm font-bold text-red-400 bg-red-500/10 rounded-lg transition-colors"
                >
                    {t('clearAllData')}
                </button>
            </SettingsRow>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;