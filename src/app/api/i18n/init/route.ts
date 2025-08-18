/**
 * API Route for Translation Catalog Initialization
 * Called when admin adds new languages to bootstrap translation support
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { translationService } from '@/lib/translation-service';

interface CatalogInitRequest {
  language: string;      // Language name (e.g., "Spanish", "French")
  languageCode: string;  // ISO code (e.g., "es", "fr")
  priorityKeys?: string[]; // High-priority UI strings to translate first
}

/**
 * Bootstrap translation catalog for a new language
 */
export async function POST(request: NextRequest) {
  try {
    const body: CatalogInitRequest = await request.json();
    const { language, languageCode, priorityKeys = [] } = body;
    
    console.log(`🌍 Bootstrapping translation catalog for ${language} (${languageCode})`);
    
    // Validate inputs
    if (!language || !languageCode) {
      return NextResponse.json(
        { error: 'Language name and code are required' },
        { status: 400 }
      );
    }
    
    // Default UI strings to translate immediately
    const defaultKeys = [
      'common.welcome',
      'common.loading',
      'common.save',
      'common.cancel',
      'common.next',
      'common.previous',
      'common.submit',
      'common.error',
      'common.success',
      'nav.dashboard',
      'nav.interview',
      'nav.report',
      'nav.settings',
      'interview.start',
      'interview.recording',
      'interview.complete',
      'report.analysis',
      'report.summary',
      'admin.languages',
      'admin.users',
      'auth.login',
      'auth.logout',
      'auth.register'
    ];
    
    const keysToTranslate = [...new Set([...defaultKeys, ...priorityKeys])];
    
    // Create initial catalog document structure
    const catalogRef = doc(db, 'translation-catalogs', languageCode);
    
    // Check if catalog already exists
    const existingDoc = await getDoc(catalogRef);
    if (existingDoc.exists()) {
      console.log(`📚 Catalog for ${languageCode} already exists, updating...`);
    }
    
    // Prepare translation requests for high-priority strings
    const translationPromises = keysToTranslate.map(async (key) => {
      try {
        // Use key as fallback text for translation
        const fallbackText = key.split('.').pop() || key; // Use last part of key
        const translated = await translationService.translate(
          fallbackText,
          languageCode,
          'en'
        );
        
        return { key, value: translated };
      } catch (error) {
        console.warn(`Failed to translate key: ${key}`, error);
        return { key, value: key }; // Fallback to key itself
      }
    });
    
    // Wait for initial translations
    const translations = await Promise.all(translationPromises);
    
    // Build catalog structure
    const catalogData = {
      language,
      languageCode,
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
      completeness: 0, // Will be calculated later
      strings: {} as Record<string, string>
    };
    
    // Organize translations by namespace
    translations.forEach(({ key, value }) => {
      catalogData.strings[key] = value;
    });
    
    // Save to Firestore
    await setDoc(catalogRef, catalogData, { merge: true });
    
    console.log(`✅ Created catalog for ${language} with ${translations.length} initial strings`);
    
    // Return success with catalog info
    return NextResponse.json({
      success: true,
      language,
      languageCode,
      initialStrings: translations.length,
      catalog: {
        version: catalogData.version,
        lastUpdated: catalogData.lastUpdated,
        stringCount: translations.length
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize translation catalog:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to initialize translation catalog',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get catalog status for a language
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const languageCode = searchParams.get('code');
    
    if (!languageCode) {
      return NextResponse.json(
        { error: 'Language code is required' },
        { status: 400 }
      );
    }
    
    // Get catalog document
    const catalogRef = doc(db, 'translation-catalogs', languageCode);
    const catalogDoc = await getDoc(catalogRef);
    
    if (!catalogDoc.exists()) {
      return NextResponse.json(
        { exists: false, languageCode },
        { status: 404 }
      );
    }
    
    const data = catalogDoc.data();
    
    return NextResponse.json({
      exists: true,
      languageCode,
      language: data?.language,
      version: data?.version,
      lastUpdated: data?.lastUpdated,
      stringCount: Object.keys(data?.strings || {}).length,
      completeness: data?.completeness || 0
    });
    
  } catch (error) {
    console.error('❌ Failed to get catalog status:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get catalog status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Delete a translation catalog
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const languageCode = searchParams.get('code');
    
    if (!languageCode) {
      return NextResponse.json(
        { error: 'Language code is required' },
        { status: 400 }
      );
    }
    
    // Don't allow deleting English catalog
    if (languageCode === 'en') {
      return NextResponse.json(
        { error: 'Cannot delete English language catalog' },
        { status: 403 }
      );
    }
    
    // Delete catalog document
    const catalogRef = doc(db, 'translation-catalogs', languageCode);
    await deleteDoc(catalogRef);
    
    console.log(`🗑️ Deleted translation catalog for ${languageCode}`);
    
    return NextResponse.json({
      success: true,
      languageCode,
      message: 'Translation catalog deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Failed to delete catalog:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to delete catalog',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
