import { BiDotsHorizontalRounded } from "react-icons/bi";
import { BiX } from "react-icons/bi";
import { BiMenu } from "react-icons/bi";
import { BiConversation } from "react-icons/bi";
import { BiMicrophone } from "react-icons/bi";
import { BiSend } from "react-icons/bi";
/* ここまでreact-icons */
import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  iconName: string;
  isProcessing: boolean;
  label?: string;
};

export const IconButton = ({
  iconName,
  isProcessing,
  label,
  ...rest
}: Props) => {
  return (
    <button
      {...rest}
      className={`bg-primary hover:bg-primary-hover active:bg-primary-press disabled:bg-primary-disabled text-white rounded-16 text-sm p-8 text-center inline-flex items-center mr-2
        ${rest.className}
      `}
    >
      {isProcessing ? (
        // 処理中がTrue
       <BiDotsHorizontalRounded className="text-2xl" />
      ) : (
        (iconName ==="24/Menu" ? (/*24/Menu"がTrue*/<BiMenu className="text-2xl" />) : 
          (iconName ==="24/CommentFill" ? (/*24/CommentFill会話ログ有*/<BiConversation className="text-2xl" />) :
            (iconName === "24/Microphone" ? (/*24/MicrophoneがTrue*/<BiMicrophone className="text-2xl" />) :
              (iconName === "24/Send" ? (/*24/SendがTrue*/<BiSend className="text-2xl" />) :
                (/*FalseX*/<BiX className="text-2xl" />)
              )
            )
          )
        )
      )}
      {label && <div className="mx-4 font-bold">{label}</div>}
    </button>
  );
};
