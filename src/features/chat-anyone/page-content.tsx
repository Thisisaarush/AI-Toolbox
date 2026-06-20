"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, Send, Trash2, Sparkles, ChevronRight, Loader2 } from "lucide-react"

type Message = {
  id: string
  role: "user" | "persona"
  content: string
  timestamp: number
}

type Persona = {
  id: string
  name: string
  emoji: string
  color: string
  description: string
  starters: string[]
  replies: string[]
}

const PERSONAS: Persona[] = [
  {
    id: "interviewer",
    name: "Interviewer",
    emoji: "🎯",
    color: "text-blue-500",
    description: "Formal, asks behavioral & technical questions",
    starters: [
      "Tell me about a time you handled a difficult situation at work.",
      "Why should we hire you for this role?",
      "Walk me through your experience with system design.",
      "Describe a project where you had to collaborate across teams.",
    ],
    replies: [
      "That's a great example. Can you tell me more about what you learned from that experience?",
      "Interesting approach. How would you handle it differently if you could go back?",
      "I appreciate the detail. How did you measure the success of that initiative?",
      "That shows good leadership. Can you give me a specific metric or outcome?",
      "Let me ask a follow-up: what was the biggest obstacle you faced there?",
      "I see. How does this experience relate to the role you're applying for?",
      "Solid answer. Now let's talk about a time you had to deal with ambiguity.",
      "How do you stay updated with industry trends and new technologies?",
      "Tell me about a time you disagreed with a manager or peer.",
      "What would your previous manager say is your biggest strength?",
      "Can you walk me through your process for debugging a complex issue?",
      "How do you prioritize tasks when everything feels urgent?",
      "Describe a situation where you had to learn a new technology quickly.",
      "That's a strong answer. What motivates you to do your best work?",
      "Where do you see yourself in five years?",
      "Thank you. I think that covers my questions. Do you have any for me?",
    ],
  },
  {
    id: "best-friend",
    name: "Best Friend",
    emoji: "🫂",
    color: "text-emerald-500",
    description: "Casual, supportive, jokes around",
    starters: [
      "Dude, you won't believe what happened to me today!",
      "I need your honest opinion on something.",
      "What's the move this weekend?",
      "I'm so stressed about everything right now.",
    ],
    replies: [
      "NO WAY, tell me everything! I've got all day.",
      "Haha I love that! You're literally the main character.",
      "Honestly? You're overthinking it. Just go for it!",
      "Okay but for real, you're doing amazing. Don't let anyone tell you otherwise.",
      "LMAO I can't believe you just said that.",
      "I'm here for you. Whatever you need, I've got your back.",
      "That's literally so wild. We need to grab coffee and debrief ASAP.",
      "Bro/Sis, you are way too hard on yourself. Take a breath.",
      "Ooooh that's actually a great idea. I'm in if you're doing that.",
      "Wait wait wait, say that again but slower. I need to process the tea.",
      "You know what? You're right. I support this decision 100%.",
      "Okay new plan: we ignore all responsibilities and go touch grass.",
      "I'm literally screaming. That's the most you thing ever.",
      "Sending you a virtual hug right now. You've got this.",
      "Proud of you, random internet friend. No wait, you're my bestie.",
      "Let's manifest good vibes for you this week. I'm calling it now.",
    ],
  },
  {
    id: "mentor",
    name: "Mentor",
    emoji: "🧭",
    color: "text-purple-500",
    description: "Wise, asks thought-provoking questions",
    starters: [
      "What's the one thing you'd work on if you knew you couldn't fail?",
      "I've noticed you have potential. What's holding you back?",
      "Let's talk about where you want to be in 1 year.",
      "What skill do you wish you had mastered by now?",
    ],
    replies: [
      "That's a great reflection point. What would taking the first step look like?",
      "I've seen many people struggle with that. The key is consistency, not intensity.",
      "Let me challenge you on that: what evidence do you have that it's not possible?",
      "Growth happens at the edge of your comfort zone. Stretch a little every day.",
      "Have you considered breaking that goal into smaller, measurable milestones?",
      "The fact that you're asking this question tells me you're on the right track.",
      "I'd encourage you to find a community of people working toward similar goals.",
      "Don't let perfectionism paralyze you. Done is better than perfect.",
      "What would your future self thank you for starting today?",
      "One book I'd recommend is 'Atomic Habits' — it changed how I think about progress.",
      "Let's reframe that: instead of 'I should', try 'I choose to'. It changes everything.",
      "Mentorship is a two-way street. What value can you bring to others right now?",
      "The most successful people I know read constantly. What's on your reading list?",
      "Take a step back. Is this goal yours, or someone else's expectation?",
      "I'm confident you can do this. The question is: are you willing to do the work?",
      "Let's set up a checkpoint for next week. Accountability is everything.",
    ],
  },
  {
    id: "customer-support",
    name: "Support Agent",
    emoji: "🎧",
    color: "text-sky-500",
    description: "Helpful, professional, solution-oriented",
    starters: [
      "Hi! I'm having trouble logging into my account.",
      "Can you help me with a refund for my recent purchase?",
      "My order hasn't arrived yet, it's been two weeks.",
      "How do I upgrade my subscription plan?",
    ],
    replies: [
      "I'm sorry to hear that! Let me look into this for you right away.",
      "Thanks for reaching out. Could you share your account email so I can pull up your details?",
      "I understand how frustrating this must be. Let's get it sorted.",
      "Great news — I've found the issue and it should be resolved within the hour.",
      "I've escalated this to our technical team. You'll hear back within 24 hours.",
      "Here's a step-by-step guide I've put together for you.",
      "I've processed the refund. It should appear in 3-5 business days.",
      "Let me send you a confirmation email with all the details.",
      "Is there anything else I can help you with today?",
      "I've checked the tracking and it looks like there's a delay with the carrier.",
      "I'm going to send you a replacement order right now, no extra charge.",
      "You can upgrade your plan from the Billing section in Settings.",
      "I've applied a 20% discount as a courtesy for the inconvenience.",
      "Let me transfer you to our specialist team who can handle this faster.",
      "I appreciate your patience. We're working hard to make this right.",
      "Your feedback has been noted and shared with the product team.",
    ],
  },
  {
    id: "therapist",
    name: "Therapist",
    emoji: "🛋️",
    color: "text-amber-500",
    description: "Reflective, asks 'how does that make you feel'",
    starters: [
      "I've been feeling really overwhelmed lately and I don't know why.",
      "I keep repeating the same self-destructive patterns.",
      "I feel like I'm not good enough no matter what I do.",
      "There's a decision I need to make and I'm paralyzed by it.",
    ],
    replies: [
      "It sounds like you're carrying a lot right now. Let's unpack that together.",
      "How does that make you feel when you think about it?",
      "I hear you. What does that feeling tell you about what you need?",
      "Let's sit with that emotion for a moment. Where do you feel it in your body?",
      "It's completely normal to feel that way. You're not alone.",
      "What would it look like to give yourself permission to rest?",
      "I notice you used the word 'always'. Is that truly the case, or is there an exception?",
      "Let's explore the story you're telling yourself about this situation.",
      "Have you felt this way before? What helped you then?",
      "What's one small thing you could do today to show yourself kindness?",
      "It takes courage to share that. Thank you for trusting me.",
      "Let's take a step back. What's within your control right now?",
      "Your feelings are valid. We don't need to fix them, just understand them.",
      "What would you say to a friend who came to you with this same concern?",
      "Progress isn't linear. Some days are harder, and that's okay.",
      "I'd like you to try an exercise this week. Write down three things you're grateful for each day.",
    ],
  },
  {
    id: "chef",
    name: "Chef",
    emoji: "👨‍🍳",
    color: "text-orange-500",
    description: "Asks about food preferences, shares recipes",
    starters: [
      "What's your go-to comfort food?",
      "I want to cook something impressive for a date. Any ideas?",
      "How do I make the perfect pasta from scratch?",
      "What's a dish that always impresses at dinner parties?",
    ],
    replies: [
      "Ah, comfort food! Let me tell you about my ultimate mac and cheese recipe.",
      "For a date night, you can't go wrong with a classic risotto. Looks hard, but I'll walk you through it.",
      "The secret to great pasta is salting the water until it tastes like the sea.",
      "My go-to dinner party dish is a slow-braised short rib. Prep in 15 minutes, tastes like you slaved all day.",
      "Never overcrowd the pan. You want a sear, not a steam.",
      "Fresh herbs make all the difference. Trust me on this one.",
      "Let's start simple: what's your favorite cuisine? We'll build from there.",
      "Here's a pro tip: let your protein rest before cutting. Game changer.",
      "I've got a 5-ingredient recipe that will blow their minds. Ready?",
      "The most important ingredient is love. Corny but true.",
      "You need a good knife. A sharp chef's knife changes everything.",
      "If you can make a perfect vinaigrette, you can make any salad sing.",
      "Let's talk umami. A little miso paste or fish sauce elevates any savory dish.",
      "Dessert? I've got a no-bake cheesecake that's foolproof.",
      "Season as you go, not just at the end. Layers of flavor, baby.",
      "I'm sending you my grandmother's sauce recipe. Guard it with your life.",
    ],
  },
  {
    id: "fitness-coach",
    name: "Fitness Coach",
    emoji: "💪",
    color: "text-green-500",
    description: "Motivational, asks about workout goals",
    starters: [
      "I want to get in shape but I don't know where to start.",
      "How do I stay motivated when I really don't feel like working out?",
      "What's the best workout for building muscle at home?",
      "I hit a plateau and I'm not seeing progress anymore.",
    ],
    replies: [
      "First off, showing up is the hardest part. You've already won half the battle.",
      "Start with bodyweight exercises. Squats, push-ups, planks. Master the basics.",
      "Plateaus are normal! Your body adapted. Time to shock it with new movements.",
      "Motivation is unreliable. Build discipline instead. Commit to just 10 minutes on low days.",
      "You don't need a gym. A pair of dumbbells and a jump rope can transform your fitness.",
      "Progressive overload is the key. Add one more rep or a little more weight each week.",
      "Form over ego. I'd rather see perfect form with light weight than sloppy heavy lifts.",
      "Rest days aren't lazy — they're when your muscles actually grow.",
      "Let's set a specific goal. 'Get in shape' is too vague. What does it look like?",
      "Track your workouts. Seeing progress on paper is incredibly motivating.",
      "Nutrition is 80% of the result. You can't out-train a bad diet.",
      "Drink more water. Most 'fatigue' is just dehydration.",
      "Get 7-8 hours of sleep. That's when your body recovers and builds muscle.",
      "Try a full-body routine 3x a week. Consistent > Intense.",
      "I want you to do 10 push-ups right now. Not later. Right now. Go!",
      "You've got this. One rep at a time, one day at a time. I'm in your corner.",
    ],
  },
]

const STORAGE_KEY = "chat-anyone-v1"
const MAX_MESSAGES = 50

function loadHistory(personaId: string): Message[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${personaId}`)
    if (raw) return JSON.parse(raw) as Message[]
  } catch { /* ignore */ }
  return []
}

function saveHistory(personaId: string, messages: Message[]) {
  const trimmed = messages.slice(-MAX_MESSAGES)
  localStorage.setItem(`${STORAGE_KEY}-${personaId}`, JSON.stringify(trimmed))
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function ChatAnyoneContent() {
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]!)
  const [messages, setMessages] = useState<Message[]>(() => loadHistory(PERSONAS[0]!.id))
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showPersonaPicker, setShowPersonaPicker] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(loadHistory(selectedPersona.id))
  }, [selectedPersona.id])

  useEffect(() => {
    saveHistory(selectedPersona.id, messages)
  }, [messages, selectedPersona.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const reply = selectedPersona.replies[Math.floor(Math.random() * selectedPersona.replies.length)]!
      const personaMsg: Message = {
        id: uid(),
        role: "persona",
        content: reply,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, personaMsg])
      setIsTyping(false)
    }, 1000 + Math.random() * 1000)
  }, [selectedPersona])

  const handleStarter = useCallback((starter: string) => {
    const personaMsg: Message = {
      id: uid(),
      role: "persona",
      content: starter,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, personaMsg])
  }, [])

  const handleClear = useCallback(() => {
    setMessages([])
    localStorage.removeItem(`${STORAGE_KEY}-${selectedPersona.id}`)
  }, [selectedPersona.id])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      <ToolHeader title="Chat with Anyone" icon={MessageCircle} color="text-pink-500" badge="Simulation" />

      <div className="max-w-4xl mx-auto px-6 pb-8">
        {/* Persona selector */}
        <div className="mb-4 relative">
          <button
            onClick={() => setShowPersonaPicker(!showPersonaPicker)}
            className="flex items-center gap-3 w-full p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors text-left"
          >
            <span className={`text-2xl ${selectedPersona.color}`}>{selectedPersona.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">{selectedPersona.name}</div>
              <div className="text-xs text-muted-foreground truncate">{selectedPersona.description}</div>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showPersonaPicker ? "rotate-90" : ""}`} />
          </button>

          {showPersonaPicker && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-border/60 bg-card shadow-xl overflow-hidden">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPersona(p); setShowPersonaPicker(false) }}
                  className={`flex items-center gap-3 w-full p-3.5 text-left transition-colors hover:bg-muted/30 ${
                    selectedPersona.id === p.id ? "bg-muted/30" : ""
                  }`}
                >
                  <span className={`text-xl ${p.color}`}>{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.description}</div>
                  </div>
                  {selectedPersona.id === p.id && (
                    <div className="w-2 h-2 rounded-full bg-foreground/40" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scenario starters */}
        {messages.length === 0 && !isTyping && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start a Scenario</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedPersona.starters.map((starter, i) => (
                <button
                  key={i}
                  onClick={() => handleStarter(starter)}
                  className="text-left text-sm p-3.5 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-border/80 transition-all"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className="rounded-xl border border-border/50 bg-card min-h-[320px] max-h-[60vh] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground">
                <span className="text-4xl mb-3">{selectedPersona.emoji}</span>
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs mt-1">Pick a scenario or start typing below</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}
                >
                  {msg.role === "persona" && (
                    <span className={`text-lg shrink-0 mb-0.5 ${selectedPersona.color}`}>
                      {selectedPersona.emoji}
                    </span>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm max-w-[80%] leading-relaxed break-words ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start items-end gap-2">
                <span className={`text-lg shrink-0 mb-0.5 ${selectedPersona.color}`}>
                  {selectedPersona.emoji}
                </span>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-muted max-w-[80%]">
                  <span className="typing-dots" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          {messages.length > 0 && (
            <div className="flex items-center gap-2 border-t border-border/50 p-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${selectedPersona.name}...`}
                className="h-10 text-sm flex-1"
              />
              <Button
                size="icon"
                disabled={!input.trim() || isTyping}
                onClick={() => sendMessage(input)}
                className="shrink-0"
              >
                {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Typing animation styles */}
      <style jsx>{`
        .typing-dots {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .typing-dots::before,
        .typing-dots::after {
          content: "";
        }
        .typing-dots::before,
        .typing-dots::after,
        .typing-dots {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: hsl(var(--muted-foreground));
          animation: typingBounce 1.4s ease-in-out infinite;
        }
        .typing-dots::before {
          animation-delay: 0s;
        }
        .typing-dots {
          animation-delay: 0.2s;
        }
        .typing-dots::after {
          animation-delay: 0.4s;
        }
        @keyframes typingBounce {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  )
}
