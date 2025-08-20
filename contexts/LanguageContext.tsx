import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { translations, TranslationKey } from '../translations';

export type { TranslationKey };

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey | string, options?: Record<string, string | number> & { defaultValue?: string }) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getInitialLanguage = (): Language => {
    const storedLang = localStorage.getItem('cineStreamLanguage');
    return (storedLang === 'en' || storedLang === 'ar') ? storedLang : 'ar';
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(getInitialLanguage);

    useEffect(() => {
        const dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
        document.documentElement.dir = dir;
        const newFont = language === 'ar' ? "'Tajawal', 'Inter', sans-serif" : "'Inter', 'Tajawal', sans-serif";
        document.body.style.fontFamily = newFont;
    }, [language]);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('cineStreamLanguage', lang);
        window.location.reload(); 
    };

    const t = useCallback((key: TranslationKey | string, options?: Record<string, string | number> & { defaultValue?: string }): string => {
        let translation = translations[language][key as TranslationKey] || translations['en'][key as TranslationKey] || options?.defaultValue || key;
        if (options) {
            Object.keys(options).forEach(optionKey => {
                if(optionKey !== 'defaultValue') {
                    translation = translation.replace(`{${optionKey}}`, String(options[optionKey]));
                }
            });
        }
        return translation;
    }, [language]);

    const dir = language === 'ar' ? 'rtl' : 'ltr';

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useTranslation = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};