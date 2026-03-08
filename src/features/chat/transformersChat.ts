import { Message } from "../messages/messages";

type TextGenerationPipeline = ((
  input: string,
  options?: Record<string, unknown>
) => Promise<unknown>) & {
  tokenizer: {
    apply_chat_template?: (
      conversation: Message[],
      options?: {
        add_generation_prompt?: boolean;
        tokenize?: boolean;
      }
    ) => string;
  };
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

const ROLE_MARKERS = ["<|assistant|>", "<|user|>", "<|system|>"] as const;

const buildPrompt = (messages: Message[]): string => {
  const prompt = engine?.tokenizer.apply_chat_template?.(messages, {
    tokenize: false,
    add_generation_prompt: true,
  });
  if (typeof prompt === "string") {
    return prompt;
  }

  const chat = messages
    .map((message) => `<|${message.role}|>\n${message.content}`)
    .join("\n\n");
  return `${chat}\n\n<|assistant|>\n`;
};

const sanitizeGeneratedText = (text: string): string => {
  /* const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/g, ""); */
  const stopIndex = ROLE_MARKERS.reduce((earliest, marker) => {
    const index = text.indexOf(marker);
    if (index === -1) {
      return earliest;
    }
    return earliest === -1 ? index : Math.min(earliest, index);
  }, -1);

  return stopIndex === -1
    ? text
    : text.slice(0, stopIndex);
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
  let rawText = "";
  let streamedLength = 0;

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
      rawText += text;
      const sanitizedText = sanitizeGeneratedText(rawText);
      const content = sanitizedText.slice(streamedLength);
      streamedLength = sanitizedText.length;
      if (!content) {
        return;
      }
      pushChunk({
        choices: [{ delta: { content } }],
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
