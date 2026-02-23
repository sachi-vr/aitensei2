import { Message } from "../messages/messages";
import { wait } from "@/utils/wait";

type TextGenerationPipeline = (
  input: string,
  options?: Record<string, unknown>
) => Promise<unknown>;

type ChatChunk = {
  choices: Array<{ delta: { content: string } }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export const TRANSFORMERS_MODEL_OPTIONS = [
  {
    id: "onnx-community/Qwen3-4B-ONNX",
    label: "Qwen3-4B-ONNX",
  },
  {
    id: "onnx-community/Llama-3.2-3B-Instruct",
    label: "Llama-3.2-3B-Instruct",
  },
  {
    id: "onnx-community/Apertus-8B-Instruct-2509",
    label: "Apertus-8B-Instruct-2509",
  },
  {
    id: "onnx-community/gpt-oss-20b-ONNX",
    label: "gpt-oss-20b-ONNX",
  },
] as const;

export const DEFAULT_TRANSFORMERS_MODEL = TRANSFORMERS_MODEL_OPTIONS[0].id;

let engine: TextGenerationPipeline | null = null;
let currentModel: string | null = null;

const buildPrompt = (messages: Message[]): string => {
  const chat = messages
    .map((message) => `<|${message.role}|>\n${message.content}`)
    .join("\n\n");
  return `${chat}\n\n<|assistant|>\n`;
};

const chunkText = (text: string, size = 8): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

const extractGeneratedText = (result: unknown, prompt: string): string => {
  let generatedText = "";

  if (typeof result === "string") {
    generatedText = result;
  } else if (Array.isArray(result) && result.length > 0) {
    const first = result[0] as Record<string, unknown>;
    const text = first.generated_text;
    if (typeof text === "string") {
      generatedText = text;
    }
  } else if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;
    const text = obj.generated_text;
    if (typeof text === "string") {
      generatedText = text;
    }
  }

  if (generatedText.startsWith(prompt)) {
    return generatedText.slice(prompt.length);
  }
  return generatedText;
};

async function* toChunkStream(text: string): AsyncGenerator<ChatChunk> {
  const textChunks = chunkText(text, 8);
  for (const piece of textChunks) {
    yield {
      choices: [{ delta: { content: piece } }],
    };
    await wait(0);
  }
  yield {
    choices: [{ delta: { content: "" } }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

export async function setupEngine(selectedModel: string) {
  if (typeof window === "undefined") {
    throw new Error("Transformers.js can only run in the browser.");
  }
  if (!("gpu" in navigator)) {
    throw new Error("WebGPU is not available in this browser.");
  }
  if (engine && currentModel === selectedModel) {
    return engine;
  }

  const transformers = await import("@huggingface/transformers");
  const { env, pipeline } = transformers;
  env.allowLocalModels = false;

  engine = (await pipeline("text-generation", selectedModel, {
    device: "webgpu",
    dtype: "q4f16",
  })) as TextGenerationPipeline;
  currentModel = selectedModel;
  return engine;
}

export async function getChatResponseStream(messages: Message[]) {
  if (engine == null) {
    await setupEngine(DEFAULT_TRANSFORMERS_MODEL);
  }

  const prompt = buildPrompt(messages);
  const result = await engine!(prompt, {
    max_new_tokens: 256,
    temperature: 0.8,
    do_sample: true,
    return_full_text: false,
  });
  const generatedText = extractGeneratedText(result, prompt);
  return toChunkStream(generatedText);
}
