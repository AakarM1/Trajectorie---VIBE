'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

export default function UserList() {
  const [users, setUsers] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const { getUsers, user } = useAuth();

  // Only show component if user is logged in and is an admin
  const isAdmin = user && (user.role === 'Administrator' || user.email === 'admin@gmail.com');

  const fetchUsers = async () => {
    try {
      const userList = await getUsers();
      setUsers(userList);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    if (isVisible && isAdmin) {
      fetchUsers();
    }
  }, [isVisible, isAdmin]);

  // Don't render anything if user is not logged in or not an admin
  if (!user || !isAdmin) {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 bg-red-600 text-white px-4 py-2 rounded shadow-lg hover:bg-red-700 transition-colors z-50 text-sm"
        title="Admin Only: View All Users"
      >
        👥 Admin Panel ({users.length || '?'})
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white border rounded-lg shadow-xl p-4 max-w-md max-h-96 overflow-y-auto z-50 border-red-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-lg text-red-600 flex items-center gap-2">
          🔐 Admin Panel - User Management
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 text-xl"
        >
          ✕
        </button>
      </div>
      
      <div className="mb-3 text-xs text-gray-600 bg-red-50 p-2 rounded border border-red-200">
        <strong>Admin Access:</strong> {user?.candidateName} ({user?.email})
      </div>
      
      <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
        {users.map((user, index) => (
          <div key={user.id || index} className="border-b pb-2">
            <div className="font-medium text-blue-600 flex items-center gap-2">
              {user.role === 'Administrator' ? '👑' : '👤'} {user.email}
            </div>
            <div className="text-gray-600">{user.candidateName}</div>
            <div className="text-xs text-gray-500">
              {user.role} at {user.clientName}
            </div>
            <div className="text-xs text-gray-400">ID: {user.candidateId}</div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-2 border-t text-xs text-gray-500">
        Total: {users.length} users ({users.filter(u => u.role === 'Administrator').length} admin, {users.length - users.filter(u => u.role === 'Administrator').length} regular)
      </div>
      
      <button
        onClick={fetchUsers}
        className="mt-2 w-full bg-red-100 text-red-700 px-3 py-1 rounded text-xs hover:bg-red-200 transition-colors"
      >
        🔄 Refresh User List
      </button>
    </div>
  );
}
