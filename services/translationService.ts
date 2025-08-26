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
    isTranslatable: boolean; // New flag to identify lines that should be translated
}

const parseSrt = (srtContent: string): SrtBlock[] => {
    const blocks: SrtBlock[] = [];
    let match;
    srtBlockRegex.lastIndex = 0; // Reset regex state from previous executions
    while ((match = srtBlockRegex.exec(srtContent)) !== null) {
        const text = match[3].trim();
        // A line is considered non-translatable if it's enclosed in [] or starts with ♪
        const isTranslatable = !(text.startsWith('[') && text.endsWith(']')) && !text.startsWith('♪');
        blocks.push({
            index: match[1],
            timestamp: match[2],
            text: text,
            isTranslatable: isTranslatable,
        });
    }
    return blocks;
};

const reconstructSrt = (blocks: SrtBlock[]): string => {
    return blocks
        .map(block => {
            return `${block.index}\n${block.timestamp}\n${block.text}`;
        })
        .join('\n\n');
};

const translateTextBatch = async (texts: string[], targetLang: string): Promise<string[]> => {
    // If there's nothing to translate, return an empty array.
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
    
    // تحسين الترجمة العربية - إزالة النقاط الزائدة وتحسين التنسيق
    if (targetLang === 'ar') {
        return translatedTexts.map(text => {
            // إزالة النقاط الزائدة في نهاية النص
            return text.replace(/\.+$/, '');
        });
    }
    
    return translatedTexts;
};

export const translateSrtViaGoogle = async (srtContent: string, targetLang: string = 'ar'): Promise<string | null> => {
    try {
        console.log(`Sending translation request for ${srtContent.length} characters to Python service...`);
        // استخدام خدمة Python للترجمة
        const requestBody = {
            srt_content: srtContent,
            target_lang: targetLang
        };
        
        console.log('Request body keys:', Object.keys(requestBody));
        console.log('SRT content preview:', srtContent.substring(0, 200));

        // استخدام endpoint الجديد مباشرة
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
            // في حالة فشل خدمة Python، استخدم الطريقة القديمة كـ fallback
            return await translateSrtViaGoogleFallback(srtContent, targetLang);
        }

        const data = await response.json();
        console.log('Translation response received:', Object.keys(data));
        
        if (data.error || !data.translated_srt) {
            console.error("Translation service error:", data.error);
            // في حالة وجود خطأ، استخدم الطريقة القديمة كـ fallback
            return await translateSrtViaGoogleFallback(srtContent, targetLang);
        }

        return data.translated_srt;

    } catch (error) {
        console.error("Error connecting to translation service:", error);
        // في حالة فشل الاتصال، استخدم الطريقة القديمة كـ fallback
        return await translateSrtViaGoogleFallback(srtContent, targetLang);
    }
};

// الطريقة القديمة كـ fallback
const translateSrtViaGoogleFallback = async (srtContent: string, targetLang: string = 'ar'): Promise<string | null> => {
    try {
        const srtBlocks = parseSrt(srtContent);
        if (srtBlocks.length === 0) return srtContent;

        // 1. Filter out only the blocks that need translation.
        const translatableBlocks = srtBlocks.filter(b => b.isTranslatable);
        const originalTextsToTranslate = translatableBlocks.map(b => b.text.replace(/\n/g, ' '));

        // 2. Translate the filtered text in a single batch.
        const translatedTexts = await translateTextBatch(originalTextsToTranslate, targetLang);

        if (originalTextsToTranslate.length !== translatedTexts.length) {
            console.warn("Mismatch in translated segments count. Aborting.");
            return null;
        }

        // 3. Create a map of original text to translated text for easy lookup.
        const translationMap = new Map<string, string>();
        originalTextsToTranslate.forEach((original, index) => {
            translationMap.set(original, translatedTexts[index]);
        });

        // 4. Update the original `srtBlocks` array. For each block, if it was marked
        //    as translatable, replace its text with the translation from the map.
        const finalSrtBlocks = srtBlocks.map(block => {
            if (block.isTranslatable) {
                const originalKey = block.text.replace(/\n/g, ' ');
                const translatedText = translationMap.get(originalKey);
                if (translatedText) {
                    return { ...block, text: translatedText };
                }
            }
            return block; // Return the original block if not translatable or not found in map
        });
        
        // 5. Reconstruct the full SRT file from the updated blocks.
        return reconstructSrt(finalSrtBlocks);

    } catch (error) {
        console.error("Error translating SRT content:", error);
        return null; // Return null on failure
    }
};
