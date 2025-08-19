"use client";

import { useState } from 'react';
import { Room } from 'livekit-client';
import { motion } from 'motion/react';
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';
import { SessionView } from '@/components/session-view';
import { Toaster } from '@/components/ui/sonner';
import { Welcome } from '@/components/welcome';
import { useConnectionDetailsNewport } from '@/hooks/useConnectionDetailsNewport';
import type { AppConfig } from '@/lib/types';
import { LeadCaptureForm } from '@/src/LeadCaptureForm';
import { LiveKitSessionManager } from './livekit-session-manager';

const MotionWelcome = motion.create(Welcome);

export function AppNewport() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const { token, roomName, isLoading, error } = useConnectionDetailsNewport();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [leadData, setLeadData] = useState(null);

  // Default app config for Newport
  const appConfig: AppConfig = {
    startButtonText: "Start Newport Beach Call",
    supportsChatInput: true,
    supportsVideoInput: false,
    supportsScreenShare: false,
    isPreConnectBufferEnabled: true,
  };

  const onDisconnected = () => {
    console.log(`[${new Date().toISOString()}] APP: Disconnected from Newport room.`);
    setSessionStarted(false);
  };

  const onMediaDevicesError = (error: Error) => {
    toastAlert({
      title: 'Encountered an error with your media devices',
      description: `${error.name}: ${error.message}`,
    });
  };

  const handleFormSubmit = async (room: Room, data: any) => {
    if (!room || !room.localParticipant) {
      console.error('Room instance not available for RPC.');
      return;
    }
    try {
      const payload = JSON.stringify(data);
      await room.localParticipant.performRpc({
        destinationIdentity: 'input-right-agent',
        method: 'submit_lead_form',
        payload: payload,
      });
      toastAlert({
        title: 'Sent!',
        description: 'Your information has been sent to the team.',
      });
    } catch (e) {
      console.error('Failed to send RPC to agent:', e);
      toastAlert({
        title: 'Error',
        description: 'Could not send your information. Please try again.',
      });
    }
    setIsFormVisible(false);
    setLeadData(null);
  };

  const handleFormCancel = () => {
    setIsFormVisible(false);
    setLeadData(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-lg text-blue-900">Connecting to Newport Beach Vacation Properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
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

        <MotionWelcome
          key="welcome"
          startButtonText={appConfig.startButtonText}
          onStartCall={() => setSessionStarted(true)}
          disabled={sessionStarted || !token}
          initial={{ opacity: 0 }}
          animate={{ opacity: sessionStarted ? 0 : 1 }}
          transition={{ duration: 0.5, ease: 'linear', delay: sessionStarted ? 0 : 0.5 }}
        />

        {sessionStarted && token && (
          <LiveKitRoom
            serverUrl="wss://fansfit-gogh835r.livekit.cloud"
            token={token}
            audio={true}
            onConnected={() => {
              console.log(`[${new Date().toISOString()}] APP: Newport LiveKitRoom connected.`);
            }}
            onDisconnected={onDisconnected}
            onError={onMediaDevicesError}
            style={{ height: '100dvh' }}
          >
            <RoomAudioRenderer />
            <StartAudio label="Start Audio" />

            <motion.div
              key="session-view-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: 'linear', delay: 0.5 }}
            >
              <SessionView appConfig={appConfig} />
            </motion.div>

            <LiveKitSessionManager
              appConfig={appConfig}
              onDisplayForm={(data) => {
                setLeadData(data);
                setIsFormVisible(true);
              }}
            />

            {isFormVisible && leadData && (
              <LeadCaptureForm
                initialData={leadData as any}
                onSubmit={(room, data) => handleFormSubmit(room, data)}
                onCancel={handleFormCancel}
              />
            )}
          </LiveKitRoom>
        )}

        <Toaster />
      </div>
    </div>
  );
}
