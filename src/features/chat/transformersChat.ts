import { Message } from "../messages/messages";

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

type QwenProcessor = {
  tokenizer: unknown;
  batch_decode: (
    sequences: unknown,
    options?: { skip_special_tokens?: boolean }
  ) => string[];
  (...args: unknown[]): Promise<Record<string, unknown>>;
};

type QwenModel = {
  generate: (args: Record<string, unknown>) => Promise<{
    sequences?: unknown;
    past_key_values?: Record<string, { dispose?: () => void }>;
  }>;
};

export const TRANSFORMERS_MODEL_OPTIONS = [
  {
    id: "onnx-community/Qwen3.5-0.8B-ONNX-OPT",
    label: "Qwen3.5-0.8B-ONNX-OPT",
  },
  {
    id: "onnx-community/Qwen3.5-2B-ONNX-OPT",
    label: "Qwen3.5-2B-ONNX-OPT",
  },
  {
    id: "onnx-community/Qwen3.5-4B-ONNX-OPT",
    label: "Qwen3.5-4B-ONNX-OPT",
  },
] as const;

export const DEFAULT_TRANSFORMERS_MODEL = TRANSFORMERS_MODEL_OPTIONS[0].id;

let processor: QwenProcessor | null = null;
let model: QwenModel | null = null;
let currentModel: string | null = null;

const ROLE_MARKERS = [
  "<|im_start|>user",
  "<|im_start|>system",
  "<|im_start|>assistant",
  "<|im_end|>",
] as const;

const buildPrompt = (messages: Message[]): string => {
  const turns = messages
    .map((message) => {
      const imageToken =
        message.image && message.role === "user"
          ? "<|vision_start|><|image_pad|><|vision_end|>"
          : "";

      return `<|im_start|>${message.role}\n${imageToken}${message.content}<|im_end|>`;
    })
    .join("\n");

  return `${turns}\n<|im_start|>assistant\n<think>\n\n</think>\n\n`;
};

const sanitizeGeneratedText = (text: string): string => {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const stopIndex = ROLE_MARKERS.reduce((earliest, marker) => {
    const index = withoutThinking.indexOf(marker);
    if (index === -1) {
      return earliest;
    }
    return earliest === -1 ? index : Math.min(earliest, index);
  }, -1);

  return (stopIndex === -1
    ? withoutThinking
    : withoutThinking.slice(0, stopIndex)
  ).replace(/^\s+/, "");
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
  if (processor && model && currentModel === selectedModel) {
    onProgress?.({
      percent: 100,
      status: "ready",
    });
    return model;
  }

  const transformers = (await import("@huggingface/transformers")) as typeof import("@huggingface/transformers") & {
    Qwen3_5ForConditionalGeneration: {
      from_pretrained: (
        modelId: string,
        options: Record<string, unknown>
      ) => Promise<QwenModel>;
    };
  };
  const { AutoProcessor, Qwen3_5ForConditionalGeneration, env } = transformers;

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

  processor = (await AutoProcessor.from_pretrained(selectedModel, {
    progress_callback: reportProgress,
  })) as QwenProcessor;

  model = (await Qwen3_5ForConditionalGeneration.from_pretrained(selectedModel, {
    dtype: {
      embed_tokens: "q4",
      vision_encoder: "fp16",
      decoder_model_merged: "q4",
    },
    device: "webgpu",
    progress_callback: reportProgress,
  })) as QwenModel;

  currentModel = selectedModel;
  onProgress?.({
    percent: 100,
    status: "ready",
  });
  return model;
}

async function buildImages(messages: Message[]) {
  const imageMessages = messages.filter(
    (message) => message.role === "user" && message.image?.dataUrl
  );
  if (imageMessages.length === 0) {
    return undefined;
  }

  const { RawImage } = await import("@huggingface/transformers");
  const images = await Promise.all(
    imageMessages.map(async (message) => {
      const rawImage = await RawImage.read(message.image!.dataUrl);
      return rawImage.resize(448, 448);
    })
  );

  return images.length === 1 ? images[0] : images;
}

async function* streamGeneratedText(
  prompt: string,
  images?: unknown
): AsyncGenerator<ChatChunk> {
  const transformers = await import("@huggingface/transformers");
  const { TextStreamer, InterruptableStoppingCriteria } = transformers;

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

  const stoppingCriteria = new InterruptableStoppingCriteria();
  const streamer = new TextStreamer(processor!.tokenizer as never, {
    skip_prompt: true,
    skip_special_tokens: false,
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

  void processor!(...(images ? [prompt, images] : [prompt]))
    .then((inputs) =>
      model!.generate({
        ...inputs,
        max_new_tokens: 4096,
        do_sample: true,
        temperature: 0.8,
        streamer,
        stopping_criteria: stoppingCriteria,
        return_dict_in_generate: true,
      })
    )
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
  if (model == null || processor == null) {
    await setupEngine(DEFAULT_TRANSFORMERS_MODEL);
  }

  const prompt = buildPrompt(messages);
  const images = await buildImages(messages);
  return streamGeneratedText(prompt, images);
}
