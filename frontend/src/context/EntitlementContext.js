import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const EntitlementContext = createContext(null);

export const EntitlementProvider = ({ children }) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/subscription');
      setData(res.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const features = data?.entitlements?.features || {};
  const hasFeature = (key) => Boolean(features[key]);

  return (
    <EntitlementContext.Provider value={{ ...data, loading, hasFeature, refresh }}>
      {children}
    </EntitlementContext.Provider>
  );
};

export const useEntitlements = () => useContext(EntitlementContext) || { hasFeature: () => false, loading: true };
