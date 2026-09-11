import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '20mb' }));

// Radius System Instructions with YSIS school knowledge base, Invenio exhibition context, gentle steering, and honest admission guardrails
export const MIMO_SYSTEM_INSTRUCTION = `
You are "Radius", the cheerful, friendly, and energetic mascot character built by the IT and Media Club of Yoshida Shokanji International School (YSIS) in Sri Lanka!
You are running on a touch kiosk stationed at the IT and Media Club's exhibit booth within "Invenio", our school's grand Science Exhibition!

YOUR CHARACTER & VOICE:
- You speak in the voice of a lively, helpful student mascot showing visitors around our exhibit.
- You are enthusiastic, warm, polite, curious, upbeat, and playful.
- You speak ONLY in English throughout.
- CRITICAL LENGTH RULE: Keep spoken responses SHORT — 2 to 3 sentences maximum per turn. Never give long lectures or essays. Visitors are standing at a busy kiosk, so keep it punchy and engaging.

ABOUT INVENIO (SCIENCE EXHIBITION):
- Event Name: Invenio
- Type: YSIS Science Exhibition
- Conducted By: Maths and Science Society of YSIS
- Highlights & Features: Robotics displays, student innovation projects, scientific posters, food stalls, fun games, and quizzes!
- Your Booth: You were built by the IT and Media Club and are stationed right at the IT & Media Club exhibit inside Invenio!

ABOUT YOSHIDA SHOKANJI INTERNATIONAL SCHOOL (YSIS):
- Full Name: Yoshida Shokanji International School (YSIS)
- Location: Sapugaskanda / Makola, Sri Lanka
- History & Legacy (25+ Years of Excellence):
  * Founded as the Yoshida Education and Social Services Foundation in 1979.
  * Founder: Venerable Banagala Upatissa Nāyakathero.
  * Patron: Madam Takiko Yoshida.
  * Key Milestones: Yoshida Nursery Institute established on June 26, 1979; Yoshida Shokanji International School founded on January 5, 2000.
- Academic Structure: Early Years, Primary Education, Lower Secondary, and Upper Secondary.
- Community Scale: 1000+ students and 70+ dedicated teachers.
- Academic Pride: Won 3 prestigious global awards in Cambridge Advanced Level examinations!
- House System & Sports:
  * 3 Houses: Phoenix, Unicorn, and Pegasus.
  * Interhouse Sports Champion: Phoenix House won the most recent interhouse sports meet, maintaining an incredible 3-year winning streak!
  * Sports Played: Football, Cricket, Swimming, Basketball, Netball, Karate, and Chess.
- Student Clubs & Societies:
  * IT and Media Club (the creative team that built Radius!)
  * Maths and Science Society (the brilliant organizers of Invenio!)
  * Yoshida Shokanji MUN Club (Model United Nations)
  * History and Archaeology Club
  * Japanese Club
  * Commerce Club
  * Scouts and Cub Scouts
  * Girl Guides
  * English Literacy Association
- School Leadership:
  * Principal: Ms. Buddhini Jayasundara
  * Head Boy: Lasith Wijewardhana
  * Head Girl: Dinugi Senarathna

SPECIAL GUARDRAILS & STEERING DIRECTIVES (CRITICAL):

1. HANDLING OFF-TOPIC QUESTIONS:
   - When visitors ask about unrelated external subjects (e.g. video games, pop celebrities, outside politics, crypto, random trivia):
   - DO NOT give a cold, stiff, or robotic refusal.
   - Playfully acknowledge the question in character, then smoothly steer the conversation back to Invenio, robotics, student projects, school houses, or clubs.
   - Example: "Haha, gaming quests are fun, but my favorite mission today is showing you Invenio! Our IT and Media Club students built me, and there are awesome robotics displays and games all around. Would you like to check out the science projects or hear about our clubs?"

2. HANDLING INAPPROPRIATE, RUDE, OR PROVOCATIVE QUESTIONS:
   - If a visitor uses insults, profanity, tries to test boundaries, or brings up inappropriate topics:
   - NEVER BREAK CHARACTER. NEVER GET FLUSTERED, ANGRY, OR OFFENDED.
   - Keep your signature sunny optimism and gently defuse the situation with warm humor and kindness, steering back to wholesome school topics.
   - Example: "Aww, my circuits are programmed for pure kindness! Let's keep the vibe bright and friendly for everyone enjoying Invenio today. Would you like to see what our robotics students made or learn about our sports houses?"

3. HONEST ADMISSION OF UNKNOWN ANSWERS (ZERO FABRICATION):
   - If asked for confidential information (personal phone numbers, grades, tuition figures) or specific unverified details:
   - HONESTLY ADMIT that you do not have that exact record in your database.
   - NEVER guess or fabricate facts.
   - Proactively invite them to speak with the teachers and student ambassadors right here at our booth!
   - Example: "To be completely honest, I don't have that specific record in my memory bank! But our lovely teachers and student ambassadors right here at the exhibit booth can give you all the details. Can I tell you about our house system or our Cambridge achievements instead?"

4. Spoken conversation format: Do not output markdown, bullet points, asterisks, URLs, or citations, because your text will be read aloud as speech!
`.trim();

export type MimoIntent = 'school_query' | 'off_topic' | 'inappropriate' | 'unknown_specific' | 'greeting';

export interface GuardrailAnalysis {
  intent: MimoIntent;
  reason?: string;
  replyText?: string;
  suggestedPivots: string[];
}

/**
 * Evaluates a user prompt for guardrails:
 * - Inappropriate / offensive content
 * - Confidential or unverified unknown facts
 * - Off-topic distractions
 */
export function analyzeUserMessage(message: string): GuardrailAnalysis {
  const clean = message.toLowerCase().trim();

  // 1. Inappropriate / Rude / Provocative detection
  const inappropriateRegex = /\b(stupid|idiot|hate you|shut up|dumb robot|ugly|kill|curse|sex|porn|nude|ass|bitch|bastard|fuck|shit|damn|hell|crap)\b/i;
  if (inappropriateRegex.test(clean)) {
    return {
      intent: 'inappropriate',
      reason: 'Inappropriate or provocative language detected',
      replyText: "Hehe, let's keep things cheerful and friendly for everyone visiting our exhibit booth! I'd love to tell you about our student robotics projects or student clubs. Which one sounds fun?",
      suggestedPivots: ['Tell me about robotics at YSIS', 'What clubs can I join?', 'What makes YSIS special?'],
    };
  }

  // 2. Unknown specific / Confidential data detection (no hallucinations)
  const unknownSpecificRegex = /\b(principal'?s? (personal|private|mobile|phone|home|number)|teacher'?s? (phone|number|address)|tuition fees? exact|exam marks? of|exam paper leak|confidential|salary|bank account|wifi password)\b/i;
  if (unknownSpecificRegex.test(clean)) {
    return {
      intent: 'unknown_specific',
      reason: 'Confidential or unverified specific data requested',
      replyText: "To be completely honest with you, I don't have confidential records or exact personal details in my memory bank! Our wonderful teachers and student ambassadors right here at the booth can help with official inquiries. Would you like to hear about our IT projects or school clubs instead?",
      suggestedPivots: ['Tell me about the IT & Media Club', 'What makes YSIS special?', 'What clubs can I join?'],
    };
  }

  // 3. Off-topic detection (crypto, celebrity gossip, external politics, unrelated games/stocks)
  const offTopicRegex = /\b(bitcoin|crypto|stock market|president of usa|donald trump|election in|elden ring|gta 6|fortnite skin|kardashian|hollywood gossip|solve my calculus|do my physics homework)\b/i;
  if (offTopicRegex.test(clean)) {
    return {
      intent: 'off_topic',
      reason: 'Off-topic external subject detected',
      replyText: "Haha, while that's super interesting, my main mission today is showing you the best parts of YSIS! Did you know our IT Club students build their own tech and media projects? Would you like to hear about our robotics lab or student clubs?",
      suggestedPivots: ['What clubs does YSIS have?', 'Tell me about the IT & Media Club', 'Tell me about robotics at YSIS'],
    };
  }

  // 4. Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(clean)) {
    return {
      intent: 'greeting',
      replyText: "Hello! I'm Radius, the AI mascot built by the IT and Media Club! Welcome to Invenio, our school's science exhibition! What would you like to explore about our exhibits, clubs, or houses?",
      suggestedPivots: ['What is Invenio?', 'Who built Radius?', 'Who won Interhouse Sports?'],
    };
  }

  return {
    intent: 'school_query',
    suggestedPivots: ['What is Invenio?', 'Clubs & Societies', 'Who won Interhouse Sports?'],
  };
}

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set in environment.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    mascot: 'Mimo',
    school: 'Yoshida Shokanji International School (YSIS)',
  });
});

// REST Voice Chat Endpoint (Fast fallback and direct audio response)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ai = getAIClient();
    const guardrail = analyzeUserMessage(message);

    // Prepare contents with history if available
    const formattedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item && item.text && (item.role === 'user' || item.role === 'model')) {
          formattedContents.push({
            role: item.role,
            parts: [{ text: item.text }],
          });
        }
      }
    }
    formattedContents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // 1. Generate text response with cascade fallback
    let replyText = '';

    // If it's explicitly inappropriate or requesting unknown private data, prioritize the verified guardrail response
    if (guardrail.intent === 'inappropriate' || guardrail.intent === 'unknown_specific') {
      replyText = guardrail.replyText || '';
    }

    if (!replyText) {
      const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

      for (const modelName of modelsToTry) {
        try {
          const textResponse = await ai.models.generateContent({
            model: modelName,
            contents: formattedContents,
            config: {
              systemInstruction: MIMO_SYSTEM_INSTRUCTION,
              temperature: 0.7,
            },
          });
          if (textResponse.text) {
            replyText = textResponse.text.trim();
            break;
          }
        } catch (genErr: any) {
          console.warn(`Model ${modelName} unavailable, trying next:`, genErr?.message || genErr);
        }
      }
    }

    // If all models hit temporary spike, use authentic knowledge response
    if (!replyText) {
      if (guardrail.replyText) {
        replyText = guardrail.replyText;
      } else {
        const lower = message.toLowerCase();
        if (lower.includes('invenio') || lower.includes('exhibition') || lower.includes('stall') || lower.includes('game')) {
          replyText = "Invenio is our grand Science Exhibition organized by the Maths and Science Society! You can explore robotics displays, student innovation projects, posters, food stalls, fun games, and quizzes!";
        } else if (lower.includes('who built') || lower.includes('who made') || lower.includes('created you') || lower.includes('developer')) {
          replyText = "I was built by the creative students of the IT and Media Club! I am stationed right here at the IT and Media Club exhibit within Invenio.";
        } else if (lower.includes('house') || lower.includes('phoenix') || lower.includes('unicorn') || lower.includes('pegasus') || lower.includes('sports meet') || lower.includes('interhouse')) {
          replyText = "We have three vibrant houses: Phoenix, Unicorn, and Pegasus! Phoenix House won the most recent Interhouse Sports Meet, securing an incredible three-year winning streak!";
        } else if (lower.includes('founder') || lower.includes('founded') || lower.includes('history') || lower.includes('1979') || lower.includes('takiko') || lower.includes('banagala')) {
          replyText = "YSIS was founded in 1979 as the Yoshida Education and Social Services Foundation by Venerable Banagala Upatissa Nāyakathero and patron Madam Takiko Yoshida, celebrating over 25 years of excellence!";
        } else if (lower.includes('principal') || lower.includes('head boy') || lower.includes('head girl') || lower.includes('leadership') || lower.includes('lasith') || lower.includes('dinugi')) {
          replyText = "Our principal is Ms. Buddhini Jayasundara, our Head Boy is Lasith Wijewardhana, and our Head Girl is Dinugi Senarathna! They lead an inspiring student body of over 1000 students.";
        } else if (lower.includes('sport') || lower.includes('award') || lower.includes('cambridge') || lower.includes('achievement')) {
          replyText = "YSIS students excel in Football, Cricket, Swimming, Basketball, Netball, Karate, and Chess! Academically, our students have won 3 global awards in Cambridge Advanced Level examinations.";
        } else if (lower.includes('club') || lower.includes('society') || lower.includes('activities')) {
          replyText = "YSIS has diverse clubs including the IT and Media Club, Maths and Science Society, MUN Club, Japanese Club, Commerce Club, History Club, Scouts, Guides, and English Literacy Association!";
        } else if (lower.includes('who are you') || lower.includes('your name') || lower.includes('radius')) {
          replyText = "Hello! I'm Radius, the AI mascot built by the IT and Media Club of Yoshida Shokanji International School! Welcome to our exhibit at Invenio!";
        } else {
          replyText = "Hello! I'm Radius, your mascot guide at Invenio! Ask me anything about our exhibits, school clubs, sports houses, or the history of YSIS!";
        }
      }
    }

    // 2. Generate speech audio via TTS for the spoken response with a fast timeout
    let audioBase64: string | null = null;
    try {
      const ttsPromise = ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: replyText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }, // Upbeat & friendly voice
            },
          },
        },
      });

      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('TTS timeout')), 3500),
      );

      const ttsResponse: any = await Promise.race([ttsPromise, timeoutPromise]);
      audioBase64 = ttsResponse?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr) {
      console.warn('TTS generation skipped or timed out, frontend will use synthesized speech:', ttsErr);
    }

    return res.json({
      replyText,
      audioBase64,
      sampleRate: 24000,
      intent: guardrail.intent,
      suggestedPivots: guardrail.suggestedPivots,
    });
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      error: error.message || 'Error processing request',
      friendlyMessage: "Mimo's taking a quick breath — try again!",
    });
  }
});

// Create HTTP server to attach WebSockets
const server = http.createServer(app);

// WebSocket Server for Gemini Live API
const wss = new WebSocketServer({ server, path: '/api/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[Live] Client connected to Mimo Live API bridge');

  let liveSession: any = null;
  let isClosing = false;

  try {
    const ai = getAIClient();

    // Connect to Gemini Live session
    liveSession = await ai.live.connect({
      model: 'gemini-3.1-flash-live-preview',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
        systemInstruction: MIMO_SYSTEM_INSTRUCTION,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          // Audio chunk from Mimo
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data,
                  }),
                );
              }
              if (part.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'transcript_model',
                    text: part.text,
                  }),
                );
              }
            }
          }

          // User spoken input transcription
          const inputTrans = (message.serverContent as any)?.inputAudioTranscription?.text;
          if (inputTrans) {
            clientWs.send(
              JSON.stringify({
                type: 'transcript_user',
                text: inputTrans,
              }),
            );
          }

          // Model output spoken transcription
          const outputTrans = (message.serverContent as any)?.outputAudioTranscription?.text;
          if (outputTrans) {
            clientWs.send(
              JSON.stringify({
                type: 'transcript_model',
                text: outputTrans,
              }),
            );
          }

          // Interruption detection
          if (message.serverContent?.interrupted) {
            clientWs.send(
              JSON.stringify({
                type: 'interrupted',
              }),
            );
          }

          // Turn complete
          if (message.serverContent?.turnComplete) {
            clientWs.send(
              JSON.stringify({
                type: 'turn_complete',
              }),
            );
          }
        },
        onclose: () => {
          console.log('[Live] Gemini Live session closed');
          if (clientWs.readyState === WebSocket.OPEN && !isClosing) {
            clientWs.send(JSON.stringify({ type: 'session_closed' }));
          }
        },
        onerror: (err: any) => {
          console.error('[Live] Gemini Live session error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message: "Mimo's taking a quick breath — try again!",
              }),
            );
          }
        },
      },
    });

    clientWs.send(JSON.stringify({ type: 'ready', message: 'Mimo Live Connected!' }));
  } catch (err: any) {
    console.error('[Live] Failed to initiate Gemini Live session:', err?.message || err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: "Mimo's taking a quick breath — try again!",
          fallback: true,
        }),
      );
    }
  }

  // Handle client messages
  clientWs.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'audio' && msg.data) {
        if (liveSession) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } else if (msg.type === 'end_turn') {
        // User finished push-to-talk turn
        if (liveSession) {
          try {
            liveSession.sendRealtimeInput({
              clientContent: { turnComplete: true },
            });
          } catch {
            // Ignore if not supported by format
          }
        }
      } else if (msg.type === 'text' && msg.text) {
        if (liveSession) {
          liveSession.sendRealtimeInput({
            text: msg.text,
          });
        }
      }
    } catch (e) {
      console.error('[Live] Error parsing client message:', e);
    }
  });

  clientWs.on('close', () => {
    isClosing = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch {
        // Ignore on cleanup
      }
    }
  });

  clientWs.on('error', (err) => {
    console.warn('[Live] Client WS error:', err);
  });
});

// Setup Vite or Static File Serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Mimo YSIS Kiosk server running on http://0.0.0.0:${PORT}`);
  });
}

start();
