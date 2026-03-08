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

type EngineLoadProgressInfo =
  | {
      status: "initiate" | "download" | "done";
      name: string;
      file: string;
    }
  | {
      status: "progress";
      name: string;
      file: string;
      progress: number;
      loaded: number;
      total: number;
    }
  | {
      status: "progress_total";
      name: string;
      progress: number;
      loaded: number;
      total: number;
      files: Record<string, { loaded: number; total: number }>;
    }
  | {
      status: "ready";
      task: string;
      model: string;
    };

type EngineLoadState = {
  percent: number;
  file?: string;
  status: EngineLoadProgressInfo["status"];
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
  return setupEngineWithProgress(selectedModel);
}

export async function setupEngineWithProgress(
  selectedModel: string,
  onProgress?: (state: EngineLoadState) => void
) {
  if (typeof window === "undefined") {
    throw new Error("Transformers.js can only run in the browser.");
  }
  if (!("gpu" in navigator)) {
    throw new Error("WebGPU is not available in this browser.");
  }
  if (engine && currentModel === selectedModel) {
    onProgress?.({
      percent: 100,
      status: "ready",
    });
    return engine;
  }

  const transformers = await import("@huggingface/transformers");
  const { env, pipeline } = transformers;
  env.allowLocalModels = false;
  const fileProgress = new Map<string, number>();

  const reportProgress = (info: EngineLoadProgressInfo) => {
    if (info.status === "ready") {
      onProgress?.({
        percent: 100,
        status: "ready",
      });
      return;
    }

    if (info.status === "progress_total") {
      onProgress?.({
        percent: Math.round(info.progress),
        status: info.status,
      });
      return;
    }

    if (info.status === "done") {
      fileProgress.set(info.file, 100);
    } else if (info.status === "progress") {
      fileProgress.set(info.file, info.progress);
    } else if (!fileProgress.has(info.file)) {
      fileProgress.set(info.file, 0);
    }

    const progressValues = Array.from(fileProgress.values());
    const percent =
      progressValues.length > 0
        ? Math.round(
            progressValues.reduce((sum, value) => sum + value, 0) /
              progressValues.length
          )
        : 0;

    onProgress?.({
      percent,
      file: info.file,
      status: info.status,
    });
  };

  engine = (await pipeline("text-generation", selectedModel, {
    device: "webgpu",
    dtype: "q4f16",
    progress_callback: reportProgress,
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
