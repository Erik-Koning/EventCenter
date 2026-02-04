import { ChatInterface } from "@/components/chat/ChatInterface";

export const metadata = {
  title: "Chat | Clio",
  description: "Chat with the AI assistant",
};

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-80px)]">
      <ChatInterface className="h-full" />
    </div>
  );
}
