import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { DatingMatchModal } from "@/components/DatingMatchModal";

export type DatingProfileSnapshot = {
  id: string;
  name: string;
  age?: number | null;
  location?: string | null;
  intent: string;
  photos: string[];
  
  likedCurrentUser?: boolean;
};

export type DatingLike = {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: "vibe" | "spark";
  createdAt: string;
};

export type DatingPass = {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
};

export type DatingChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

export type DatingChat = {
  id: string;
  participantIds: string[];
  type: "dating_match";
  messages: DatingChatMessage[];
};

export type DatingMatch = {
  id: string;
  userIds: [string, string];
  profile: DatingProfileSnapshot;
  chatId: string;
  createdAt: string;
};

type Ctx = {
  currentUserId: string;
  likes: DatingLike[];
  passes: DatingPass[];
  matches: DatingMatch[];
  chats: DatingChat[];
  
  recordVibe: (profile: DatingProfileSnapshot) => DatingMatch | null;
  recordSpark: (profile: DatingProfileSnapshot) => DatingMatch | null;
  recordPass: (profile: DatingProfileSnapshot) => void;
  
  hasInteracted: (profileId: string) => boolean;
  
  getChat: (chatId: string) => DatingChat | undefined;
  sendMessage: (chatId: string, text: string) => void;
};

const DatingMatchCtx = createContext<Ctx | null>(null);

const CURRENT_USER_ID = "user_self";


function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DatingMatchProvider({ children }: { children: ReactNode }) {
  const [likes, setLikes] = useState<DatingLike[]>([]);
  const [passes, setPasses] = useState<DatingPass[]>([]);
  const [matches, setMatches] = useState<DatingMatch[]>([]);
  const [chats, setChats] = useState<DatingChat[]>([]);
  const [modalMatch, setModalMatch] = useState<DatingMatch | null>(null);

  
  const likesRef = useRef(likes);
  likesRef.current = likes;
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  const hasInteracted = useCallback(
    (profileId: string) => {
      const liked = likesRef.current.some(
        (l) => l.fromUserId === CURRENT_USER_ID && l.toUserId === profileId,
      );
      if (liked) return true;
      return passes.some(
        (p) => p.fromUserId === CURRENT_USER_ID && p.toUserId === profileId,
      );
    },
    [passes],
  );

  const createMatchInternal = useCallback(
    (profile: DatingProfileSnapshot): DatingMatch => {
      const chatId = makeId();
      const newChat: DatingChat = {
        id: chatId,
        participantIds: [CURRENT_USER_ID, profile.id],
        type: "dating_match",
        messages: [
          {
            id: makeId(),
            senderId: "system",
            text: `You matched with ${profile.name}. Say something fun 👀`,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      const newMatch: DatingMatch = {
        id: makeId(),
        userIds: [CURRENT_USER_ID, profile.id],
        profile,
        chatId,
        createdAt: new Date().toISOString(),
      };
      setChats((prev) => [...prev, newChat]);
      setMatches((prev) => [...prev, newMatch]);
      return newMatch;
    },
    [],
  );

  const recordLike = useCallback(
    (profile: DatingProfileSnapshot, type: "vibe" | "spark"): DatingMatch | null => {
      
      const already = likesRef.current.some(
        (l) => l.fromUserId === CURRENT_USER_ID && l.toUserId === profile.id,
      );
      if (already) return null;

      const newLike: DatingLike = {
        id: makeId(),
        fromUserId: CURRENT_USER_ID,
        toUserId: profile.id,
        type,
        createdAt: new Date().toISOString(),
      };
      setLikes((prev) => [...prev, newLike]);

      
      const reciprocated =
        profile.likedCurrentUser === true ||
        likesRef.current.some(
          (l) => l.fromUserId === profile.id && l.toUserId === CURRENT_USER_ID,
        );

      
      const existing = matchesRef.current.find(
        (m) => m.userIds.includes(profile.id),
      );
      if (existing) return null;

      if (reciprocated) {
        const created = createMatchInternal(profile);
        setModalMatch(created);
        return created;
      }
      return null;
    },
    [createMatchInternal],
  );

  const recordVibe = useCallback(
    (profile: DatingProfileSnapshot) => recordLike(profile, "vibe"),
    [recordLike],
  );
  const recordSpark = useCallback(
    (profile: DatingProfileSnapshot) => recordLike(profile, "spark"),
    [recordLike],
  );

  const recordPass = useCallback((profile: DatingProfileSnapshot) => {
    
    setPasses((prev) => {
      if (
        prev.some(
          (p) => p.fromUserId === CURRENT_USER_ID && p.toUserId === profile.id,
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          id: makeId(),
          fromUserId: CURRENT_USER_ID,
          toUserId: profile.id,
          createdAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const getChat = useCallback(
    (chatId: string) => chats.find((c) => c.id === chatId),
    [chats],
  );

  const sendMessage = useCallback((chatId: string, text: string) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: makeId(),
                  senderId: CURRENT_USER_ID,
                  text,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : c,
      ),
    );
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      currentUserId: CURRENT_USER_ID,
      likes,
      passes,
      matches,
      chats,
      recordVibe,
      recordSpark,
      recordPass,
      hasInteracted,
      getChat,
      sendMessage,
    }),
    [
      likes,
      passes,
      matches,
      chats,
      recordVibe,
      recordSpark,
      recordPass,
      hasInteracted,
      getChat,
      sendMessage,
    ],
  );

  return (
    <DatingMatchCtx.Provider value={value}>
      {children}
      <DatingMatchModal
        match={modalMatch}
        onClose={() => setModalMatch(null)}
      />
    </DatingMatchCtx.Provider>
  );
}

export function useDatingMatches(): Ctx {
  const ctx = useContext(DatingMatchCtx);
  if (!ctx) {
    throw new Error("useDatingMatches must be used inside <DatingMatchProvider>");
  }
  return ctx;
}
