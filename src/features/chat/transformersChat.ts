import { Message } from "../messages/messages";

type TextGenerationPipeline = ((
  input: string,
  options?: Record<string, unknown>
) => Promise<unknown>) & {
  tokenizer: unknown;
};

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

async function* streamGeneratedText(prompt: string): AsyncGenerator<ChatChunk> {
  const transformers = await import("@huggingface/transformers");
  const { TextStreamer } = transformers;

  const queue: ChatChunk[] = [];
  let pendingResolve: (() => void) | null = null;
  let isDone = false;
  let streamError: unknown = null;

  const pushChunk = (chunk: ChatChunk) => {
    queue.push(chunk);
    pendingResolve?.();
    pendingResolve = null;
  };

  const finish = () => {
    isDone = true;
    pendingResolve?.();
    pendingResolve = null;
  };

  const streamer = new TextStreamer(engine!.tokenizer as never, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text: string) => {
      if (!text) {
        return;
      }
      pushChunk({
        choices: [{ delta: { content: text } }],
      });
    },
  });

  void engine!(prompt, {
    max_new_tokens: 4096,
    temperature: 0.8,
    do_sample: true,
    return_full_text: false,
    streamer,
  })
    .then(() => {
      pushChunk({
        choices: [{ delta: { content: "" } }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
      finish();
    })
    .catch((error) => {
      streamError = error;
      finish();
    });

  while (!isDone || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        pendingResolve = resolve;
      });
      continue;
    }
    yield queue.shift()!;
  }

  if (streamError) {
    throw streamError;
  }
}

export async function getChatResponseStream(messages: Message[]) {
  if (engine == null) {
    await setupEngine(DEFAULT_TRANSFORMERS_MODEL);
  }

  const prompt = buildPrompt(messages);
  return streamGeneratedText(prompt);
}
