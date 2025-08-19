"use client";

import { useState, useEffect } from "react";

interface ConnectionDetails {
  token: string;
  roomName: string;
}

export function useConnectionDetailsNewport() {
  const [token, setToken] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getConnectionDetails() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/connection-details-newport");
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: ConnectionDetails = await response.json();
        
        setToken(data.token);
        setRoomName(data.roomName);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get connection details");
      } finally {
        setIsLoading(false);
      }
    }

    getConnectionDetails();
  }, []);

  return { token, roomName, isLoading, error };
}
