import { IconButton } from "./iconButton";
import { BiImageAdd } from "react-icons/bi";
import { ElementType } from "react";

type Props = {
  userMessage: string;
  imagePreview?: {
    dataUrl: string;
    name: string;
  };
  isMicRecording: boolean;
  isChatProcessing: boolean;
  onChangeUserMessage: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onClickSendButton: () => void;
  onClickMicButton: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChangeImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClickRemoveImage: () => void;
};
export const MessageInput = ({
  userMessage,
  imagePreview,
  isMicRecording,
  isChatProcessing,
  onChangeUserMessage,
  onClickMicButton,
  onClickSendButton,
  onChangeImage,
  onClickRemoveImage,
}: Props) => {
  const ImageAddIcon = BiImageAdd as ElementType<{ className?: string }>;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    if (isChatProcessing || (!userMessage.trim() && !imagePreview)) return;

    event.preventDefault();
    onClickSendButton();
  };

  return (
    <div className="absolute bottom-0 z-20 w-screen">
      <div className="bg-base text-black">
        <div className="mx-auto max-w-4xl p-16">
          {imagePreview ? (
            <div className="mb-8 flex items-center gap-8 rounded-8 bg-surface1 px-8 py-8">
              <img
                src={imagePreview.dataUrl}
                alt={imagePreview.name}
                className="h-48 w-48 rounded-8 object-cover"
              />
              <div className="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">
                {imagePreview.name}
              </div>
              <IconButton
                iconName="24/X"
                className="bg-primary hover:bg-primary-hover active:bg-primary-press disabled:bg-primary-disabled"
                isProcessing={false}
                disabled={isChatProcessing}
                onClick={onClickRemoveImage}
              />
            </div>
          ) : null}
          <div className="grid grid-flow-col gap-[8px] grid-cols-[min-content_min-content_1fr_min-content]">
            <IconButton
              iconName="24/Microphone"
              className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
              isProcessing={isMicRecording}
              disabled={isChatProcessing}
              onClick={onClickMicButton}
            />
            <label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isChatProcessing}
                onChange={onChangeImage}
              />
              <span className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled text-white rounded-16 text-sm p-8 text-center inline-flex items-center mr-2 cursor-pointer">
                <ImageAddIcon className="text-2xl" />
              </span>
            </label>
            <input
              type="text"
              placeholder="聞きたいことをいれてね"
              onChange={onChangeUserMessage}
              onKeyDown={handleKeyDown}
              disabled={isChatProcessing}
              className="bg-surface1 hover:bg-surface1-hover focus:bg-surface1 disabled:bg-surface1-disabled disabled:text-primary-disabled rounded-16 w-full px-16 text-text-primary typography-16 font-bold disabled"
              value={userMessage}
            ></input>

            <IconButton
              iconName="24/Send"
              className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
              isProcessing={isChatProcessing}
              disabled={isChatProcessing || (!userMessage && !imagePreview)}
              onClick={onClickSendButton}
            />
          </div>
        </div>
        <div className="py-4 bg-[#413D43] text-center text-white font-Montserrat">
          powered by ChatVRM Transformers.js v4
        </div>
      </div>
    </div>
  );
};
