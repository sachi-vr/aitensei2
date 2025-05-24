# AI転生2

pixiv/ChatVRMを元としたプロジェクトです。
WebLLMに対応させました。

---
AI転生2はブラウザで簡単に3Dキャラクターと会話ができるデモアプリケーションです。

VRMファイルをインポートしてキャラクターに合わせた声の調整や、感情表現を含んだ返答文の生成などを行うことができます。

AI転生2の各機能は主に以下の技術を使用しています。

- ユーザーの音声の認識
    - [Web Speech API(SpeechRecognition)](https://developer.mozilla.org/ja/docs/Web/API/SpeechRecognition)
- 返答文の生成
    - [WebLLM](https://webllm.mlc.ai/)
- 読み上げ音声の生成
    - [SpeechSynthesis](https://developer.mozilla.org/ja/docs/Web/API/SpeechSynthesis)
- 3Dキャラクターの表示
    - [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)


## デモ

[DEMOページ](https://aitensei2.vsachi.com/)

## 実行
ローカル環境で実行する場合はこのリポジトリをクローンするか、ダウンロードしてください。

```bash
git clone git@github.com:sachi-vr/aitensei2.git
```

必要なパッケージをインストールしてください。
```bash
npm install
```

パッケージのインストールが完了した後、以下のコマンドで開発用のWebサーバーを起動します。
```bash
npm run dev
```

実行後、以下のURLにアクセスして動作を確認して下さい。

[http://localhost:3000](http://localhost:3000) 

outputに出力する場合
```bash
npm run export
```
---
