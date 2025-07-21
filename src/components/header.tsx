
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, UserPlus, Shield, Home } from 'lucide-react';
import Image from 'next/image';

const ADMIN_EMAIL = 'admin@gmail.com';

export default function Header() {
    const { user, logout, loading } = useAuth();

    if (loading) return null;

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card">
            <div className="container flex h-16 max-w-screen-2xl items-center">
                <div className="flex-none">
                    <Link href="/" className="flex items-center space-x-2">
                        <Image src="/logo.png" alt="Trajectorie Logo" width={140} height={30} priority />
                    </Link>
                </div>

                <div className="flex-grow"></div>
                
                <div className="flex flex-none items-center justify-end space-x-4">
                     <Image src="https://placehold.co/100x30.png" alt="Client Logo" width={100} height={30} data-ai-hint="logo" />
                     <span className="text-sm text-muted-foreground hidden sm:inline">|</span>
                    {user ? (
                        <>
                            <span className="text-sm font-semibold hidden sm:inline">HELLO {user.candidateName.toUpperCase()}</span>
                             <Link href={user.email === ADMIN_EMAIL ? '/admin' : '/'} passHref>
                                <Button variant="ghost" size="sm">
                                    <Home className="mr-2 h-4 w-4" />
                                    HOME
                                </Button>
                            </Link>
                            {user.email === ADMIN_EMAIL && (
                                <Link href="/admin" passHref>
                                    <Button variant="ghost" size="sm">
                                        <Shield className="mr-2 h-4 w-4" />
                                        Admin
                                    </Button>
                                </Link>
                            )}
                            <Button onClick={logout} variant="outline" size="sm">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </Button>
                        </>
                    ) : (
                         <>
                            <Link href="/login" passHref>
                                <Button variant="ghost">
                                    <LogIn className="mr-2 h-4 w-4" />
                                    Login
                                </Button>
                            </Link>
                            <Link href="/register" passHref>
                                <Button>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Register
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
