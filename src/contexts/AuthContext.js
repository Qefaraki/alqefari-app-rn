import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await checkAdminStatus(session.user);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUser(user);
        await checkAdminStatus(user);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAdminStatus = async (user) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    // Never show admin for anonymous users
    if (user.is_anonymous) {
      setIsAdmin(false);
      return;
    }

    try {
      // Use RPC function to bypass RLS issues
      const { data, error } = await supabase
        .rpc('is_admin');

      if (error) {
        console.log("Admin check error:", error);
        setIsAdmin(false);
      } else {
        console.log("Admin check for user:", user.id, "Result:", data, "Email:", user.email);
        setIsAdmin(data === true);
      }
    } catch (error) {
      console.log("Admin check exception:", error);
      setIsAdmin(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        checkAuth,
        checkAdminStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};