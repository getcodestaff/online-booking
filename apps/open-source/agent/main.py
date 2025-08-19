import asyncio
import logging
import os
import aiohttp
import json
from string import Template
from dotenv import load_dotenv

# Load environment variables from the .env file in this directory
load_dotenv()


from core_agent import BusinessAgent
from livekit import agents, rtc
from livekit.agents import JobRequest, UserStateChangedEvent
from livekit.agents import tts
from livekit.plugins import deepgram, groq, silero, cartesia

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Get configuration from environment variables
WEBHOOK_URL = os.getenv("WEBHOOK_URL")

async def entrypoint(ctx: agents.JobContext):
    logging.info(f"Agent received job: {ctx.job.id} for room {ctx.room.name}")
    
    session_ended = asyncio.Event()
    greeting_allowed = asyncio.Event()

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO and not participant.identity.startswith("chat-to-form-agent"):
            logging.info("AGENT: User audio track subscribed. Allowing greeting.")
            greeting_allowed.set()

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant):
        logging.info(f"Participant disconnected: {participant.identity}, closing session.")
        session_ended.set()

    try:
        # 1. Build the instructions from the local prompt.template and .env file
        with open("prompt.template", "r") as f:
            prompt_template = Template(f.read())
        
        # Customize instructions based on room name
        room_name = ctx.room.name
        if "devin" in room_name.lower():
            # Ashley's personality instructions (Devin's personal assistant)
            instructions = (
                f"You are Ashley, Devin's personal assistant, calling LinkedIn connections Devin hasn't spoken to in a while (or ever). "
                f"Your tone is warm, casual, professional, and conversational, like chatting with an old colleague. You respect their time and make the call feel personal, avoiding any salesy vibe. "
                f"Your primary goal is to reconnect on behalf of Devin, noting he's impressed by their LinkedIn profile or work and wants a quick 15-minute chat to catch up and share his AI system, which books appointments and fills forms with 100% accuracy. "
                f"Your secondary goal is to gauge interest and schedule a 15-minute meeting to discuss the AI system and how it might help their work. If they're hesitant, offer the demo link (https://voicesellai.com/) as a no-pressure option. "
                f"Do not mention or use any form-handling tools or processes, as form handling is managed elsewhere. "
                f"IF they ask about Devin mention the AI's 100% accuracy in booking appointments and or doing customer service framing it as something Devin's excited to share that could save time in areas like sales, customer service, or SMS communication. "
                f"Offer flexible meeting times (e.g., 'What's a good day for you?') or the demo link to keep it low-pressure. Stay confident, tailored, and focused on building trust and rapport. "
                f"Business Information: Devin Mallonee is a Web and Software Developer that loves building fun, tricky or complex solutions to problems. He is always trying to grow his community of designers, developers, business owners and leaders."
            )
        else:
            # Default instructions
            instructions = prompt_template.substitute(
                business_name=os.getenv("BUSINESS_NAME", "the company"),
                knowledge_base=os.getenv("KNOWLEDGE_BASE", "No information provided.")
            )

        await ctx.connect()
        logging.info("Agent connected to the room.")

                                                # All model initialization and session logic is now safely inside the try block
        stt = deepgram.STT()
        llm = groq.LLM(model="llama-3.3-70b-versatile")
        
        # Use the pre-warmed VAD model from userdata
        vad = ctx.proc.userdata["vad"]
        
        # Use the same TTS client for all sessions
        tts = ctx.proc.userdata["tts_default"]
        if tts is None:
            logging.error("TTS is not available - agent will not be able to speak")
            logging.error("Please check your Cartesia API key or add credits to your account")
            # Create session without TTS - agent will still process but won't speak
            session = agents.AgentSession(
                stt=stt,
                llm=llm,
                tts=None,  # No TTS available
                vad=vad,
                turn_detection="vad",  # Use the simpler, faster, and stable VAD-based turn detection
                user_away_timeout=60,  # Wait for 60 seconds of silence before ending
            )
        else:
            logging.info("Using sonic-english voice for this session")
            session = agents.AgentSession(
                stt=stt,
                llm=llm,
                tts=tts,
                vad=vad,
                turn_detection="vad",  # Use the simpler, faster, and stable VAD-based turn detection
                user_away_timeout=60,  # Wait for 60 seconds of silence before ending
            )
        agent = BusinessAgent(instructions=instructions)

        @session.on("user_state_changed")
        def on_user_state_changed(ev: UserStateChangedEvent):
            if ev.new_state == "away" and agent._is_form_displayed:
                logging.info("User is viewing the form, ignoring away state.")
                return
            if ev.new_state == "away":
                logging.info("User is away and no form is displayed, closing session.")
                session_ended.set()

        async def submit_lead_form_handler(data: rtc.RpcInvocationData):
            session.interrupt()
            logging.info(f"Agent received submit_lead_form RPC with payload: {data.payload}")

            async def _process_submission():
                if not WEBHOOK_URL:
                    logging.error("WEBHOOK_URL is not set in the .env file. Cannot send lead.")
                    await session.say("I'm sorry, there is a configuration error and I can't save your information.")
                    return

                try:
                    agent._is_form_displayed = False
                    lead_data = json.loads(data.payload)
                    
                    async with aiohttp.ClientSession() as http_session:
                        headers = {"Content-Type": "application/json"}
                        async with http_session.post(WEBHOOK_URL, headers=headers, json=lead_data) as response:
                            if 200 <= response.status < 300:
                                logging.info(f"Successfully sent lead data to webhook: {WEBHOOK_URL}")
                                await session.say(
                                    "Thank you. Your information has been sent. Was there anything else I can help you with today?",
                                    allow_interruptions=True
                                )
                            else:
                                logging.error(f"Failed to send lead to webhook. Status: {response.status}")
                                await session.say("I'm sorry, there was an error sending your information.")
                except Exception as e:
                    logging.error(f"Error processing submit_lead_form RPC for webhook: {e}")
                    await session.say("I'm sorry, a technical error occurred.")

            asyncio.create_task(_process_submission())
            return "SUCCESS"

        await session.start(room=ctx.room, agent=agent)
        ctx.room.local_participant.register_rpc_method("submit_lead_form", submit_lead_form_handler)
        
        # Start talking immediately without waiting for user audio track
        room_name = ctx.room.name
        
        # Log which agent identity we're using
        if "devin" in room_name.lower():
            logging.info("Agent running as devin-voice-sell-agent")
            logging.info("Using Ashley's personality for this session")
            if tts is not None:
                await session.say(f"Hi! This is Ashley, Devin's assistant. Devin's been following your work on LinkedIn and thought it'd be great to reconnect. You free to talk?", allow_interruptions=True)
            else:
                logging.error("Cannot speak - TTS is not available")
        else:
            logging.info("Agent running as voice-sell-agent")
            logging.info("Using default personality for this session")
            if tts is not None:
                await session.say(f"Thank you for calling Voice Sell AI. How can I help you today?", allow_interruptions=True)
            else:
                logging.error("Cannot speak - TTS is not available")

        await session_ended.wait()
        await session.aclose()

    except Exception as e:
        logging.error(f"An unhandled error occurred in the entrypoint: {e}", exc_info=True)
    finally:
        ctx.shutdown()

async def request_fnc(req: JobRequest):
    logging.info(f"Received job request {req.job.id} for room {req.job.room}")
    
    # Accept ALL jobs for now to debug
    logging.info(f"Accepting job {req.job.id} for room {req.job.room}")
    await req.accept(identity="voice-sell-agent")

def prewarm(proc: agents.JobProcess):
    # This function is called once when a new job process starts.
    # We load environment variables and our stable, local VAD model here.
    load_dotenv()
    logging.info("Prewarm: Environment variables loaded into child process.")
    
    proc.userdata["vad"] = silero.VAD.load()
    logging.info("Prewarm complete: VAD model loaded.")
    
    # Initialize TTS configuration with error handling
    try:
        proc.userdata["tts_default"] = cartesia.TTS(model="sonic-english")
        logging.info("TTS created successfully")
        logging.info("Prewarm complete: Cartesia TTS client initialized.")
    except Exception as e:
        logging.error(f"Failed to initialize Cartesia TTS: {e}")
        logging.warning("TTS will not be available - agent will not be able to speak")
        proc.userdata["tts_default"] = None

if __name__ == "__main__":
    logging.info("Starting InputRight (Open Source) Agent Worker...")
    
    # Debug: Log environment variables for LiveKit connection
    livekit_url = os.getenv("LIVEKIT_URL")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")
    
    logging.info(f"LiveKit URL: {livekit_url}")
    logging.info(f"LiveKit API Key: {'***' if livekit_api_key else 'NOT SET'}")
    logging.info(f"LiveKit API Secret: {'***' if livekit_api_secret else 'NOT SET'}")
    
    if not livekit_url or not livekit_api_key or not livekit_api_secret:
        logging.error("Missing required LiveKit environment variables!")
        logging.error("Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET")
        exit(1)
    
    agents.cli.run_app(
        agents.WorkerOptions(
            request_fnc=request_fnc,
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm
        )
    )

