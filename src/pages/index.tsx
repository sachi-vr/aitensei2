import { useCallback, useContext, useEffect, useState } from "react";
import VrmViewer from "@/components/vrmViewer";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import {
  Message,
  textsToScreenplay,
  Screenplay,
} from "@/features/messages/messages";
import { speakCharacter } from "@/features/messages/speakCharacter";
import { MessageInputContainer } from "@/components/messageInputContainer";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { getChatResponseStream } from "@/features/chat/webLLMChat";
import { Introduction } from "@/components/introduction";
import { Menu } from "@/components/menu";
import { GitHubLink } from "@/components/githubLink";
import { Meta } from "@/components/meta";

export default function Home() {
  const { viewer } = useContext(ViewerContext);

  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
  const [openAiKey, setOpenAiKey] = useState("testkey");
  const [koeiromapKey, setKoeiromapKey] = useState("");
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [voiceLang, setVoiceLang] = useState("ja-JP");


  useEffect(() => {
    if (window.localStorage.getItem("chatVRMParams")) {
      const params = JSON.parse(
        window.localStorage.getItem("chatVRMParams") as string
      );
      setSystemPrompt(params.systemPrompt ?? SYSTEM_PROMPT);
      setKoeiroParam(params.koeiroParam ?? DEFAULT_PARAM);
      setChatLog(params.chatLog ?? []);
    }
  }, []);

  useEffect(() => {
    process.nextTick(() =>
      window.localStorage.setItem(
        "chatVRMParams",
        JSON.stringify({ systemPrompt, koeiroParam, chatLog })
      )
    );
  }, [systemPrompt, koeiroParam, chatLog]);

  const handleChangeChatLog = useCallback(
    (targetIndex: number, text: string) => {
      const newChatLog = chatLog.map((v: Message, i) => {
        return i === targetIndex ? { role: v.role, content: text } : v;
      });

      setChatLog(newChatLog);
    },
    [chatLog]
  );

  /**
   * 文ごとに音声を直列でリクエストしながら再生する
   */
  const handleSpeakAi = useCallback(
    async (
      screenplay: Screenplay,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      speakCharacter(screenplay, viewer, koeiromapKey, onStart, onEnd);
    },
    [viewer, koeiromapKey]
  );

  /**
   * アシスタントとの会話を行う
   */
  const handleSendChat = useCallback(
    async (text: string) => {
      if (!openAiKey) {
        setAssistantMessage("APIキーが入力されていません");
        return;
      }

      const newMessage = text;

      if (newMessage == null) return;

      setChatProcessing(true);
      // ユーザーの発言を追加して表示
      const messageLog: Message[] = [
        ...chatLog,
        { role: "user", content: newMessage },
      ];
      setChatLog(messageLog);

      // Chat GPTへ
      const messages: Message[] = [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messageLog,
      ];

      const chunks: any = await getChatResponseStream(messages, openAiKey).catch(
        (e) => {
          console.error(e);
          return null;
        }
      );
      if (chunks == null) {
        setChatProcessing(false);
        return;
      }
      let receivedMessage = "";
      let aiTextLog = "";
      let tag = "";
      const sentences = new Array<string>();
      for await (const chunk of chunks) {
        receivedMessage += chunk.choices[0]?.delta.content || "";
        console.log(receivedMessage);
        if (chunk.usage) {
          console.log(chunk.usage); // only last chunk has usage
        }
        // 下側のメッセージに表示する
        setAssistantMessage(receivedMessage);
      }
        // 返答内容のタグ部分の検出
        const tagMatch = receivedMessage.match(/^\[(.*?)\]/);
        if (tagMatch && tagMatch[0]) {
          tag = tagMatch[0];
          receivedMessage = receivedMessage.slice(tag.length);
        }
        // <think>から</think>までの部分を削除
        receivedMessage = receivedMessage.replace(/<think>.*<\/think>/, '');
        console.log("receivedMessage="+receivedMessage);
        // 最後の行だけ取り出す
        const tmpstr = receivedMessage.trim();
        const lines = tmpstr.split("\n");
        if (lines.length === 0) {
          console.log("No lines found in the response.");
          return;
        }
        const lastLine = lines[lines.length - 1].trim();
        // 下側のメッセージに表示する
        setAssistantMessage(lastLine);

        const aiText = `${tag} ${lastLine}`;
        const aiTalks = textsToScreenplay([aiText], koeiroParam);
        aiTextLog += aiText;

          // 文ごとに音声を生成 & 再生、返答を表示
          /* オリジナルのChatVRMはここで音声を生成していたが、
          koeiromapKeyが無いので機能しないはず */
          handleSpeakAi(aiTalks[0], () => {
            setAssistantMessage(lastLine);
          });
          // ----------------------
          // SpeechSynthesis APIのインスタンスを取得
          const synth = window.speechSynthesis;
          // 読み上げ用のオブジェクトを作成
          const utterance = new SpeechSynthesisUtterance(lastLine);

          // ボイスの選択
          utterance.lang = voiceLang; // 言語を指定 en-US / ja-JP
          // 読み上げ中の口パクを制御
          let lipSyncInterval: NodeJS.Timeout | null = null;

          // 読み上げの実行
          synth.speak(utterance);
          //viewer.model!.openlip = 1.0;
          // 読み上げ開始時
          utterance.onstart = function () {
            console.log("speak start");
            lipSyncInterval = setInterval(() => {
              // ランダムな値で口の開き具合をシミュレート
              if (viewer.model) {
                viewer.model.openlip = Math.random() * 0.5 + 0.5; // 0.5〜1.0の範囲で変化
              }
            }, 100); // 100msごとに更新
          };

          // 読み上げ終わりを検出
          utterance.onend = function (ev) {
            console.log("speak end");
            if (lipSyncInterval) {
              clearInterval(lipSyncInterval); // タイマーを停止
              lipSyncInterval = null;
            }
            if (viewer.model) {
              viewer.model.openlip = 0; // 口を閉じる
            }
            // 下側のメッセージ削除
            setAssistantMessage("");
          };
          // ----------END---------



      // アシスタントの返答をログに追加
      const messageLogAssistant: Message[] = [
        ...messageLog,
        { role: "assistant", content: aiTextLog },
      ];

      setChatLog(messageLogAssistant);
      setChatProcessing(false);
    },
    [systemPrompt, chatLog, handleSpeakAi, openAiKey, koeiroParam, voiceLang]
  );

  return (
    <div className={"font-M_PLUS_2"}>
      <Meta />
      <Introduction
        openAiKey={openAiKey}
        koeiroMapKey={koeiromapKey}
        onChangeAiKey={setOpenAiKey}
        onChangeKoeiromapKey={setKoeiromapKey}
        onChangeVoiceLang={setVoiceLang} // 言語変更関数を渡す
      />
      <VrmViewer />
      <MessageInputContainer
        isChatProcessing={chatProcessing}
        onChatProcessStart={handleSendChat}
      />
      <Menu
        openAiKey={openAiKey}
        systemPrompt={systemPrompt}
        chatLog={chatLog}
        koeiroParam={koeiroParam}
        assistantMessage={assistantMessage}
        koeiromapKey={koeiromapKey}
        onChangeAiKey={setOpenAiKey}
        onChangeSystemPrompt={setSystemPrompt}
        onChangeChatLog={handleChangeChatLog}
        onChangeKoeiromapParam={setKoeiroParam}
        handleClickResetChatLog={() => setChatLog([])}
        handleClickResetSystemPrompt={() => setSystemPrompt(SYSTEM_PROMPT)}
        onChangeKoeiromapKey={setKoeiromapKey}
      />
      <GitHubLink />
    </div>
  );
}
