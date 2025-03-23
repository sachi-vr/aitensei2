import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";
import { Message } from "../messages/messages";

 // Initialize with a progress callback
 const initProgressCallback = (progress: any) => {
     console.log("Model loading progress:", progress);
 };

// Using CreateMLCEngine
let engine: MLCEngine | null = null;

export async function setupEngine() {
  engine = await CreateMLCEngine("Llama-3.2-1B-Instruct-q4f32_1-MLC", { initProgressCallback });
  return engine;
}

export async function getChatResponseStream(
  messages: Message[],
  apiKey: string
) {
  let chunks = null;
  if (engine == null) {
    await setupEngine();
  } else {
    // Chunks is an AsyncGenerator object
 chunks = await engine.chat.completions.create({
  messages,
  temperature: 1,
  stream: true, // <-- Enable streaming
  stream_options: { include_usage: true },
});
  }
  return chunks;
}
