import { useState } from "react";
import {
  DEFAULT_TRANSFORMERS_MODEL,
  setupEngineWithProgress,
  TRANSFORMERS_MODEL_OPTIONS,
} from "../features/chat/transformersChat";
import { Link } from "./link";

type Props = {
  onChangeVoiceLang: (koeiromapKey: string) => void;
};
export const Introduction = ({
  onChangeVoiceLang,
}: Props) => {
  const [opened, setOpened] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>(
    DEFAULT_TRANSFORMERS_MODEL
  );
  const [isLoading, setIsLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressFile, setProgressFile] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(event.target.value);
  };

  const handleClick = async () => {
    setIsLoading(true);
    setProgressPercent(0);
    setProgressFile("");
    setErrorMessage("");

    try {
      const engine = await setupEngineWithProgress(selectedModel, (state) => {
        setProgressPercent(state.percent);
        setProgressFile(state.file ?? "");
      });
      console.log("Engine initialized:", engine);
      setOpened(false);
    } catch (error) {
      console.error("Failed to initialize engine:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "モデルの初期化に失敗しました。"
      );
    } finally {
      setIsLoading(false);
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
                "https://huggingface.co/docs/transformers.js/main/en/index"
              }
              label={"Transformers.js v4"}
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
          <select
            id="model-select"
            value={selectedModel}
            onChange={handleModelChange}
            disabled={isLoading}
          >
            {TRANSFORMERS_MODEL_OPTIONS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          <hr />
          <label htmlFor="voiceLang-select">Select Voice:</label>
          <select
            id="voiceLang-select"
            onChange={(e) => onChangeVoiceLang(e.target.value)}
            disabled={isLoading}
          >
            <option value="ja-JP">日本語(Japanese)</option>
            <option value="en-US">English</option>
          </select>
        </div>
        <div className="my-24">
          <button
            onClick={handleClick}
            disabled={isLoading}
            className="font-bold bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled text-white px-24 py-8 rounded-oval"
          >
            {isLoading ? `loading ${progressPercent}%` : "Load"}
          </button>
          {isLoading ? (
            <div className="mt-12 max-w-md">
              <div className="h-8 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-secondary transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-8 text-sm text-slate-700">
                {progressFile || "モデルを読み込み中..."}
              </div>
            </div>
          ) : null}
          {errorMessage ? (
            <div className="mt-8 text-sm text-red-600">{errorMessage}</div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;
};
