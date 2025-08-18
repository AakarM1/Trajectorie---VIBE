/**
 * i18n Catalog Loader
 * Handles loading translation catalogs from multiple sources:
 * 1. Local files (/public/locales/{lang}/common.json)
 * 2. Firestore (/i18n/catalogs/{lang}/common)
 * 3. Machine translation fallback via TranslationService
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { translationService } from '@/lib/translation-service';

interface CatalogEntry {
  [key: string]: string;
}

interface CacheEntry {
  catalog: CatalogEntry;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CatalogLoader {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly COLLECTION_PATH = 'i18n';
  private readonly DOCUMENT_PATH = 'catalogs';

  /**
   * Load translation catalog for a language
   */
  async loadCatalog(languageCode: string): Promise<CatalogEntry> {
    console.log(`🌍 Loading catalog for ${languageCode}`);
    
    // Check cache first
    const cached = this.getCachedCatalog(languageCode);
    if (cached) {
      console.log(`📋 Using cached catalog for ${languageCode}`);
      return cached;
    }

    try {
      // Try local file first
      const localCatalog = await this.loadLocalCatalog(languageCode);
      if (localCatalog && Object.keys(localCatalog).length > 0) {
        console.log(`📁 Loaded local catalog for ${languageCode}`);
        this.setCachedCatalog(languageCode, localCatalog);
        return localCatalog;
      }
    } catch (error) {
      console.log(`📁 No local catalog for ${languageCode}:`, error);
    }

    try {
      // Try Firestore catalog
      const firestoreCatalog = await this.loadFirestoreCatalog(languageCode);
      if (firestoreCatalog && Object.keys(firestoreCatalog).length > 0) {
        console.log(`🔥 Loaded Firestore catalog for ${languageCode}`);
        this.setCachedCatalog(languageCode, firestoreCatalog);
        return firestoreCatalog;
      }
    } catch (error) {
      console.log(`🔥 No Firestore catalog for ${languageCode}:`, error);
    }

    // Fallback: create minimal catalog and translate progressively
    console.log(`🤖 Creating fallback catalog for ${languageCode}`);
    const fallbackCatalog = await this.createFallbackCatalog(languageCode);
    this.setCachedCatalog(languageCode, fallbackCatalog);
    
    // Async: save to Firestore for future use
    this.saveFirestoreCatalog(languageCode, fallbackCatalog).catch(console.error);
    
    return fallbackCatalog;
  }

  /**
   * Get a specific translation key
   */
  async getTranslation(languageCode: string, key: string): Promise<string> {
    const catalog = await this.loadCatalog(languageCode);
    
    if (catalog[key]) {
      return catalog[key];
    }

    // Key missing - try to translate from English
    console.log(`🔍 Missing key "${key}" for ${languageCode}, attempting translation`);
    
    try {
      const englishCatalog = await this.loadCatalog('en');
      const englishText = englishCatalog[key];
      
      if (englishText && languageCode !== 'en') {
        const translatedText = await translationService.translate(englishText, languageCode, 'en');
        
        // Update catalog with new translation
        catalog[key] = translatedText;
        this.setCachedCatalog(languageCode, catalog);
        
        // Async: update Firestore
        this.updateFirestoreCatalogKey(languageCode, key, translatedText).catch(console.error);
        
        return translatedText;
      }
      
      return englishText || key; // Fallback to English or key itself
    } catch (error) {
      console.error(`Failed to translate key "${key}" for ${languageCode}:`, error);
      return key; // Ultimate fallback
    }
  }

  /**
   * Load catalog from local file
   */
  private async loadLocalCatalog(languageCode: string): Promise<CatalogEntry | null> {
    const response = await fetch(`/locales/${languageCode}/common.json`);
    if (!response.ok) {
      return null;
    }
    return response.json();
  }

  /**
   * Load catalog from Firestore
   */
  private async loadFirestoreCatalog(languageCode: string): Promise<CatalogEntry | null> {
    const docRef = doc(db, this.COLLECTION_PATH, this.DOCUMENT_PATH, languageCode, 'common');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as CatalogEntry;
    }
    
    return null;
  }

  /**
   * Save catalog to Firestore
   */
  private async saveFirestoreCatalog(languageCode: string, catalog: CatalogEntry): Promise<void> {
    const docRef = doc(db, this.COLLECTION_PATH, this.DOCUMENT_PATH, languageCode, 'common');
    await setDoc(docRef, catalog);
    console.log(`💾 Saved catalog for ${languageCode} to Firestore`);
  }

  /**
   * Update a single key in Firestore catalog
   */
  private async updateFirestoreCatalogKey(languageCode: string, key: string, value: string): Promise<void> {
    const docRef = doc(db, this.COLLECTION_PATH, this.DOCUMENT_PATH, languageCode, 'common');
    await updateDoc(docRef, { [key]: value });
    console.log(`🔄 Updated key "${key}" for ${languageCode} in Firestore`);
  }

  /**
   * Create fallback catalog with seed keys
   */
  private async createFallbackCatalog(languageCode: string): Promise<CatalogEntry> {
    const seedKeys = {
      // Common UI elements
      'common.start': 'Start',
      'common.next': 'Next',
      'common.previous': 'Previous', 
      'common.submit': 'Submit',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',
      'common.close': 'Close',
      
      // Interview specific
      'interview.start_test': 'Start Test',
      'interview.question': 'Question',
      'interview.your_answer': 'Your Answer',
      'interview.time_remaining': 'Time Remaining',
      'interview.record_answer': 'Record Answer',
      'interview.stop_recording': 'Stop Recording',
      'interview.next_question': 'Next Question',
      'interview.finish_test': 'Finish Test',
      'interview.test_completed': 'Test Completed',
      'interview.thank_you': 'Thank you for completing the assessment',
      
      // Form elements
      'form.name': 'Name',
      'form.email': 'Email',
      'form.role': 'Role',
      'form.language': 'Language',
      'form.select_option': 'Select an option',
      'form.required_field': 'This field is required'
    };

    if (languageCode === 'en') {
      return seedKeys;
    }

    // Translate seed keys for non-English languages
    const translatedCatalog: CatalogEntry = {};
    
    for (const [key, englishText] of Object.entries(seedKeys)) {
      try {
        const translatedText = await translationService.translate(englishText, languageCode, 'en');
        translatedCatalog[key] = translatedText;
      } catch (error) {
        console.warn(`Failed to translate seed key "${key}":`, error);
        translatedCatalog[key] = englishText; // Fallback to English
      }
    }

    return translatedCatalog;
  }

  /**
   * Cache management
   */
  private getCachedCatalog(languageCode: string): CatalogEntry | null {
    const cached = this.cache.get(languageCode);
    if (cached && Date.now() < cached.timestamp + cached.ttl) {
      return cached.catalog;
    }
    
    if (cached) {
      this.cache.delete(languageCode); // Remove expired cache
    }
    
    return null;
  }

  private setCachedCatalog(languageCode: string, catalog: CatalogEntry): void {
    this.cache.set(languageCode, {
      catalog,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
  }

  /**
   * Clear cache for a specific language or all languages
   */
  clearCache(languageCode?: string): void {
    if (languageCode) {
      this.cache.delete(languageCode);
    } else {
      this.cache.clear();
    }
  }
}

// Export singleton instance
export const catalogLoader = new CatalogLoader();
