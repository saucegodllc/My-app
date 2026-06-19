import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import {
  useGetMessages,
  useSendMessage,
  useGetMatches,
  getGetMessagesQueryKey,
  getGetMatchesQueryKey,
} from "@workspace/api-client-react";
import { Nav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Send, ArrowLeft, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Profile = { userId: string; displayName: string; photos?: string[] | null };
type Message = { id: string; matchId: string; senderId: string; content: string; isRead: boolean; createdAt: string };
type Match = { id: string; userId1: string; userId2: string; otherProfile?: Profile };

const SOCKET_PATH = "/api/socket.io";

function getSocketOrigin() {
  return window.location.origin;
}

export default function MessagesPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { userId, getToken } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingEmitRef = useRef(false);

  const matchParams = { page: 1, limit: 50 };
  const { data: matchesData, isLoading: matchesLoading } = useGetMatches(matchParams, {
    query: { queryKey: getGetMatchesQueryKey(matchParams) },
  });

  const matches = (matchesData as { matches?: Match[] })?.matches ?? [];
  const match = matches.find((m) => m.id === matchId);
  const otherProfile = match?.otherProfile;

  const msgParams = { page: 1, limit: 100 };
  const { data: messagesData, isLoading: msgsLoading } = useGetMessages(matchId!, msgParams, {
    query: { queryKey: getGetMessagesQueryKey(matchId!, msgParams), enabled: !!matchId },
  });

  const { mutateAsync: sendMessageHttp } = useSendMessage();

  useEffect(() => {
    const fetched = (messagesData as { messages?: Message[] })?.messages ?? [];
    setMessages(fetched);
  }, [messagesData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, otherTyping]);

  useEffect(() => {
    if (!matchId) return;

    let socket: Socket;
    let mounted = true;

    async function connect() {
      const token = await getToken();
      if (!mounted) return;

      socket = io(getSocketOrigin(), {
        path: SOCKET_PATH,
        auth: { token },
        transports: ["websocket", "polling"],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        if (!mounted) return;
        setIsConnected(true);
        socket.emit("join_room", matchId);
      });

      socket.on("disconnect", () => {
        if (!mounted) return;
        setIsConnected(false);
        setOtherTyping(false);
      });

      socket.on("connect_error", (err) => {
        if (!mounted) return;
        console.warn("Socket connection error:", err.message);
        setIsConnected(false);
      });

      socket.on("new_message", (msg: Message) => {
        if (!mounted) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        qc.invalidateQueries({ queryKey: getGetMatchesQueryKey(matchParams) });
      });

      socket.on("typing", ({ isTyping }: { userId: string; isTyping: boolean }) => {
        if (!mounted) return;
        setOtherTyping(isTyping);
      });

      socket.on("error", (message: string) => {
        console.warn("Socket error:", message);
      });
    }

    connect();

    return () => {
      mounted = false;
      if (socket) {
        socket.emit("leave_room", matchId);
        socket.disconnect();
      }
      socketRef.current = null;
      setIsConnected(false);
      setOtherTyping(false);
    };
  }, [matchId, getToken]);

  const emitStopTyping = useCallback(() => {
    if (typingEmitRef.current && socketRef.current?.connected) {
      socketRef.current.emit("typing", { matchId, isTyping: false });
      typingEmitRef.current = false;
    }
  }, [matchId]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);

    if (socketRef.current?.connected) {
      if (!typingEmitRef.current) {
        socketRef.current.emit("typing", { matchId, isTyping: true });
        typingEmitRef.current = true;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitStopTyping();
      }, 2000);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !matchId) return;
    const content = text.trim();
    setText("");

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitStopTyping();

    if (socketRef.current?.connected) {
      socketRef.current.emit("send_message", { matchId, content });
    } else {
      try {
        await sendMessageHttp({ matchId, data: { content } });
        qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(matchId, msgParams) });
        qc.invalidateQueries({ queryKey: getGetMatchesQueryKey(matchParams) });
      } catch {
        setText(content);
        toast.error("Failed to send message");
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />
      <div className="flex-1 flex flex-col pt-16 pb-16 md:pb-0 max-w-2xl mx-auto w-full">
        <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-background/80 backdrop-blur-xl sticky top-16 z-10">
          <Link href="/matches">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          {matchesLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : otherProfile ? (
            <Link href={`/profile/${otherProfile.userId}`} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 shrink-0">
                {otherProfile.photos?.[0] ? (
                  <img src={`${import.meta.env.BASE_URL}api/storage/objects/${(otherProfile.photos[0] ?? "").replace(/^\/objects\//, "")}`} alt={otherProfile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-bold text-primary">{otherProfile.displayName.charAt(0)}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{otherProfile.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {otherTyping ? (
                    <span className="text-primary">typing…</span>
                  ) : (
                    "Tap to view profile"
                  )}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2 text-destructive text-sm flex-1">
              <AlertTriangle className="w-4 h-4" />
              Conversation not found
            </div>
          )}

          <div className="ml-auto shrink-0">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {msgsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                  <Skeleton className="h-10 w-48 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No messages yet.</p>
              <p className="text-muted-foreground text-sm">Say hello to {otherProfile?.displayName ?? "your match"}!</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isMe = msg.senderId === userId;
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-xs px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      isMe
                        ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}>
                      {msg.content}
                      <div className={cn("text-xs mt-1", isMe ? "text-white/60" : "text-muted-foreground")}>
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {otherTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <div className="flex gap-1 items-center h-5">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-border px-4 py-3 flex gap-2 sticky bottom-16 md:bottom-0 bg-background">
          <Input
            value={text}
            onChange={handleTextChange}
            placeholder={`Message ${otherProfile?.displayName ?? "your match"}...`}
            className="flex-1 rounded-full"
            disabled={!otherProfile}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || !otherProfile}
            className="rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 border-0 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
