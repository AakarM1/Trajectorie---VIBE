/**
 * Language Context for Multilingual Support
 * Manages user language preferences with live Firestore subscription
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { useAuth } from './auth-context';
import { translationService } from '@/lib/translation-service';
import { catalogLoader } from '@/lib/i18n/catalog-loader';
import { featureFlags } from '@/lib/feature-flags';
import { isRTLLanguage, getLanguageDisplayName } from '@/lib/i18n-utils';
import { db } from '@/lib/firebase';

interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  rtl?: boolean;
}

interface LanguageContextType {
  // Current language state
  currentLanguage: string;
  isRTL: boolean;
  ready: boolean;
  
  // Supported languages (from admin config)
  supportedLanguages: LanguageInfo[];
  defaultLanguage: string;
  
  // Language management
  setLanguage: (languageCode: string) => Promise<void>;
  getSupportedLanguages: () => LanguageInfo[];
  
  // Translation utilities  
  translate: (text: string, targetLang?: string) => Promise<string>;
  translateBatch: (texts: string[], targetLang?: string) => Promise<string[]>;
  getTranslation: (key: string, fallback?: string) => Promise<string>;
  
  // Feature flag
  isMultilingualEnabled: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

const LANGUAGE_STORAGE_KEY = 'user-language-preference';
const DEFAULT_LANGUAGE = 'en';

/**
 * Utility function to detect language code from admin language name
 */
const detectLanguageCode = (languageName: string): string => {
  const lowerName = languageName.toLowerCase();
  
  // Language name to code mapping
  const nameToCode: Record<string, string> = {
    'english': 'en',
    'spanish': 'es', 'español': 'es',
    'french': 'fr', 'français': 'fr', 'francais': 'fr',
    'german': 'de', 'deutsch': 'de',
    'arabic': 'ar', 'العربية': 'ar',
    'chinese': 'zh', '中文': 'zh', 'mandarin': 'zh',
    'japanese': 'ja', '日本語': 'ja',
    'korean': 'ko', '한국어': 'ko',
    'portuguese': 'pt', 'português': 'pt', 'portugues': 'pt',
    'russian': 'ru', 'русский': 'ru',
    'italian': 'it', 'italiano': 'it',
    'dutch': 'nl', 'nederlands': 'nl',
    'hindi': 'hi', 'हिन्दी': 'hi',
    'urdu': 'ur', 'اردو': 'ur'
  };
  
  return nameToCode[lowerName] || 'en'; // Default to English if not found
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { user, updateUser } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [isRTL, setIsRTL] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);
  const [supportedLanguages, setSupportedLanguages] = useState<LanguageInfo[]>([]);
  const [defaultLanguage] = useState<string>(DEFAULT_LANGUAGE);
  
  const isMultilingualEnabled = featureFlags.isI18nEnabled();
  
  // Live subscription to global settings for supported languages
  useEffect(() => {
    if (!isMultilingualEnabled) {
      setSupportedLanguages([{ code: 'en', name: 'English', nativeName: 'English' }]);
      setReady(true);
      return;
    }

    console.log('🔄 Setting up live language subscription');
    
    // Subscribe to global settings document
    const globalConfigRef = doc(db, 'configurations', 'global-settings');
    
    const unsubscribe: Unsubscribe = onSnapshot(
      globalConfigRef,
      (docSnapshot) => {
        console.log('🔄 Global config updated');
        
        let languages: string[] = ['English']; // Default fallback
        
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (data?.languages && Array.isArray(data.languages)) {
            languages = data.languages;
          }
        }
        
        // Convert admin language names to LanguageInfo objects
        const languageInfos: LanguageInfo[] = languages.map(langName => {
          // Try to detect language code from name
          const code = detectLanguageCode(langName);
          return {
            code,
            name: langName,
            nativeName: getLanguageDisplayName(code),
            rtl: isRTLLanguage(code)
          };
        });
        
        console.log('🌍 Updated supported languages:', languageInfos);
        setSupportedLanguages(languageInfos);
        setReady(true);
      },
      (error) => {
        console.error('❌ Error subscribing to global settings:', error);
        // Fallback to English only
        setSupportedLanguages([{ code: 'en', name: 'English', nativeName: 'English' }]);
        setReady(true);
      }
    );
    
    return () => {
      console.log('🔄 Cleaning up language subscription');
      unsubscribe();
    };
  }, [isMultilingualEnabled]);
  
  // Initialize user's preferred language
  useEffect(() => {
    const initializeLanguage = async () => {
      if (!ready) return;
      
      let preferredLang = DEFAULT_LANGUAGE;
      
      // Priority 1: User's saved preference in profile
      if (user?.preferredLanguage) {
        preferredLang = user.preferredLanguage;
      } 
      // Priority 2: Browser localStorage
      else if (typeof window !== 'undefined') {
        const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLang) {
          preferredLang = savedLang;
        }
      }
      
      // Validate against supported languages
      const isSupported = supportedLanguages.some(lang => lang.code === preferredLang);
      if (!isSupported) {
        console.warn(`Language ${preferredLang} not supported, falling back to ${DEFAULT_LANGUAGE}`);
        preferredLang = DEFAULT_LANGUAGE;
      }
      
      await setLanguageInternal(preferredLang);
    };

    initializeLanguage();
  }, [user, ready, supportedLanguages]);

  const setLanguageInternal = async (languageCode: string) => {
    console.log(`🌍 Setting language to: ${languageCode}`);
    
    setCurrentLanguage(languageCode);
    setIsRTL(isRTLLanguage(languageCode));
    
    // Update document direction
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTLLanguage(languageCode) ? 'rtl' : 'ltr';
      document.documentElement.lang = languageCode;
    }
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    }
    
    // Update user profile if logged in
    if (user && user.preferredLanguage !== languageCode) {
      try {
        await updateUser(user.id, { preferredLanguage: languageCode });
        console.log('💾 Updated user language preference');
      } catch (error) {
        console.error('❌ Failed to update user language preference:', error);
      }
    }
  };

  const setLanguage = async (languageCode: string): Promise<void> => {
    // Validate language is supported
    const isSupported = supportedLanguages.some(lang => lang.code === languageCode);
    if (!isSupported) {
      console.error(`Language ${languageCode} is not supported`);
      return;
    }
    
    await setLanguageInternal(languageCode);
  };

  const getSupportedLanguages = (): LanguageInfo[] => {
    return supportedLanguages;
  };

  const translate = async (text: string, targetLang?: string): Promise<string> => {
    if (!isMultilingualEnabled) return text;
    
    const target = targetLang || currentLanguage;
    if (target === 'en') return text; // No translation needed for English
    
    try {
      return await translationService.translate(text, target, 'en');
    } catch (error) {
      console.warn('Translation failed:', error);
      return text; // Fallback to original
    }
  };

  const translateBatch = async (texts: string[], targetLang?: string): Promise<string[]> => {
    if (!isMultilingualEnabled) return texts;
    
    const target = targetLang || currentLanguage;
    if (target === 'en') return texts; // No translation needed for English
    
    try {
      const requests = texts.map(text => ({
        text,
        targetLang: target,
        sourceLang: 'en'
      }));
      
      const results = await translationService.translateBatch(requests);
      return results.map(result => result.success ? result.translated : result.original);
    } catch (error) {
      console.warn('Batch translation failed:', error);
      return texts; // Fallback to originals
    }
  };

  const getTranslation = async (key: string, fallback?: string): Promise<string> => {
    if (!isMultilingualEnabled) return fallback || key;
    
    try {
      return await catalogLoader.getTranslation(currentLanguage, key);
    } catch (error) {
      console.error(`Failed to get translation for key: ${key}`, error);
      return fallback || key;
    }
  };

  const value: LanguageContextType = {
    currentLanguage,
    isRTL,
    ready,
    supportedLanguages,
    defaultLanguage,
    setLanguage,
    getSupportedLanguages,
    translate,
    translateBatch,
    getTranslation,
    isMultilingualEnabled
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
