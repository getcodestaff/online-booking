import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "Missing LiveKit configuration" },
        { status: 500 }
      );
    }

    // Generate a unique room name with "newport-" prefix
    const roomName = `newport_voice_assistant_room_${Math.floor(Math.random() * 10000)}`;
    
    // Generate a unique participant identity
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10000)}`;

    // Create the access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: "Newport Beach Vacation Properties User",
    });

    // Grant permissions for the room
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    // Generate the token
    const token = at.toJwt();

    return NextResponse.json({
      token,
      roomName,
      wsUrl,
    });
  } catch (error) {
    console.error("Error generating connection details:", error);
    return NextResponse.json(
      { error: "Failed to generate connection details" },
      { status: 500 }
    );
  }
}
