
'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Header from '@/components/header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface User {
  id: string;
  email: string;
  candidateName: string;
  candidateId: string;
  clientName: string;
  role: string;
}

const UserManagementPage = () => {
    const { getUsers, register, deleteUser } = useAuth();
    const { toast } = useToast();

    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [candidateName, setCandidateName] = useState('');
    const [candidateId, setCandidateId] = useState('');
    const [clientName, setClientName] = useState('');
    const [role, setRole] = useState('');

    const fetchUsers = () => {
        const userList = getUsers();
        setUsers(userList);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setCandidateName('');
        setCandidateId('');
        setClientName('');
        setRole('');
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const success = register({
            email,
            password,
            candidateName,
            candidateId,
            clientName,
            role,
        });

        if (success) {
            toast({
                title: 'User Added Successfully',
                description: `Account for ${candidateName} has been created.`,
            });
            fetchUsers(); // Refresh the user list
            resetForm();
        } else {
            toast({
                variant: 'destructive',
                title: 'Registration Failed',
                description: 'An account with this email already exists.',
            });
        }
        setIsLoading(false);
    };
    
    const handleDeleteUser = (userId: string) => {
        deleteUser(userId);
        toast({
            title: 'User Deleted',
            description: 'The user account has been removed.',
        });
        fetchUsers(); // Refresh the list
    };
    
    return (
        <>
            <Header />
            <div className="container mx-auto px-4 sm:px-8 py-8">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-headline text-primary flex items-center gap-4">
                            <Users className="h-10 w-10" />
                            User Management
                        </h1>
                        <p className="text-muted-foreground">Add, view, or remove user accounts.</p>
                    </div>
                     <Link href="/admin" passHref>
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </header>
                <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <Card className="bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><UserPlus /> Add New User</CardTitle>
                                <CardDescription>Create a new candidate or admin account.</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleAddUser}>
                                <CardContent className="space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="candidateName">Full Name</Label>
                                        <Input id="candidateName" placeholder="e.g., Jane Doe" required value={candidateName} onChange={e => setCandidateName(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" placeholder="e.g., user@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password</Label>
                                        <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="candidateId">Candidate ID</Label>
                                        <Input id="candidateId" placeholder="e.g., EMP123" required value={candidateId} onChange={e => setCandidateId(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="clientName">Company / Client Name</Label>
                                        <Input id="clientName" placeholder="e.g., TechCorp" required value={clientName} onChange={e => setClientName(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="role">Test Name / Role</Label>
                                        <Input id="role" placeholder="e.g., Software Engineer" required value={role} onChange={e => setRole(e.target.value)} />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                        Create User
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                         <Card className="bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle>Existing Users</CardTitle>
                                <CardDescription>A list of all users currently in the system.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.length > 0 ? (
                                            users.map((user) => (
                                                <TableRow key={user.id}>
                                                    <TableCell className="font-medium">{user.candidateName}</TableCell>
                                                    <TableCell>{user.email}</TableCell>
                                                    <TableCell>{user.role}</TableCell>
                                                    <TableCell className="text-right">
                                                        {user.email !== 'admin@gmail.com' && (
                                                            <AlertDialog>
                                                              <AlertDialogTrigger asChild>
                                                                 <Button variant="ghost" size="icon">
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                              </AlertDialogTrigger>
                                                              <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                  <AlertDialogDescription>
                                                                    This action cannot be undone. This will permanently delete the user account for {user.candidateName}.
                                                                  </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                  <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">
                                                                    Delete User
                                                                  </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                              </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                    No users found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </>
    );
};

const ProtectedUserManagementPage = () => (
    <ProtectedRoute adminOnly>
        <UserManagementPage />
    </ProtectedRoute>
);

export default ProtectedUserManagementPage;
