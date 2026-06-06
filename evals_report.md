# Evaluation Report: AI Engineer Intern Assessment

## 1. Evaluation Metrics

To ensure the Voice Agent and Chat Interface perform reliably and provide accurate information, the following evaluation metrics are tracked:

### System Performance
- **Latency (Time to First Token):** Measures the delay between the user's query and the AI's first spoken or typed word. Our target is < 500ms for web chat and < 800ms for voice calls to ensure natural conversational flow.
- **RAG Retrieval Accuracy:** The percentage of queries where the retrieved context accurately contains the information needed to answer the question (measured via manual sampling of 50 test queries).
- **Task Success Rate:** The percentage of users who successfully complete the "Schedule an Interview" flow without dropping off or encountering API errors.

### Conversation Quality
- **Hallucination Rate:** The frequency of the AI inventing facts about Anupama's background not present in the provided resume or GitHub context.
- **Context Retention:** The AI's ability to remember details mentioned earlier in the same conversation session.

---

## 2. Failure Modes

During testing, several failure modes were identified that require graceful handling:

1. **Voice Activity Detection (VAD) Interruptions:** On phone calls, background noise or slight pauses by the user can cause the AI to prematurely interrupt or assume the user has finished speaking.
2. **Empty Retrieval Context:** If a user asks a highly specific technical question that isn't covered in the RAG corpus (e.g., "What was your GPA in 3rd grade?"), the AI might fallback to general knowledge instead of admitting it doesn't know.
3. **API Rate Limiting:** Heavy usage of the free-tier Gemini API can lead to `429 Too Many Requests` errors, causing the chat interface to hang or the voice call to drop unexpectedly.
4. **Third-Party API Outages:** If the Cal.com scheduling API is down or changes versions (as seen with their recent v2 migration), the booking widget fails to load calendar slots.

---

## 3. Architecture Tradeoffs

When designing this system, several key tradeoffs were made to balance performance, cost, and development speed:

- **Gemini 2.5 Flash vs. GPT-4o / Claude 3.5:** Gemini Flash was chosen as the core LLM because it provides an exceptional balance of extremely low latency (crucial for real-time voice agents) and generous free-tier rate limits, whereas GPT-4o would incur higher costs and Claude 3.5 lacked the same speed for voice.
- **Client-Side vs. Server-Side Vapi Integration:** The Vapi Web SDK was integrated directly on the client-side (`ChatInterface.tsx`). This reduces server load and latency by establishing a direct WebRTC peer-to-peer connection between the user's browser and Vapi's servers, trading off some security (exposing the Public Key) for significantly better audio performance.
- **In-Memory vs. Vector Database RAG:** For this MVP, context is provided via a dense system prompt and lightweight retrieval rather than a heavy, dedicated Vector DB (like Pinecone). This trades off the ability to scale to millions of documents for extreme simplicity and zero latency.

---

## 4. Future Improvements

To take this project from an MVP to a robust production system, the following improvements are planned:

1. **Semantic Chunking & Vector DB Integration:** Migrate the RAG system to use a proper vector database (e.g., Supabase pgvector or Pinecone) with semantically chunked text embeddings to allow querying across thousands of GitHub repositories simultaneously.
2. **Multi-Turn Calendar Negotiations:** Currently, the AI provides a link/widget to book a time. In the future, the Voice Agent will be upgraded to use function calling to negotiate the time *verbally* (e.g., "Are you free next Tuesday at 3 PM?") and book it automatically in the background.
3. **Automated Evals Framework:** Implement an automated LLM-as-a-Judge evaluation pipeline (using LangSmith or Braintrust) to programmatically test the AI against a golden dataset of 100 common recruiter questions before every deployment.
4. **Custom Voice Cloning:** Upgrade the ElevenLabs TTS integration to use a custom-cloned voice of Anupama to create a truly personalized AI representative experience.
