'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Submission } from '@/types';
import { 
  userService, 
  submissionService, 
  convertFirestoreSubmission,
  type FirestoreUser 
} from '@/lib/database';

// Define the user type
interface User {
  id: string;
  email: string;
  candidateName: string;
  candidateId: string;
  clientName: string;
  role: string;
  password?: string; // only for creation, not stored in state
}

// Define the auth context type
interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  register: (details: Omit<User, 'id'> & {password: string}) => Promise<boolean>;
  loading: boolean;
  saveSubmission: (submission: Omit<Submission, 'id' | 'date'>) => Promise<void>;
  getSubmissions: () => Promise<Submission[]>;
  getSubmissionById: (id: string) => Promise<Submission | null>;
  deleteSubmission: (id: string) => Promise<void>;
  clearAllSubmissions: () => Promise<void>;
  getUsers: () => Promise<User[]>;
  deleteUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'admin@gmail.com';

// Convert Firestore user to regular user
const convertFirestoreUser = (fsUser: FirestoreUser): User => {
  return {
    id: fsUser.id,
    email: fsUser.email,
    candidateName: fsUser.candidateName,
    candidateId: fsUser.candidateId,
    clientName: fsUser.clientName,
    role: fsUser.role
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔥 Initializing auth with database-only mode');
        await seedDefaultUsers();
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const seedDefaultUsers = async () => {
    try {
      console.log('🌱 Seeding users in Firestore...');
      console.log('📡 Testing Firestore connection...');
      
      // Test basic Firestore connection first
      try {
        const testUsers = await userService.getAll();
        console.log('✅ Firestore connection successful. Found', testUsers.length, 'existing users');
      } catch (connectionError) {
        console.error('❌ Firestore connection failed:', connectionError);
        return;
      }
      
      // Check if admin user exists
      const existingAdmin = await userService.getByEmail(ADMIN_EMAIL);
      if (existingAdmin) {
        console.log('✅ Admin user already exists in Firestore');
        return;
      }

      console.log('👤 Creating admin user...');
      // Seed admin user
      const adminId = await userService.create({
        email: ADMIN_EMAIL,
        candidateName: 'Admin User',
        candidateId: 'ADMIN001',
        clientName: 'System',
        role: 'admin',
        passwordHash: 'admin123'
      });

      if (adminId) {
        console.log('✅ Admin user created in Firestore with ID:', adminId);
      }

      // Seed 10 test users
      const testUsers = [
        { email: 'candidate1@test.com', name: 'Alice Johnson', id: 'C001', client: 'TechCorp' },
        { email: 'candidate2@test.com', name: 'Bob Smith', id: 'C002', client: 'InnovateCo' },
        { email: 'candidate3@test.com', name: 'Carol Davis', id: 'C003', client: 'StartupXYZ' },
        { email: 'candidate4@test.com', name: 'David Wilson', id: 'C004', client: 'MegaCorp' },
        { email: 'candidate5@test.com', name: 'Eve Brown', id: 'C005', client: 'SmallBiz' },
        { email: 'candidate6@test.com', name: 'Frank Miller', id: 'C006', client: 'Enterprise Ltd' },
        { email: 'candidate7@test.com', name: 'Grace Lee', id: 'C007', client: 'Innovation Hub' },
        { email: 'candidate8@test.com', name: 'Henry Taylor', id: 'C008', client: 'Future Tech' },
        { email: 'candidate9@test.com', name: 'Iris Chen', id: 'C009', client: 'Global Solutions' },
        { email: 'candidate10@test.com', name: 'Jack Anderson', id: 'C010', client: 'Digital Dynamics' }
      ];

      console.log('👥 Creating test users...');
      for (const testUser of testUsers) {
        const existing = await userService.getByEmail(testUser.email);
        if (!existing) {
          const userId = await userService.create({
            email: testUser.email,
            candidateName: testUser.name,
            candidateId: testUser.id,
            clientName: testUser.client,
            role: 'candidate',
            passwordHash: 'password123'
          });
          console.log('👤 Created user:', testUser.email, 'with ID:', userId);
        }
      }

      console.log('✅ Seeded Firestore with 1 admin and 10 test users');
    } catch (error) {
      console.error('❌ Error seeding users in Firestore:', error);
    }
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      console.log('🔐 Logging in user via Firestore:', email);
      console.log('📡 Attempting to connect to Firestore...');
      
      const fsUser = await userService.getByEmail(email);
      console.log('👤 User lookup result:', fsUser ? 'User found' : 'User not found');
      
      if (!fsUser) {
        console.log('❌ User not found in Firestore');
        return false;
      }

      console.log('🔑 Checking password for user:', fsUser.email);
      console.log('🔑 Expected password hash:', fsUser.passwordHash);
      console.log('🔑 Provided password:', pass);
      
      if (fsUser.passwordHash !== pass) {
        console.log('❌ Invalid password');
        return false;
      }

      const userToStore = convertFirestoreUser(fsUser);
      console.log('👤 Converting user data:', userToStore);
      setUser(userToStore);
      console.log('✅ User logged in successfully via Firestore');
      return true;
    } catch (error) {
      console.error('❌ Firestore login error:', error);
      return false;
    }
  };

  const register = async (details: Omit<User, 'id'> & {password: string}): Promise<boolean> => {
    try {
      console.log('📝 Registering new user in Firestore:', details.email);
      
      const existingUser = await userService.getByEmail(details.email);
      if (existingUser) {
        console.log('❌ User already exists in Firestore');
        return false;
      }

      const userId = await userService.create({
        email: details.email,
        candidateName: details.candidateName,
        candidateId: details.candidateId,
        clientName: details.clientName,
        role: details.role,
        passwordHash: details.password
      });

      if (userId) {
        console.log('✅ User registered successfully in Firestore');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Firestore registration error:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('🚪 Logging out user');
    setUser(null);
  };

  const saveSubmission = async (submission: Omit<Submission, 'id' | 'date'>) => {
    try {
      console.log('💾 Saving submission to Firestore');
      await submissionService.create(submission);
      console.log('✅ Submission saved successfully to Firestore');
    } catch (error) {
      console.error('❌ Error saving submission to Firestore:', error);
      throw error;
    }
  };

  const getSubmissions = async (): Promise<Submission[]> => {
    try {
      console.log('📖 Fetching submissions from Firestore');
      const fsSubmissions = await submissionService.getAll();
      const submissions = fsSubmissions.map(convertFirestoreSubmission);
      console.log(`✅ Fetched ${submissions.length} submissions from Firestore`);
      return submissions;
    } catch (error) {
      console.error('❌ Error fetching submissions from Firestore:', error);
      return [];
    }
  };

  const getSubmissionById = async (id: string): Promise<Submission | null> => {
    try {
      console.log('📖 Fetching submission by ID from Firestore:', id);
      const fsSubmission = await submissionService.getById(id);
      if (!fsSubmission) {
        console.log('❌ Submission not found in Firestore');
        return null;
      }
      const submission = convertFirestoreSubmission(fsSubmission);
      console.log('✅ Submission fetched from Firestore');
      return submission;
    } catch (error) {
      console.error('❌ Error fetching submission from Firestore:', error);
      return null;
    }
  };

  const deleteSubmission = async (id: string): Promise<void> => {
    try {
      console.log('🗑️ Deleting submission from Firestore:', id);
      await submissionService.delete(id);
      console.log('✅ Submission deleted from Firestore');
    } catch (error) {
      console.error('❌ Error deleting submission from Firestore:', error);
      throw error;
    }
  };

  const clearAllSubmissions = async (): Promise<void> => {
    try {
      console.log('🗑️ Clearing all submissions from Firestore');
      const submissions = await submissionService.getAll();
      for (const submission of submissions) {
        await submissionService.delete(submission.id);
      }
      console.log('✅ All submissions cleared from Firestore');
    } catch (error) {
      console.error('❌ Error clearing submissions from Firestore:', error);
      throw error;
    }
  };

  const getUsers = async (): Promise<User[]> => {
    try {
      console.log('👥 Fetching users from Firestore');
      const fsUsers = await userService.getAll();
      const users = fsUsers.map(convertFirestoreUser);
      console.log(`✅ Fetched ${users.length} users from Firestore`);
      return users;
    } catch (error) {
      console.error('❌ Error fetching users from Firestore:', error);
      return [];
    }
  };

  const deleteUser = async (userId: string): Promise<void> => {
    try {
      console.log('🗑️ Deleting user from Firestore:', userId);
      await userService.delete(userId);
      console.log('✅ User deleted from Firestore');
    } catch (error) {
      console.error('❌ Error deleting user from Firestore:', error);
      throw error;
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>): Promise<void> => {
    try {
      console.log('📝 Updating user in Firestore:', userId);
      await userService.update(userId, updates);
      console.log('✅ User updated in Firestore');
    } catch (error) {
      console.error('❌ Error updating user in Firestore:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    register,
    loading,
    saveSubmission,
    getSubmissions,
    getSubmissionById,
    deleteSubmission,
    clearAllSubmissions,
    getUsers,
    deleteUser,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export const ProtectedRoute = ({ children, adminOnly = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      console.log('🔐 ProtectedRoute - checking auth state');
      console.log('👤 Current user:', user);
      console.log('🔑 User role:', user?.role);
      console.log('🚪 Admin only required:', adminOnly);
      
      if (!user) {
        console.log('🚫 User not authenticated, redirecting to login');
        router.push('/login');
        return;
      }

      if (adminOnly && user.role !== 'admin' && user.role !== 'Administrator') {
        console.log('🚫 User not admin (role:', user.role, '), redirecting to home');
        console.log('🚫 Required role: admin or Administrator, actual role:', user.role);
        router.push('/');
        return;
      }
      
      console.log('✅ ProtectedRoute - access granted');
    }
  }, [user, loading, router, adminOnly]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600 mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (adminOnly && user.role !== 'admin' && user.role !== 'Administrator')) {
    return null;
  }

  return <>{children}</>;
};
