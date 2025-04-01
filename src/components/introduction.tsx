import { useState, useCallback } from "react";
import { setupEngine } from "../features/chat/webLLMChat";
import { Link } from "./link";

type Props = {
  openAiKey: string;
  koeiroMapKey: string;
  onChangeAiKey: (openAiKey: string) => void;
  onChangeKoeiromapKey: (koeiromapKey: string) => void;
  onChangeVoiceLang: (koeiromapKey: string) => void;
};
export const Introduction = ({
  openAiKey,
  koeiroMapKey,
  onChangeAiKey,
  onChangeKoeiromapKey,
  onChangeVoiceLang,
}: Props) => {
  const [opened, setOpened] = useState(true);
  const [loadingText, setLoadingText] = useState("Load");
  const [selectedModel, setSelectedModel] = useState("gemma-2-2b-jpn-it-q4f32_1-MLC");

  const handleAiKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeAiKey(event.target.value);
    },
    [onChangeAiKey]
  );

  const handleKoeiromapKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeKoeiromapKey(event.target.value);
    },
    [onChangeKoeiromapKey]
  );

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(event.target.value);
  };

  const handleClick = async () => {
    let dots = 0;
    const interval = setInterval(() => {
      dots = (dots + 1) % 4; // Cycle through 0, 1, 2, 3
      setLoadingText(`loading${".".repeat(dots)}`);
    }, 500); // Update every 500ms

    try {
      const engine = await setupEngine(selectedModel);
      console.log("Engine initialized:", engine);
      setOpened(false);
    } catch (error) {
      console.error("Failed to initialize engine:", error);
    } finally {
      clearInterval(interval);
    }
  };

  return opened ? (
    <div className="absolute z-40 w-full h-full px-24 py-40  bg-black/30 font-M_PLUS_2">
      <div className="mx-auto my-auto max-w-3xl max-h-full p-24 overflow-auto bg-white rounded-16">
        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary ">
            このアプリケーションについて
          </div>
          <div>
            Webブラウザだけで3Dキャラクターとの会話を、マイクやテキスト入力、音声合成を用いて楽しめます。
          </div>
        </div>
        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">
            技術紹介
          </div>
          <div>
            3Dモデルの表示や操作には
            <Link
              url={"https://github.com/pixiv/three-vrm"}
              label={"@pixiv/three-vrm"}
            />
            、 会話文生成には
            <Link
              url={
                "https://webllm.mlc.ai/"
              }
              label={"WebLLM"}
            />
            を使用しています。 
          </div>
          <div className="my-16">
            このデモはGitHubでソースコードを公開しています。自由に変更や改変をお試しください！
            <br />
            リポジトリ：
            <Link
              url={"https://github.com/sachi-vr/aitensei2"}
              label={"https://github.com/sachi-vr/aitensei2"}
            />
          </div>
        </div>
        <div>
      <label htmlFor="model-select">Select Model:</label>
      <select id="model-select" value={selectedModel} onChange={handleModelChange}>
      <option value="gemma-2-2b-jpn-it-q4f32_1-MLC">
          gemma-2-2b-jpn-it-q4f32_1-MLC
        </option>
        <option value="Llama-3.2-1B-Instruct-q4f32_1-MLC">
          Llama-3.2-1B-Instruct-q4f32_1-MLC
        </option>
        <option value="DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC">
          DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC
        </option>
      </select>
      <hr />
      <label htmlFor="voiceLang-select">Select Voice:</label>
      <select id="voiceLang-select" onChange={(e) => onChangeVoiceLang(e.target.value)}>
      <option value="ja-JP">日本語(Japanese)</option>
        <option value="en-US">English</option>
      </select>
    </div>
        <div className="my-24">
          <button
            onClick={handleClick}
            className="font-bold bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled text-white px-24 py-8 rounded-oval"
          >
            {loadingText}
          </button>
        </div>
      </div>
    </div>
  ) : null;
};
