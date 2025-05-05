import { CreateMLCEngine, MLCEngine, MLCEngineConfig, AppConfig } from "@mlc-ai/web-llm";
import { Message } from "../messages/messages";

 // Initialize with a progress callback
 const initProgressCallback = (progress: any) => {
     console.log("Model loading progress:", progress);
 };

// Using CreateMLCEngine
let engine: MLCEngine | null = null;

export async function setupEngine(selectedModel: string) {
  // https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
  //engine = await CreateMLCEngine("Llama-3.2-1B-Instruct-q4f32_1-MLC", { initProgressCallback });
  //engine = await CreateMLCEngine("DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC", { initProgressCallback });
  console.log("Selected model:", selectedModel);
  //engine = await CreateMLCEngine(selectedModel, { initProgressCallback });
  let ac: AppConfig = {
    useIndexedDBCache: false,
    model_list: [
      {
        model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC",
        model_id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
        model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 1128.82,
        low_resource_required: true,
        overrides: {
          context_window_size: 4096,
        },
      },
      {
        model: "http://localhost:3000/dist/TinySwallow-GRPO-TMethod-experimental-q4f32_1-MLC",
        model_id: "TinySwallow-GRPO-TMethod-experimental-q4f32_1-MLC",
        model_lib: "http://localhost:3000/dist/TinySwallow-GRPO-TMethod-experimental-q4f32_1-webgpu.wasm",
        //model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
        vram_required_MB: 1128.82,
        low_resource_required: true,
        overrides: {
          context_window_size: 4096,
        },
      }
    ]
  };
  let ec:MLCEngineConfig  = {
    appConfig: ac,
    initProgressCallback: initProgressCallback
  };
  engine = await CreateMLCEngine("Llama-3.2-1B-Instruct-q4f32_1-MLC",ec);
  return engine;
}

export async function getChatResponseStream(
  messages: Message[],
  apiKey: string
) {
  let chunks = null;
  if (engine == null) {
    await setupEngine("Llama-3.2-1B-Instruct-q4f32_1-MLC");
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
