// src/RealtyChatbot.jsx
// ─── Real Estate chatbot powered by Google Gemini API ────────────────────────
import { useState, useEffect, useRef } from "react";
import {
  AGENTS,
  PROPERTY_TYPES,
  getAvailableSlots,
  isDayFull,
  createViewing,
  sendWhatsAppConfirmation,
  createGCalEvent,
} from "./lib/realty";

// ─── Gemini system instruction ────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are Maya, the friendly and knowledgeable AI property advisor at PropNest Realty — a premium real estate agency based in Hyderabad, India.

AGENCY INFORMATION:
- Name: PropNest Realty
- Address: 3rd Floor, Icon Tower, Madhapur, Hyderabad - 500081
- Phone: +91 40 4567 8901 | WhatsApp: +91 98765 67890
- Email: hello@propnestrealty.in
- Office Hours: Monday-Saturday 9:00 AM - 7:00 PM | Sunday 10:00 AM - 4:00 PM

OUR AGENTS:
- Rohan Mehta (Residential Apartments) — Gachibowli, Kondapur, Madhapur — Mon-Fri
- Preethi Srinivas (Luxury Villas & Plots) — Jubilee Hills, Banjara Hills — Mon/Wed/Fri/Sat
- Aakash Verma (Commercial Spaces) — Hitec City, Madhapur, Nanakramguda — Tue-Sat
- Divya Krishnan (Budget Homes & Flats) — Kukatpally, Miyapur, Bachupally — Mon/Tue/Thu/Fri/Sat
- Sanjay Rao (Plots & Land) — Shadnagar, Shamshabad, Tukkuguda — Mon-Sat

PROPERTY TYPES WE HANDLE:
- Apartments & Flats (1BHK to 4BHK): ₹25L – ₹2.5Cr
- Luxury Villas & Bungalows: ₹1.5Cr – ₹15Cr
- Independent Houses: ₹60L – ₹3Cr
- Plots & Residential Land: ₹15L – ₹5Cr
- Commercial Shops & Offices: ₹30L – ₹10Cr
- Studio Apartments: ₹18L – ₹55L

POPULAR AREAS:
- Gachibowli: IT hub, excellent connectivity, ₹6,500-9,500/sqft
- Madhapur/Hitec City: Premium zone, ₹7,000-12,000/sqft
- Jubilee Hills: Elite residential, ₹8,000-18,000/sqft
- Banjara Hills: Prime location, ₹7,500-16,000/sqft
- Kondapur: Growing, affordable, ₹5,500-7,500/sqft
- Kukatpally: Budget-friendly, ₹4,500-6,000/sqft
- Miyapur/Bachupally: Emerging, value for money, ₹3,500-5,500/sqft

SERVICES:
- Free property valuations
- Home loan assistance (tie-ups with 12+ banks)
- Legal & documentation support
- Interior design referrals
- NRI property management

PROPERTY VIEWING BOOKING:
When a client wants to schedule a viewing, collect step by step:
1. Property type they're interested in
2. Preferred area / location
3. Budget range
4. Preferred agent (or we auto-assign based on property type)
5. Preferred date (ask them to type in YYYY-MM-DD format)
6. Preferred time slot
7. Full name
8. Phone number with country code (e.g. 919876543210)

RULES:
- Be warm, professional, and aspirational — like a trusted property advisor
- Use simple English; sprinkle in local Hyderabadi warmth
- Never make guarantees about property prices or returns
- Always say "subject to availability" for pricing
- Add relevant emojis to keep it engaging
- For legal queries, always recommend consulting a property lawyer
- Format lists with bullet points using the • symbol`;

// ─── Rule-based fallback engine ───────────────────────────────────────────────
const RULES = [
  {
    match: /hour|time|open|close|timing|office|when/i,
    reply: `🕐 *PropNest Realty Office Hours:*\n\n• Monday – Saturday: 9:00 AM – 7:00 PM\n• Sunday: 10:00 AM – 4:00 PM\n\nProperty viewings can be scheduled 7 days a week! 📅\nShall I help you **book a viewing**?`,
  },
  {
    match: /price|rate|sqft|sq\.?ft|cost|how much|budget|affordable|luxury|cheap/i,
    reply: `💰 *Current Market Rates (Hyderabad):*\n\n• Gachibowli: ₹6,500–9,500/sqft\n• Madhapur / Hitec City: ₹7,000–12,000/sqft\n• Jubilee Hills: ₹8,000–18,000/sqft\n• Banjara Hills: ₹7,500–16,000/sqft\n• Kondapur: ₹5,500–7,500/sqft\n• Kukatpally: ₹4,500–6,000/sqft\n• Miyapur / Bachupally: ₹3,500–5,500/sqft\n\n_Prices are indicative and subject to market conditions._\n\nWant to **schedule a viewing** to see properties in any of these areas? 🏠`,
  },
  {
    match: /agent|advisor|consultant|staff|team|who.*help|specialist/i,
    reply: `👨‍💼 *Our Property Experts:*\n\n• **Rohan Mehta** — Residential Apartments (Gachibowli, Kondapur, Madhapur)\n• **Preethi Srinivas** — Luxury Villas & Plots (Jubilee Hills, Banjara Hills)\n• **Aakash Verma** — Commercial Spaces (Hitec City, Madhapur)\n• **Divya Krishnan** — Budget Homes (Kukatpally, Miyapur, Bachupally)\n• **Sanjay Rao** — Plots & Land (Shadnagar, Shamshabad)\n\nAll our agents offer **free first consultations**! 🎯\nShall I help you **book a viewing**?`,
  },
  {
    match: /apartment|flat|bhk|1bhk|2bhk|3bhk|4bhk|residential/i,
    reply: `🏢 *Apartments & Flats:*\n\n• 1BHK: ₹18L – ₹65L\n• 2BHK: ₹35L – ₹1.2Cr\n• 3BHK: ₹60L – ₹2Cr\n• 4BHK: ₹1.2Cr – ₹2.5Cr\n\n*Popular Areas:* Gachibowli, Kondapur, Kukatpally, Madhapur\n\nOur specialist **Rohan Mehta** handles residential apartments.\nWant to **schedule a viewing**? 📅`,
  },
  {
    match: /villa|bungalow|luxury|independent house|row house/i,
    reply: `🏡 *Villas & Luxury Homes:*\n\n• Independent Villas: ₹1.5Cr – ₹15Cr\n• Row Houses: ₹80L – ₹2.5Cr\n• Independent Houses: ₹60L – ₹3Cr\n\n*Prime Locations:* Jubilee Hills, Banjara Hills, Kokapet\n\nOur luxury specialist **Preethi Srinivas** can assist you.\nShall I **book a viewing**? 🔑`,
  },
  {
    match: /plot|land|open land|layout|site|gated community/i,
    reply: `🌿 *Plots & Land:*\n\n• Residential Plots: ₹15L – ₹5Cr\n• HMDA / DTCP Approved layouts available\n• Gated community plots also available\n\n*Emerging Corridors:* Shadnagar, Shamshabad, Tukkuguda, Adibatla\n\n**Sanjay Rao** specialises in land & plots.\nWant to **schedule a site visit**? 📅`,
  },
  {
    match: /commercial|office|shop|showroom|retail|warehouse|co.?working/i,
    reply: `🏬 *Commercial Properties:*\n\n• Office Spaces: ₹30L – ₹10Cr\n• Retail Shops: ₹25L – ₹5Cr\n• Showrooms & Warehouses: ₹40L+\n• Co-working desks also available\n\n*Hot Zones:* Hitec City, Madhapur, Gachibowli, Nanakramguda\n\n**Aakash Verma** is our commercial expert.\nWant to **book a site visit**? 📅`,
  },
  {
    match: /loan|home loan|finance|emi|bank|mortgage|interest rate/i,
    reply: `🏦 *Home Loan Assistance:*\n\nWe have tie-ups with **12+ leading banks & NBFCs**:\n\n• SBI, HDFC, ICICI, Axis, Kotak\n• Interest rates from **8.5% p.a.** (subject to profile)\n• Up to **90% of property value** (for new properties)\n• Door-step documentation support\n• Pre-approval assistance\n\nThis service is **completely free** for PropNest clients! 💚\n\nFor a loan assessment, call us at **+91 40 4567 8901** 📞`,
  },
  {
    match: /legal|document|registration|stamp duty|sale deed|noc|ec|khata/i,
    reply: `📄 *Legal & Documentation:*\n\nWe provide end-to-end support:\n\n• Title deed & EC verification\n• Sale agreement drafting\n• Registration assistance\n• Khata transfer\n• NOC from banks\n\n_For legal advice, we always recommend consulting a licensed property lawyer._\n\nOur team can connect you with trusted legal partners 🤝\nCall: **+91 40 4567 8901**`,
  },
  {
    match: /service|offer|help|provide|what.*do|feature/i,
    reply: `🏆 *Our Services:*\n\n• 🏠 Property buying & selling\n• 🔑 Rental & leasing assistance\n• 📊 Free property valuations\n• 🏦 Home loan tie-ups (12+ banks)\n• 📄 Legal & documentation support\n• 🎨 Interior design referrals\n• 🌐 NRI property management\n• 📅 Site visits & viewings\n\nAll services are **transparent & professional**. No hidden charges! ✅`,
  },
  {
    match: /nri|non.?resident|abroad|overseas|invest/i,
    reply: `🌐 *NRI Property Services:*\n\n• FEMA-compliant property transactions\n• Power of Attorney assistance\n• Remote property management\n• Rental income collection & remittance\n• Repatriation guidance\n\nWe serve NRI clients across **USA, UK, UAE, Canada, Australia & Singapore**.\n\nCall: **+91 40 4567 8901** | WhatsApp: **+91 98765 67890** 📱`,
  },
  {
    match: /book|viewing|visit|schedule|appointment|site.*visit|view.*property/i,
    reply: null,
    action: "start_booking",
  },
  {
    match: /address|location|where|office|find|direction|map/i,
    reply: `📍 *PropNest Realty:*\n\n3rd Floor, Icon Tower\nMadhapur, Hyderabad – 500081\n\n📞 +91 40 4567 8901\n📱 WhatsApp: +91 98765 67890\n📧 hello@propnestrealty.in\n\n🚗 Free parking available in the complex`,
  },
  {
    match: /hi|hello|hey|good morning|good afternoon|good evening|namaste|hii/i,
    reply: `Namaste! Welcome to **PropNest Realty** 🏠\n\nI'm **Maya**, your AI property advisor. I'm here to help you find your dream property in Hyderabad!\n\n• 🏡 Book a property viewing\n• 💰 Know current market rates\n• 👨‍💼 Meet our agents\n• 🏦 Home loan guidance\n• 📄 Legal & documentation\n• 🌿 Explore plot options\n\nHow can I assist you today?`,
  },
  {
    match: /thank|thanks|great|awesome|perfect|wonderful|helpful/i,
    reply: `You're most welcome! 😊 Finding your dream property is our mission at PropNest.\n\nIs there anything else I can help you with?`,
  },
  {
    match: /cancel|reschedule|change.*viewing|modify.*appointment/i,
    reply: `To cancel or reschedule your viewing, please contact us:\n\n📞 **+91 40 4567 8901**\n📱 **WhatsApp: +91 98765 67890**\n\nPlease have your Ref ID handy. Our team will assist you immediately! 🙏`,
  },
];

function getRuleResponse(text) {
  for (const rule of RULES) {
    if (rule.match.test(text)) return rule;
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getTime = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const parseMarkdown = (text) =>
  text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^• /gm, '<span style="color:#1d4ed8;margin-right:3px">•</span>')
    .replace(/^(\d+)\. /gm, '<strong style="color:#1d4ed8">$1.</strong> ')
    .replace(/\n/g, "<br/>");

const QUICK_REPLIES = [
  { label: "🏠 Book Viewing", text: "I want to book a property viewing" },
  { label: "💰 Rates",        text: "What are the current market rates?" },
  { label: "🏢 Apartments",   text: "Tell me about apartments" },
  { label: "🏡 Villas",       text: "Tell me about villas and luxury homes" },
  { label: "🌿 Plots",        text: "I'm looking for plots or land" },
  { label: "🏦 Home Loan",    text: "Tell me about home loan assistance" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div className="chat-avatar bot-avatar">🏠</div>
      <div style={{
        padding: "14px 18px", borderRadius: 18, borderBottomLeftRadius: 4,
        display: "flex", gap: 5, alignItems: "center",
        background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      }}>
        {[0, 0.2, 0.4].map((d, i) => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#2563eb", display: "block",
            animation: `chatBounce 1.2s ${d}s infinite ease-in-out`,
          }} />
        ))}
      </div>
    </div>
  );
}

function BookingCard({ data }) {
  return (
    <div style={{
      background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
      border: "1.5px solid rgba(37,99,235,.25)",
      borderRadius: 16, padding: "16px 18px",
      fontSize: 13.5, lineHeight: 1.8, marginTop: 8, color: "#0f172a",
    }}>
      <div style={{ fontWeight: 700, color: "#1d4ed8", marginBottom: 12, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
        ✅ Viewing Scheduled!
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        <div>📋 <strong>Ref ID:</strong> {data.id}</div>
        <div>👤 <strong>Client:</strong> {data.client_name}</div>
        <div>🏠 <strong>Property Type:</strong> {data.property_type}</div>
        {data.area && <div>📍 <strong>Area:</strong> {data.area}</div>}
        <div>👨‍💼 <strong>Agent:</strong> {data.agent}</div>
        <div>📅 <strong>Date:</strong> {new Date(data.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        <div>🕐 <strong>Time:</strong> {data.time_slot}</div>
      </div>
      <div style={{
        marginTop: 12, padding: "8px 12px",
        background: "rgba(37,99,235,.08)", borderRadius: 10,
        fontSize: 12.5, color: "#1d4ed8",
      }}>
        📲 WhatsApp confirmation sent to {data.phone}
      </div>
    </div>
  );
}

function PropertyTypePicker({ onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, width: "100%" }}>
      {PROPERTY_TYPES.map((pt) => (
        <button key={pt.id} onClick={() => onSelect(pt.label)}
          className="prop-pick-btn"
          style={{
            textAlign: "left", padding: "10px 14px", borderRadius: 12,
            border: "1.5px solid #bfdbfe", background: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center",
            gap: 10, fontFamily: "'DM Sans',sans-serif", width: "100%",
            transition: "all .18s",
          }}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>{pt.emoji}</span>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{pt.label}</div>
        </button>
      ))}
    </div>
  );
}

function AgentPicker({ onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, width: "100%" }}>
      <button onClick={() => onSelect("Any available agent")}
        className="agent-pick-btn"
        style={{
          textAlign: "left", padding: "10px 14px", borderRadius: 12,
          border: "1.5px solid #bfdbfe", background: "#eff6ff",
          cursor: "pointer", display: "flex", alignItems: "center",
          gap: 10, fontFamily: "'DM Sans',sans-serif", width: "100%",
          transition: "all .18s",
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>⭐</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#1d4ed8" }}>Best Available Agent</div>
          <div style={{ fontSize: 11.5, color: "#3b82f6" }}>Auto-assigned based on your requirement</div>
        </div>
      </button>
      {AGENTS.map((agent) => (
        <button key={agent.name} onClick={() => onSelect(agent.name)}
          className="agent-pick-btn"
          style={{
            textAlign: "left", padding: "10px 14px", borderRadius: 12,
            border: "1.5px solid #bfdbfe", background: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center",
            gap: 10, fontFamily: "'DM Sans',sans-serif", width: "100%",
            transition: "all .18s",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: agent.color, display: "inline-block", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{agent.name}</div>
            <div style={{ fontSize: 11.5, color: "#64748b" }}>{agent.specialty} · {agent.areas.join(", ")}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function SlotPicker({ slots, onSelect }) {
  const morning = slots.filter(s => s.includes("AM"));
  const afternoon = slots.filter(s => s.includes("PM"));

  const renderGroup = (list, label) =>
    list.length > 0 && (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {list.map((slot) => (
            <button key={slot} onClick={() => onSelect(slot)}
              className="slot-btn"
              style={{
                padding: "7px 13px", borderRadius: 10,
                border: "1.5px solid #bfdbfe", background: "#fff",
                color: "#1d4ed8", fontWeight: 600, fontSize: 12.5,
                cursor: "pointer", transition: "all .18s",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              🕐 {slot}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
      {renderGroup(morning,   "🌅 Morning")}
      {renderGroup(afternoon, "☀️ Afternoon")}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RealtyChatbot() {
  const [messages,      setMessages]      = useState([]);
  const [geminiHistory, setGeminiHistory] = useState([]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [bookingCard,   setBookingCard]   = useState(null);
  const [bookingFlow,   setBookingFlow]   = useState(null);
  const [availSlots,    setAvailSlots]    = useState([]);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  const hasGeminiKey = !!(import.meta.env.VITE_GEMINI_API_KEY);

  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: `Namaste! I'm **Maya**, your AI property advisor at **PropNest Realty** 🏠\n\nLet me help you find your dream property in Hyderabad!\n\n• 🏡 Schedule a property viewing\n• 💰 Current market rates\n• 👨‍💼 Meet our expert agents\n• 🏦 Home loan assistance\n• 📄 Legal & documentation help\n\nHow can I assist you today?`,
      time: getTime(),
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, bookingCard]);

  const addBotMessage = (content, extra = {}) => {
    setMessages((prev) => [...prev, { role: "assistant", content, time: getTime(), ...extra }]);
  };

  // ─── Booking flow ──────────────────────────────────────────────────────────
  const handleBookingStep = async (userText) => {
    const flow = bookingFlow;

    if (flow.step === "property_type") {
      const match = PROPERTY_TYPES.find(pt =>
        pt.label.toLowerCase().includes(userText.toLowerCase()) ||
        pt.id.toLowerCase().includes(userText.toLowerCase()) ||
        userText.toLowerCase().includes(pt.id)
      ) || (userText.length > 2 ? { label: userText.trim() } : null);

      if (!match) {
        addBotMessage("Please select the type of property you're interested in 👇", { widget: "property_type_picker" });
        return;
      }
      setBookingFlow({ step: "area", data: { ...flow.data, property_type: match.label } });
      addBotMessage(`Great choice! **${match.label}** ✅\n\nWhich area or locality are you interested in?\n\nPopular areas: Gachibowli, Madhapur, Jubilee Hills, Banjara Hills, Kondapur, Kukatpally, Miyapur, or type any other area 📍`);
      return;
    }

    if (flow.step === "area") {
      if (userText.trim().length < 2) {
        addBotMessage("Please enter a preferred area or locality 📍");
        return;
      }
      setBookingFlow({ step: "budget", data: { ...flow.data, area: userText.trim() } });
      addBotMessage(`📍 **${userText.trim()}** — excellent area!\n\nWhat is your approximate budget?\n\nExample: **50 lakhs**, **1.5 crore**, **2Cr**, etc. 💰`);
      return;
    }

    if (flow.step === "budget") {
      if (userText.trim().length < 2) {
        addBotMessage("Please enter your budget (e.g. **80 lakhs** or **1.5 crore**) 💰");
        return;
      }
      setBookingFlow({ step: "agent", data: { ...flow.data, budget: userText.trim() } });
      addBotMessage(`💰 **${userText.trim()}** noted!\n\nWould you like a specific agent, or should we assign the best one for your requirement? 👇`, { widget: "agent_picker" });
      return;
    }

    if (flow.step === "agent") {
      let agentName;
      if (/any|auto|assign|best|available/i.test(userText)) {
        // Auto-assign based on property type
        const pt = flow.data.property_type?.toLowerCase() || "";
        if (pt.includes("villa") || pt.includes("luxury")) agentName = "Preethi Srinivas";
        else if (pt.includes("commercial") || pt.includes("office")) agentName = "Aakash Verma";
        else if (pt.includes("plot") || pt.includes("land")) agentName = "Sanjay Rao";
        else if (pt.includes("budget") || pt.includes("studio") || pt.includes("1bhk")) agentName = "Divya Krishnan";
        else agentName = "Rohan Mehta";
      } else {
        const match = AGENTS.find(a =>
          a.name.toLowerCase().includes(userText.toLowerCase()) ||
          a.specialty.toLowerCase().includes(userText.toLowerCase())
        );
        if (!match) {
          addBotMessage("Please choose an agent from the options below 👇", { widget: "agent_picker" });
          return;
        }
        agentName = match.name;
      }
      setBookingFlow({ step: "date", data: { ...flow.data, agent: agentName } });
      const agent = AGENTS.find(a => a.name === agentName);
      addBotMessage(`👨‍💼 **${agentName}** (${agent?.specialty || "Property Expert"}) will be your agent!\n\nWhat date would you like for the viewing? 📅\nFormat: **YYYY-MM-DD** (e.g., 2025-06-15)`);
      return;
    }

    if (flow.step === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(userText.trim())) {
        addBotMessage("Please use the format **YYYY-MM-DD**\nExample: **2025-06-15** 📅");
        return;
      }
      setLoading(true);
      try {
        const { isFull } = await isDayFull(flow.data.agent, userText.trim());
        if (isFull) {
          addBotMessage(`❌ **${flow.data.agent}** is fully booked on **${userText.trim()}**.\n\nPlease try another date 📅`);
          setLoading(false);
          return;
        }
        const slots = await getAvailableSlots(flow.data.agent, userText.trim());
        if (!slots.length) {
          addBotMessage(`😔 No slots available on **${userText.trim()}** for **${flow.data.agent}**.\n\nPlease try another date.`);
          setLoading(false);
          return;
        }
        setAvailSlots(slots);
        setBookingFlow({ step: "slot", data: { ...flow.data, date: userText.trim() } });
        addBotMessage(`✅ **${slots.length} slot${slots.length !== 1 ? "s" : ""} available!** Pick your preferred time 👇`, { widget: "slot_picker", slots });
      } catch {
        addBotMessage("Couldn't check availability. Please call **+91 40 4567 8901** 📞");
        setBookingFlow(null);
      }
      setLoading(false);
      return;
    }

    if (flow.step === "slot") {
      const slotMatch = availSlots.find(s => s.toLowerCase() === userText.toLowerCase().trim());
      if (!slotMatch) {
        addBotMessage("Please pick a time from the options above 👆", { widget: "slot_picker", slots: availSlots });
        return;
      }
      setBookingFlow({ step: "name", data: { ...flow.data, time_slot: slotMatch } });
      addBotMessage(`🕐 **${slotMatch}** selected!\n\nWhat is your **full name**? 👤`);
      return;
    }

    if (flow.step === "name") {
      if (userText.trim().length < 2) { addBotMessage("Please enter your full name 👤"); return; }
      setBookingFlow({ step: "phone", data: { ...flow.data, client_name: userText.trim() } });
      addBotMessage(`Thanks, **${userText.trim()}**! 😊\n\nPlease share your **WhatsApp number** with country code:\n📱 Example: **919876543210**`);
      return;
    }

    if (flow.step === "phone") {
      const phone = userText.replace(/\s/g, "");
      if (phone.length < 10) { addBotMessage("Please enter a valid phone number.\nExample: **919876543210** 📱"); return; }
      const { data } = flow;
      setBookingFlow({ step: "confirm", data: { ...data, phone } });
      addBotMessage(
        `Please confirm your viewing appointment:\n\n` +
        `👤 **Name:** ${data.client_name}\n` +
        `🏠 **Property:** ${data.property_type}\n` +
        `📍 **Area:** ${data.area}\n` +
        `💰 **Budget:** ${data.budget}\n` +
        `👨‍💼 **Agent:** ${data.agent}\n` +
        `📅 **Date:** ${new Date(data.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}\n` +
        `🕐 **Time:** ${data.time_slot}\n` +
        `📱 **Phone:** ${phone}\n\n` +
        `Type **YES** to confirm or **NO** to cancel.`
      );
      return;
    }

    if (flow.step === "confirm") {
      if (/yes|confirm|ok|sure|book|proceed/i.test(userText.trim())) {
        setLoading(true);
        try {
          const viewing = await createViewing({ ...flow.data, status: "scheduled" });
          sendWhatsAppConfirmation(viewing).catch(console.warn);
          createGCalEvent(viewing).catch(console.warn);
          setBookingCard({ ...flow.data, id: viewing.id.slice(0, 8).toUpperCase() });
          addBotMessage(`Your viewing is scheduled! 🎉\n\nA WhatsApp confirmation has been sent to **${flow.data.phone}**.\n\n**${flow.data.agent}** will call you before the visit to share property details. See you soon! 🏠`);
        } catch {
          addBotMessage("Booking failed. Please call **+91 40 4567 8901** 📞");
        }
        setBookingFlow(null);
        setLoading(false);
      } else {
        setBookingFlow(null);
        addBotMessage("Viewing cancelled. Feel free to start over anytime! 😊");
      }
    }
  };

  // ─── Main send ─────────────────────────────────────────────────────────────
  const send = async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setBookingCard(null);
    setMessages((prev) => [...prev, { role: "user", content: msg, time: getTime() }]);

    if (bookingFlow) { await handleBookingStep(msg); return; }

    setLoading(true);

    if (hasGeminiKey) {
      const newHistory = [...geminiHistory, { role: "user", parts: [{ text: msg }] }];
      const ok = await callGemini(newHistory, msg);
      if (ok) return;
    }

    await new Promise((r) => setTimeout(r, 600));
    const rule = getRuleResponse(msg);
    if (rule?.action === "start_booking") {
      setBookingFlow({ step: "property_type", data: {} });
      addBotMessage("Sure! Let's schedule your property viewing 🏠\n\nWhat type of property are you looking for? 👇", { widget: "property_type_picker" });
    } else if (rule) {
      addBotMessage(rule.reply);
    } else {
      addBotMessage(`I can help you with:\n\n• 🏠 Book a property viewing\n• 💰 Market rates & pricing\n• 👨‍💼 Our agents & specialties\n• 🏦 Home loan assistance\n• 📄 Legal support\n\nOr call us: **+91 40 4567 8901** 😊`);
    }
    setLoading(false);
  };

  const callGemini = async (history, originalMsg) => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: history,
          generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
        }),
      });

      const data = await res.json();

      if (data.error) {
        console.warn("Gemini API error:", data.error.message);
        setLoading(false);
        const rule = getRuleResponse(originalMsg);
        if (rule?.action === "start_booking") {
          setBookingFlow({ step: "property_type", data: {} });
          addBotMessage("Sure! Let's schedule your viewing 🏠\n\nWhat type of property are you looking for? 👇", { widget: "property_type_picker" });
        } else if (rule) {
          addBotMessage(rule.reply);
        } else {
          addBotMessage("I can help with viewings, market rates, agents, loans & legal support. What would you like to know? 😊");
        }
        return true;
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I didn't catch that. Could you please rephrase? 😊";
      setGeminiHistory([...history, { role: "model", parts: [{ text: reply }] }]);

      if (/schedule.*viewing|book.*viewing|property.*viewing/i.test(reply) && !bookingFlow) {
        setBookingFlow({ step: "property_type", data: {} });
        addBotMessage(reply + "\n\nWhat type of property are you looking for? 👇", { widget: "property_type_picker" });
      } else {
        addBotMessage(reply);
      }

      setLoading(false);
      return true;
    } catch (err) {
      console.error("Gemini call failed:", err);
      setLoading(false);
      return false;
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };
  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
  };

  const canSend = input.trim() && !loading;

  return (
    <>
      <style>{`
        .chatbot-page {
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 20px 16px 24px;
          background: linear-gradient(160deg, #eff6ff 0%, #dbeafe 50%, #e0f2fe 100%);
          min-height: calc(100dvh - 56px);
        }
        @media (max-width: 600px) {
          .chatbot-page { padding: 0; align-items: stretch; background: #f8faff; }
        }

        .chatbot-container {
          width: 100%;
          max-width: 480px;
          height: 760px;
          max-height: calc(100dvh - 56px - 40px);
          border-radius: 28px;
          background: #fff;
          box-shadow: 0 8px 48px rgba(37,99,235,.14), 0 2px 0 #bfdbfe;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: chatRise .55s cubic-bezier(.22,1,.36,1) both;
          font-family: 'DM Sans', sans-serif;
          border: 1px solid rgba(37,99,235,.1);
        }
        @media (max-width: 600px) {
          .chatbot-container {
            max-width: 100%; height: calc(100dvh - 56px);
            max-height: none; border-radius: 0;
            box-shadow: none; border: none; animation: none;
          }
        }

        .chat-msgs {
          flex: 1; overflow-y: auto; padding: 20px 16px 12px;
          display: flex; flex-direction: column; gap: 14px;
          background: #f8faff; scroll-behavior: smooth;
        }
        @media (max-width: 600px) { .chat-msgs { padding: 16px 12px 10px; } }

        .chat-avatar {
          width: 32px; height: 32px; border-radius: 10px;
          flex-shrink: 0; margin-top: 2px;
          display: flex; align-items: center; justify-content: center; font-size: 15px;
        }
        .user-avatar { background: #1d4ed8; }
        .bot-avatar  { background: #bfdbfe; }

        .chat-bubble {
          padding: 11px 14px; border-radius: 18px;
          font-size: 14px; line-height: 1.6;
          max-width: 80%; word-break: break-word;
        }
        .user-bubble {
          background: #1d4ed8; color: #fff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 12px rgba(29,78,216,.2);
        }
        .bot-bubble {
          background: #fff; color: #0f172a;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 12px rgba(0,0,0,.06);
        }

        .msg-row { display: flex; gap: 8px; animation: chatFadeUp .3s ease both; }
        .msg-row.user { flex-direction: row-reverse; }

        .msg-col { display: flex; flex-direction: column; max-width: 84%; }
        .msg-col.user { align-items: flex-end; }
        .msg-col.bot  { align-items: flex-start; }

        .msg-time { font-size: 10.5px; margin-top: 4px; padding: 0 4px; }
        .user .msg-time { color: rgba(0,0,0,.3); }
        .bot .msg-time  { color: #3b82f6; }

        .qr-bar {
          display: flex; gap: 6px; padding: 6px 14px 8px;
          background: #f8faff; overflow-x: auto; flex-shrink: 0;
          scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .qr-bar::-webkit-scrollbar { display: none; }

        .qr-btn {
          border: 1.5px solid #bfdbfe; background: #fff; color: #1d4ed8;
          font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 500;
          padding: 7px 13px; border-radius: 20px; cursor: pointer;
          transition: all .18s; white-space: nowrap; flex-shrink: 0;
        }
        .qr-btn:hover:not(:disabled) {
          background: #1d4ed8; color: #fff; border-color: #1d4ed8;
          transform: translateY(-1px);
        }
        .qr-btn:disabled { opacity: .55; cursor: not-allowed; }

        .chat-input-area {
          padding: 12px 14px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          background: #fff; border-top: 1px solid #bfdbfe;
          display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
        }
        .chat-input-wrap {
          flex: 1; background: #f8faff; border: 1.5px solid #bfdbfe;
          border-radius: 18px; padding: 9px 14px;
          display: flex; align-items: center; transition: border-color .18s;
        }
        .chat-input-wrap:focus-within { border-color: #1d4ed8; background: #fff; }

        .chat-textarea {
          flex: 1; border: none; background: transparent;
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #0f172a;
          resize: none; outline: none; max-height: 80px; line-height: 1.45;
        }
        .chat-textarea::placeholder { color: #93c5fd; }

        .send-btn {
          width: 44px; height: 44px; border-radius: 14px; border: none;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all .2s; outline: none;
        }
        .send-btn:hover:not(:disabled) { transform: scale(1.06); }
        .send-btn:disabled { cursor: not-allowed; }

        .prop-pick-btn:hover, .agent-pick-btn:hover {
          background: #eff6ff !important; border-color: #1d4ed8 !important;
        }
        .slot-btn:hover { background: #1d4ed8 !important; color: #fff !important; }

        @keyframes chatRise    { from{opacity:0;transform:translateY(24px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes chatFadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes chatBounce  { 0%,80%,100%{transform:translateY(0);opacity:.5} 40%{transform:translateY(-6px);opacity:1} }
        @keyframes chatPulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.8)} }
      `}</style>

      <div className="chatbot-page">
        <div className="chatbot-container">

          {/* ── HEADER ── */}
          <div style={{
            background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
            padding: "20px 22px 18px",
            display: "flex", alignItems: "center", gap: 14,
            flexShrink: 0, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position:"absolute", width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,.06)", top:-60, right:-40, pointerEvents:"none" }} />
            <div style={{ position:"absolute", width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,.04)", bottom:-50, left:60, pointerEvents:"none" }} />

            <div style={{
              width: 50, height: 50, borderRadius: 16,
              background: "rgba(255,255,255,.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, flexShrink: 0,
              border: "1.5px solid rgba(255,255,255,.3)",
              boxShadow: "0 4px 12px rgba(0,0,0,.12)",
            }}>🏠</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Serif Display',serif", color: "#fff", fontSize: 17, letterSpacing: "-.2px" }}>
                PropNest Realty
              </div>
              <div style={{ color: "rgba(255,255,255,.72)", fontSize: 12, marginTop: 2 }}>
                Madhapur, Hyderabad
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#7fffd4", boxShadow: "0 0 6px #7fffd4",
                  animation: "chatPulse 2s infinite", display: "inline-block",
                }} />
                <span style={{ color: "rgba(255,255,255,.82)", fontSize: 11.5, fontWeight: 500 }}>
                  Maya — AI Property Advisor {hasGeminiKey ? "✨" : "(Demo)"}
                </span>
              </div>
            </div>

            <div style={{
              background: "rgba(255,255,255,.18)",
              border: "1px solid rgba(255,255,255,.28)",
              color: "#fff", fontSize: 11, fontWeight: 700,
              padding: "4px 10px", borderRadius: 20, flexShrink: 0,
              letterSpacing: ".5px",
            }}>Mon–Sun</div>
          </div>

          {/* ── MESSAGES ── */}
          <div className="chat-msgs">
            {messages.map((msg, i) => (
              <div key={i} className={`msg-row ${msg.role === "user" ? "user" : "bot"}`}>
                <div className={`chat-avatar ${msg.role === "user" ? "user-avatar" : "bot-avatar"}`}>
                  {msg.role === "user" ? "👤" : "🏠"}
                </div>
                <div className={`msg-col ${msg.role === "user" ? "user" : "bot"}`}>
                  <div
                    className={`chat-bubble ${msg.role === "user" ? "user-bubble" : "bot-bubble"}`}
                    dangerouslySetInnerHTML={{
                      __html: msg.role === "user"
                        ? msg.content.replace(/</g, "&lt;")
                        : parseMarkdown(msg.content),
                    }}
                  />
                  {msg.widget === "property_type_picker" && <PropertyTypePicker onSelect={(pt) => send(pt)} />}
                  {msg.widget === "agent_picker"         && <AgentPicker onSelect={(name) => send(name)} />}
                  {msg.widget === "slot_picker"          && <SlotPicker slots={msg.slots?.length ? msg.slots : availSlots} onSelect={(s) => send(s)} />}
                  <div className="msg-time">
                    {msg.role === "user" ? msg.time : `Maya · ${msg.time}`}
                  </div>
                  {bookingCard && i === messages.length - 1 && msg.role === "assistant" && (
                    <BookingCard data={bookingCard} />
                  )}
                </div>
              </div>
            ))}
            {loading && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* ── QUICK REPLIES ── */}
          {!bookingFlow && (
            <div className="qr-bar">
              {QUICK_REPLIES.map((qr) => (
                <button key={qr.text} className="qr-btn" onClick={() => send(qr.text)} disabled={loading}>
                  {qr.label}
                </button>
              ))}
            </div>
          )}

          {/* ── INPUT ── */}
          <div className="chat-input-area">
            <div className="chat-input-wrap">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(e); }}
                onKeyDown={handleKey}
                placeholder={bookingFlow ? "Type your answer…" : "Ask about properties…"}
                rows={1}
              />
            </div>
            <button
              className="send-btn"
              onClick={() => send(input)}
              disabled={!canSend}
              style={{ background: canSend ? "#1d4ed8" : "#bfdbfe" }}
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
