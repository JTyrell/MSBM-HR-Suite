/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Hash, Megaphone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string };
}

export default function Messaging() {
  const { user } = useAuth();
  const msgEnabled = useFeatureFlag("enabled_messaging");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [announcements, setAnnouncements] = useState<Record<string, any>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Realtime subscription for messages in active channel
  useRealtimeChannel(
    {
      channel: `messages-${activeChannel?.id || "none"}`,
      table: "messages",
      event: "INSERT",
      filter: activeChannel ? `channel_id=eq.${activeChannel.id}` : undefined,
    },
    (payload) => {
      if (payload.new) {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
      }
    }
  );

  useEffect(() => {
    const fetch = async () => {
      const [chRes, annRes] = await Promise.all([
        supabase.from("channels").select("*").order("name"),
        supabase.from("announcements").select("*, profiles!announcements_author_id_fkey(first_name, last_name)").order("published_at", { ascending: false }).limit(5),
      ]);
      setChannels(chRes.data || []);
      setAnnouncements(annRes.data || []);
      if (chRes.data && chRes.data.length > 0 && !activeChannel) {
        setActiveChannel(chRes.data[0]);
      }
    };
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, profiles!messages_sender_id_fkey(first_name, last_name)")
        .eq("channel_id", activeChannel.id)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages(data || []);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight || 0 }), 100);
    };
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel?.id]);

  if (!msgEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Messaging is not enabled. Contact your administrator.</p>
      </div>
    );
  }

  const handleSend = async () => {
    if (!newMessage.trim() || !activeChannel || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id,
      sender_id: user.id,
      content: newMessage.trim(),
    });
    if (error) toast.error(error.message);
    else setNewMessage("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-7 w-7 text-primary" /> Messages
        </h1>
        <p className="text-muted-foreground mt-1">Team communication hub</p>
      </div>

      {/* Announcements Banner */}
      {announcements.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Latest Announcements</span>
            </div>
            {announcements.slice(0, 2).map(a => (
              <div key={a.id} className="text-sm mb-1">
                <span className="font-medium">{a.title}</span>
                <span className="text-muted-foreground"> â€” {a.profiles?.first_name} {a.profiles?.last_name}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-4 h-[60vh]">
        {/* Channel List */}
        <Card className="col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Channels</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                    activeChannel?.id === ch.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"
                  }`}
                >
                  <Hash className="h-4 w-4 shrink-0 opacity-50" />
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
              {channels.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No channels yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message Area */}
        <Card className="col-span-9 flex flex-col">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4 opacity-50" />
              {activeChannel?.name || "Select a channel"}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-3">
              {messages.map(m => {
                const isOwn = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      isOwn ? "bg-primary text-primary-foreground" : "bg-accent"
                    }`}>
                      {!isOwn && m.profiles && (
                        <p className="text-xs font-semibold mb-0.5 opacity-70">
                          {m.profiles.first_name} {m.profiles.last_name}
                        </p>
                      )}
                      <p>{m.content}</p>
                      <p className={`text-[10px] mt-1 ${isOwn ? "opacity-60" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {activeChannel && (
            <div className="border-t p-3 flex gap-2">
              <Input
                placeholder={`Message #${activeChannel.name}...`}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              <Button size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
