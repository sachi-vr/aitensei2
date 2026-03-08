import {
  BiConversation,
  BiDotsHorizontalRounded,
  BiMenu,
  BiMicrophone,
  BiSend,
  BiX,
} from "react-icons/bi";
import { ButtonHTMLAttributes, ElementType } from "react";

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
  const Icon = (
    isProcessing
      ? BiDotsHorizontalRounded
      : iconName === "24/Menu"
        ? BiMenu
        : iconName === "24/CommentFill"
          ? BiConversation
          : iconName === "24/Microphone"
            ? BiMicrophone
            : iconName === "24/Send"
              ? BiSend
              : BiX
  ) as ElementType<{ className?: string }>;

  return (
    <button
      {...rest}
      className={`bg-primary hover:bg-primary-hover active:bg-primary-press disabled:bg-primary-disabled text-white rounded-16 text-sm p-8 text-center inline-flex items-center mr-2
        ${rest.className}
      `}
    >
      <Icon className="text-2xl" />
      {label && <div className="mx-4 font-bold">{label}</div>}
    </button>
  );
};
