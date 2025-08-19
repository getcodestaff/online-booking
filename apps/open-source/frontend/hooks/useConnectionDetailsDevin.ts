import { useState, useCallback, useEffect } from 'react';

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export default function useConnectionDetailsDevin() {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);

  const fetchConnectionDetails = useCallback(() => {
    setConnectionDetails(null);
    const getDetails = async () => {
      try {
        const resp = await fetch('/api/connection-details-devin');
        if (!resp.ok) {
          throw new Error(`Failed to fetch connection details: ${resp.statusText}`);
        }
        const data = await resp.json();
        setConnectionDetails(data);
      } catch (error) {
        console.error('Error fetching connection details:', error);
      }
    };
    getDetails();
  }, []);

  useEffect(() => {
    fetchConnectionDetails();
  }, [fetchConnectionDetails]);

  return { connectionDetails, refreshConnectionDetails: fetchConnectionDetails };
}
