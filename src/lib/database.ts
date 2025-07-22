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
  Timestamp 
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
  // Get all submissions
  async getAll(): Promise<FirestoreSubmission[]> {
    try {
      const q = query(collection(db, COLLECTIONS.SUBMISSIONS), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FirestoreSubmission));
    } catch (error) {
      console.error('Error fetching submissions:', error);
      return [];
    }
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
      const docRef = await addDoc(collection(db, COLLECTIONS.SUBMISSIONS), {
        ...submissionData,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating submission:', error);
      return null;
    }
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
