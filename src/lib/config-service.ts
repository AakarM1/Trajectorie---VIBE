import { configService } from '@/lib/database';

export const configurationService = {
  // Save JDT configuration
  async saveJDTConfig(config: any): Promise<boolean> {
    try {
      console.log('💾 Saving JDT config to Firestore');
      const result = await configService.save('jdt', config);
      console.log('✅ JDT config saved successfully');
      return result;
    } catch (error) {
      console.error('❌ Error saving JDT config to Firestore:', error);
      return false;
    }
  },

  // Get JDT configuration
  async getJDTConfig(): Promise<any | null> {
    try {
      console.log('📖 Fetching JDT config from Firestore');
      const config = await configService.getByType('jdt');
      console.log('✅ JDT config fetched:', config ? 'Found' : 'Not found');
      return config;
    } catch (error) {
      console.error('❌ Error getting JDT config from Firestore:', error);
      return null;
    }
  },

  // Save SJT configuration
  async saveSJTConfig(config: any): Promise<boolean> {
    try {
      console.log('💾 Saving SJT config to Firestore');
      const result = await configService.save('sjt', config);
      console.log('✅ SJT config saved successfully');
      return result;
    } catch (error) {
      console.error('❌ Error saving SJT config to Firestore:', error);
      return false;
    }
  },

  // Get SJT configuration
  async getSJTConfig(): Promise<any | null> {
    try {
      console.log('📖 Fetching SJT config from Firestore');
      const config = await configService.getByType('sjt');
      console.log('✅ SJT config fetched:', config ? 'Found' : 'Not found');
      return config;
    } catch (error) {
      console.error('❌ Error getting SJT config from Firestore:', error);
      return null;
    }
  },

  // Save global settings
  async saveGlobalSettings(settings: any): Promise<boolean> {
    try {
      console.log('💾 Saving global settings to Firestore');
      const result = await configService.save('global', settings);
      console.log('✅ Global settings saved successfully');
      return result;
    } catch (error) {
      console.error('❌ Error saving global settings to Firestore:', error);
      return false;
    }
  },

  // Get global settings
  async getGlobalSettings(): Promise<any | null> {
    try {
      console.log('📖 Fetching global settings from Firestore');
      const settings = await configService.getByType('global');
      console.log('✅ Global settings fetched:', settings ? 'Found' : 'Not found');
      return settings;
    } catch (error) {
      console.error('❌ Error getting global settings from Firestore:', error);
      return null;
    }
  }
};
