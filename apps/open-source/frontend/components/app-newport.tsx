"use client";

import { SessionView } from "./session-view";
import { useConnectionDetailsNewport } from "@/hooks/useConnectionDetailsNewport";

export function AppNewport() {
  const { token, roomName, isLoading, error } = useConnectionDetailsNewport();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Connecting to Newport Beach Vacation Properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">
            Newport Beach Vacation Properties
          </h1>
          <p className="text-lg text-blue-700">
            Connecting you with Pelican Petey for your reservation confirmation
          </p>
        </div>
        
        <SessionView 
          token={token} 
          roomName={roomName}
          agentName="Pelican Petey"
          agentDescription="Newport Beach Vacation Properties Reservation Specialist"
        />
      </div>
    </div>
  );
}
