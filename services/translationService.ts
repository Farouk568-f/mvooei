
/**
 * WARNING: This service uses an unofficial, public Google Translate API endpoint.
 * It is not guaranteed to be stable and may be rate-limited or blocked by Google at any time.
 * For production applications, it is highly recommended to use the official Google Cloud Translation API
 * via a secure backend server to protect your API key.
 */

// Regex to parse SRT blocks: index, timestamp, and text content.
const srtBlockRegex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]+?)(?=\n\n|\n*$)/g;

interface SrtBlock {
    index: string;
    timestamp: string;
    text: string;
    isTranslatable?: boolean;
}

const parseSrt = (srtContent: string): SrtBlock[] => {
    const blocks: SrtBlock[] = [];
    let match;
    srtBlockRegex.lastIndex = 0; // Reset regex state
    while ((match = srtBlockRegex.exec(srtContent)) !== null) {
        const text = match[3].trim();
        blocks.push({
            index: match[1],
            timestamp: match[2],
            text: text,
        });
    }
    return blocks;
};

const reconstructSrt = (blocks: SrtBlock[]): string => {
    return blocks
        .map(block => `${block.index}\n${block.timestamp}\n${block.text}`)
        .join('\n\n');
};

const translateTextBatch = async (texts: string[], targetLang: string): Promise<string[]> => {
    if (texts.length === 0) return [];
    
    const separator = " ||| ";
    const combinedText = texts.join(separator);

    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.append('client', 'gtx');
    url.searchParams.append('sl', 'auto');
    url.searchParams.append('tl', targetLang);
    url.searchParams.append('dt', 't');
    url.searchParams.append('q', combinedText);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Translation API failed: ${response.status}`);
    
    const data = await response.json();
    if (!data || !data[0] || !data[0][0] || !data[0][0][0]) {
        throw new Error("Invalid response from translation API");
    }

    const translatedFullText = data[0][0][0];
    const translatedTexts = translatedFullText.split(separator.trim());
    
    if (targetLang === 'ar') {
        return translatedTexts.map(text => text.replace(/\.+$/, ''));
    }
    
    return translatedTexts;
};

export const translateSrtViaGoogle = async (srtContent: string, targetLang: string = 'ar'): Promise<string | null> => {
    try {
        console.log(`Sending translation request for ${srtContent.length} characters to Python service...`);
        const requestBody = {
            srt_content: srtContent,
            target_lang: targetLang
        };
        
        const baseUrl = 'https://878e37861147.ngrok-free.app';
        
        const response = await fetch(`${baseUrl}/translate_srt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.error(`Translation service error: ${response.status}`);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return await translateSrtViaGoogleFallback(srtContent, targetLang);
        }

        const data = await response.json();
        console.log('Translation response received:', Object.keys(data));
        
        if (data.error || !data.translated_srt) {
            console.error("Translation service error:", data.error);
            return await translateSrtViaGoogleFallback(srtContent, targetLang);
        }

        // Sanitize the response from the backend by parsing and reconstructing it.
        // This ensures consistent formatting and fixes issues with mixed content.
        const srtBlocks = parseSrt(data.translated_srt);
        const sanitizedSrt = reconstructSrt(srtBlocks);
        return sanitizedSrt;

    } catch (error) {
        console.error("Error connecting to translation service:", error);
        return await translateSrtViaGoogleFallback(srtContent, targetLang);
    }
};

const translateSrtViaGoogleFallback = async (srtContent: string, targetLang: string = 'ar'): Promise<string | null> => {
    try {
        const parseForFallback = (content: string): SrtBlock[] => {
            const blocks: SrtBlock[] = [];
            let match;
            srtBlockRegex.lastIndex = 0;
            while ((match = srtBlockRegex.exec(content)) !== null) {
                const text = match[3].trim();
                const isTranslatable = !(text.startsWith('[') && text.endsWith(']')) && !text.startsWith('♪');
                blocks.push({ index: match[1], timestamp: match[2], text: text, isTranslatable: isTranslatable });
            }
            return blocks;
        };

        const srtBlocks = parseForFallback(srtContent);
        if (srtBlocks.length === 0) return srtContent;

        const translatableBlocks = srtBlocks.filter(b => b.isTranslatable);
        const originalTextsToTranslate = translatableBlocks.map(b => b.text.replace(/\n/g, ' '));
        const translatedTexts = await translateTextBatch(originalTextsToTranslate, targetLang);

        if (originalTextsToTranslate.length !== translatedTexts.length) {
            console.warn("Mismatch in translated segments count. Aborting.");
            return null;
        }

        const translationMap = new Map<string, string>();
        originalTextsToTranslate.forEach((original, index) => {
            translationMap.set(original, translatedTexts[index]);
        });

        const finalSrtBlocks = srtBlocks.map(block => {
            if (block.isTranslatable) {
                const originalKey = block.text.replace(/\n/g, ' ');
                const translatedText = translationMap.get(originalKey);
                if (translatedText) {
                    return { ...block, text: translatedText };
                }
            }
            return block;
        });
        
        return reconstructSrt(finalSrtBlocks);
    } catch (error) {
        console.error("Error translating SRT content:", error);
        return null;
    }
};
```

--- START OF FILE App.tsx ---

```javascript
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
