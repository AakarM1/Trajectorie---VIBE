import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Submission } from '@/types';

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  SUBMISSIONS: 'submissions',
  CONFIGURATIONS: 'configurations',
  SETTINGS: 'settings'
} as const;

// User interface for Firestore
export interface FirestoreUser {
  id: string;
  email: string;
  candidateName: string;
  candidateId: string;
  clientName: string;
  role: string;
  passwordHash?: string; // In real app, store hashed passwords
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Configuration interface for Firestore
export interface FirestoreConfig {
  id: string;
  type: 'jdt' | 'sjt' | 'global';
  data: any;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Firestore Submission interface
export interface FirestoreSubmission extends Omit<Submission, 'date'> {
  date: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// User operations
export const userService = {
  // Get all users
  async getAll(): Promise<FirestoreUser[]> {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FirestoreUser));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  },

  // Get user by email
  async getByEmail(email: string): Promise<FirestoreUser | null> {
    try {
      const q = query(collection(db, COLLECTIONS.USERS), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as FirestoreUser;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  },

  // Create new user
  async create(userData: Omit<FirestoreUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.USERS), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  },

  // Update user
  async update(userId: string, updates: Partial<Omit<FirestoreUser, 'id' | 'createdAt'>>): Promise<boolean> {
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  },

  // Delete user
  async delete(userId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }
};

// Submission operations
export const submissionService = {
  // Get all submissions (one-time fetch)
  async getAll(): Promise<FirestoreSubmission[]> {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.SUBMISSIONS));
      const submissions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FirestoreSubmission));
      
      // Sort by date field instead of createdAt to avoid index requirements
      return submissions.sort((a, b) => {
        const aTime = a.date?.toMillis ? a.date.toMillis() : 0;
        const bTime = b.date?.toMillis ? b.date.toMillis() : 0;
        return bTime - aTime; // descending order (newest first)
      });
    } catch (error) {
      console.error('Error fetching submissions:', error);
      return [];
    }
  },

  // Listen to all submissions (real-time)
  onSubmissionsChange(callback: (submissions: FirestoreSubmission[]) => void): Unsubscribe {
    console.log('🔄 Setting up Firestore real-time listener for submissions');
    const q = collection(db, COLLECTIONS.SUBMISSIONS);
    return onSnapshot(q, (querySnapshot) => {
      console.log(`🔄 Firestore listener triggered: ${querySnapshot.docs.length} documents found`);
      
      const submissions = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`📄 Document ${doc.id}:`, {
          candidateName: data.candidateName,
          testType: data.testType,
          hasDate: !!data.date,
          hasCreatedAt: !!data.createdAt
        });
        return {
          id: doc.id,
          ...data
        } as FirestoreSubmission;
      });
      
      // Sort by date field instead of createdAt to avoid index requirements
      const sortedSubmissions = submissions.sort((a, b) => {
        const aTime = a.date?.toMillis ? a.date.toMillis() : 0;
        const bTime = b.date?.toMillis ? b.date.toMillis() : 0;
        return bTime - aTime; // descending order (newest first)
      });
      
      console.log(`🔄 Sending ${sortedSubmissions.length} sorted submissions to callback`);
      callback(sortedSubmissions);
    }, (error) => {
      console.error('❌ Error listening to submissions:', error);
      callback([]); // Return empty array on error
    });
  },

  // Get submission by ID
  async getById(submissionId: string): Promise<FirestoreSubmission | null> {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.SUBMISSIONS, submissionId));
      if (!docSnap.exists()) return null;
      
      return { id: docSnap.id, ...docSnap.data() } as FirestoreSubmission;
    } catch (error) {
      console.error('Error fetching submission:', error);
      return null;
    }
  },

  // Create new submission
  async create(submissionData: Omit<Submission, 'id' | 'date'>): Promise<string | null> {
    try {
      console.log('🗄️ Creating submission in Firestore:', {
        candidateName: submissionData.candidateName,
        testType: submissionData.testType
      });
      
      // Clean the data to remove undefined values
      const cleanedData = this.removeUndefinedFields(submissionData);
      console.log('🧹 Cleaned submission data:', cleanedData);
      
      const docRef = await addDoc(collection(db, COLLECTIONS.SUBMISSIONS), {
        ...cleanedData,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Submission document created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating submission:', error);
      console.error('❌ Submission data that failed:', submissionData);
      return null;
    }
  },

  // Helper function to remove undefined fields recursively
  removeUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedFields(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedFields(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  },

  // Delete submission
  async delete(submissionId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.SUBMISSIONS, submissionId));
      return true;
    } catch (error) {
      console.error('Error deleting submission:', error);
      return false;
    }
  }
};

// Configuration operations
export const configService = {
  // Get configuration by type
  async getByType(type: 'jdt' | 'sjt' | 'global'): Promise<any | null> {
    try {
      const q = query(collection(db, COLLECTIONS.CONFIGURATIONS), where('type', '==', type));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      
      const doc = querySnapshot.docs[0];
      const data = doc.data() as FirestoreConfig;
      return data.data;
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return null;
    }
  },

  // Save configuration
  async save(type: 'jdt' | 'sjt' | 'global', configData: any): Promise<boolean> {
    try {
      // Check if config already exists
      const q = query(collection(db, COLLECTIONS.CONFIGURATIONS), where('type', '==', type));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Create new config
        await addDoc(collection(db, COLLECTIONS.CONFIGURATIONS), {
          type,
          data: configData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // Update existing config
        const docId = querySnapshot.docs[0].id;
        await updateDoc(doc(db, COLLECTIONS.CONFIGURATIONS, docId), {
          data: configData,
          updatedAt: serverTimestamp()
        });
      }
      return true;
    } catch (error) {
      console.error('Error saving configuration:', error);
      return false;
    }
  }
};

// Utility function to convert Firestore timestamp to JS Date
export const timestampToDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

// Utility function to convert Firestore submission to regular submission
export const convertFirestoreSubmission = (fsSubmission: FirestoreSubmission): Submission => {
  return {
    ...fsSubmission,
    date: timestampToDate(fsSubmission.date).toISOString()
  };
};
