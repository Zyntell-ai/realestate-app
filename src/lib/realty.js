// src/lib/realty.js
// ─── All Supabase + WhatsApp + Google Calendar helpers ───────────────────────
import { createClient } from '@supabase/supabase-js'

// ── Supabase client ──────────────────────────────────────────────────────────
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Agents ───────────────────────────────────────────────────────────────────
export const AGENTS = [
  { name: 'Rohan Mehta',      specialty: 'Residential Apartments', areas: ['Gachibowli', 'Kondapur', 'Madhapur'],     days: ['Mon','Tue','Wed','Thu','Fri'],      color: '#0369a1' },
  { name: 'Preethi Srinivas', specialty: 'Luxury Villas & Plots',  areas: ['Jubilee Hills', 'Banjara Hills'],        days: ['Mon','Wed','Fri','Sat'],            color: '#7c3aed' },
  { name: 'Aakash Verma',     specialty: 'Commercial Spaces',      areas: ['Hitec City', 'Madhapur', 'Nanakramguda'], days: ['Tue','Wed','Thu','Fri','Sat'],      color: '#0f766e' },
  { name: 'Divya Krishnan',   specialty: 'Budget Homes & Flats',   areas: ['Kukatpally', 'Miyapur', 'Bachupally'],   days: ['Mon','Tue','Thu','Fri','Sat'],      color: '#b45309' },
  { name: 'Sanjay Rao',       specialty: 'Plots & Land',           areas: ['Shadnagar', 'Shamshabad', 'Tukkuguda'],  days: ['Mon','Tue','Wed','Thu','Fri','Sat'], color: '#be185d' },
]

// ── Property types ────────────────────────────────────────────────────────────
export const PROPERTY_TYPES = [
  { id: 'apartment', label: 'Apartment / Flat',  emoji: '🏢' },
  { id: 'villa',     label: 'Villa / Bungalow',  emoji: '🏡' },
  { id: 'plot',      label: 'Plot / Land',        emoji: '🌿' },
  { id: 'commercial',label: 'Commercial / Office',emoji: '🏬' },
  { id: 'studio',    label: 'Studio / 1BHK',      emoji: '🛏️' },
]

// ── Time slots (property viewings — daytime) ──────────────────────────────────
export const TIME_SLOTS = [
  '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
]

// ─────────────────────────────────────────────────────────────────────────────
// VIEWINGS — CRUD
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all viewings (with optional filters) */
export async function getViewings({ agent, date, status, from, to, property_type } = {}) {
  let q = supabase
    .from('viewings')
    .select('*')
    .order('date', { ascending: false })
    .order('time_slot')
  if (agent)         q = q.eq('agent', agent)
  if (date)          q = q.eq('date', date)
  if (status)        q = q.eq('status', status)
  if (from)          q = q.gte('date', from)
  if (to)            q = q.lte('date', to)
  if (property_type) q = q.eq('property_type', property_type)
  const { data, error } = await q
  if (error) throw error
  return data
}

/** Create a new viewing */
export async function createViewing(payload) {
  const { data, error } = await supabase
    .from('viewings')
    .insert([payload])
    .select()
    .single()
  if (error) throw error
  return data
}

/** Update viewing status */
export async function updateViewingStatus(id, status) {
  const { error } = await supabase
    .from('viewings')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

/** Cancel viewing */
export async function cancelViewing(id) {
  return updateViewingStatus(id, 'cancelled')
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT AVAILABILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns available time slots for an agent on a date.
 * Cross-checks Supabase bookings + Google Calendar busy times.
 */
export async function getAvailableSlots(agent, date) {
  const { data: booked, error } = await supabase
    .from('viewings')
    .select('time_slot')
    .eq('agent', agent)
    .eq('date', date)
    .neq('status', 'cancelled')
  if (error) throw error

  const bookedSlots = new Set(booked.map(v => v.time_slot))
  const gcalBusy    = await getGCalBusySlots(date)

  return TIME_SLOTS.filter(slot => {
    if (bookedSlots.has(slot)) return false
    const slotTime = parseSlotTime(date, slot)
    return !gcalBusy.some(busy =>
      slotTime >= new Date(busy.start) && slotTime < new Date(busy.end)
    )
  })
}

/**
 * Check if an agent's entire day is fully booked.
 * Returns { isFull, bookedCount, maxSlots }
 */
export async function isDayFull(agent, date) {
  const { data: config } = await supabase
    .from('agent_config')
    .select('max_slots')
    .eq('agent', agent)
    .single()

  const maxSlots = config?.max_slots ?? TIME_SLOTS.length

  const { count } = await supabase
    .from('viewings')
    .select('id', { count: 'exact', head: true })
    .eq('agent', agent)
    .eq('date', date)
    .neq('status', 'cancelled')

  return { isFull: count >= maxSlots, bookedCount: count, maxSlots }
}

/**
 * Get all "full" days for a month.
 * Returns Set of "YYYY-MM-DD" strings where ALL agents are fully booked.
 */
export async function getFullDaysForMonth(year, month) {
  const from    = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to      = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  const { data } = await supabase
    .from('viewings')
    .select('agent, date')
    .gte('date', from)
    .lte('date', to)
    .neq('status', 'cancelled')

  const byDate = {}
  for (const v of data || []) {
    if (!byDate[v.date]) byDate[v.date] = {}
    byDate[v.date][v.agent] = (byDate[v.date][v.agent] || 0) + 1
  }

  const { data: configs } = await supabase.from('agent_config').select('*')
  const maxMap = {}
  for (const c of configs || []) maxMap[c.agent] = c.max_slots

  const fullDays = new Set()
  for (const [date, agentCounts] of Object.entries(byDate)) {
    const allFull = AGENTS.every(a => {
      const count = agentCounts[a.name] || 0
      const max   = maxMap[a.name] || TIME_SLOTS.length
      return count >= max
    })
    if (allFull) fullDays.add(date)
  }
  return fullDays
}

/** Dashboard stats */
export async function getDashboardStats() {
  const today      = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  const [
    { count: total },
    { count: todayCount },
    { count: monthCount },
    { data: propTypeData },
  ] = await Promise.all([
    supabase.from('viewings').select('id', { count: 'exact', head: true }).neq('status', 'cancelled'),
    supabase.from('viewings').select('id', { count: 'exact', head: true }).eq('date', today).neq('status', 'cancelled'),
    supabase.from('viewings').select('id', { count: 'exact', head: true }).gte('date', monthStart).neq('status', 'cancelled'),
    supabase.from('viewings').select('property_type').gte('date', monthStart).neq('status', 'cancelled'),
  ])

  // Most popular property type this month
  const typeCounts = {}
  for (const v of propTypeData || []) {
    typeCounts[v.property_type] = (typeCounts[v.property_type] || 0) + 1
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  return { total, today: todayCount, thisMonth: monthCount, topType }
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — Meta Business Cloud API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send WhatsApp confirmation using an approved Message Template.
 *
 * ONE-TIME SETUP (once template is approved, uncomment the components block):
 * 1. Go to business.facebook.com -> WhatsApp Manager -> Message Templates
 * 2. Create template:
 *    - Category : UTILITY
 *    - Name     : viewing_confirmation
 *    - Language : English
 *    - Body:
 *        Hello {{1}}! Your property viewing at PropNest Realty is confirmed.
 *        Agent: {{2}} | Date: {{3}} | Time: {{4}}
 *        Property: {{5}} | Ref ID: {{6}}
 *        Our agent will call you before the visit. Queries: +91 40 4567 8901
 * 3. Submit -> approved in minutes for UTILITY category
 */
export async function sendWhatsAppConfirmation(viewing) {
  const { client_name, phone, agent, date, time_slot, property_type, id } = viewing

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const toPhone = phone.replace(/\D/g, '').replace(/^0/, '91')

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toPhone,
          type: 'template',
          template: {
            // ── TESTING: using hello_world (no parameters needed) ──────────
            name: 'hello_world',
            language: { code: 'en_US' },

            // ── PRODUCTION: uncomment below + remove hello_world above ──────
            // name: 'viewing_confirmation',
            // language: { code: 'en' },
            // components: [
            //   {
            //     type: 'body',
            //     parameters: [
            //       { type: 'text', text: client_name },                          // {{1}}
            //       { type: 'text', text: agent },                                // {{2}}
            //       { type: 'text', text: formattedDate },                        // {{3}}
            //       { type: 'text', text: time_slot },                            // {{4}}
            //       { type: 'text', text: property_type },                        // {{5}}
            //       { type: 'text', text: id.slice(0, 8).toUpperCase() },         // {{6}}
            //     ],
            //   },
            // ],
          },
        }),
      }
    )

    const data = await res.json()
    if (data.error) {
      console.warn('WhatsApp error:', data.error.message)
      return false
    }

    await supabase.from('viewings').update({ whatsapp_sent: true }).eq('id', id)
    console.log('WhatsApp sent:', data.messages?.[0]?.id)
    return true

  } catch (e) {
    console.warn('WhatsApp send failed:', e)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE CALENDAR
// ─────────────────────────────────────────────────────────────────────────────

export async function getGCalBusySlots(date) {
  const apiKey = import.meta.env.VITE_GCAL_API_KEY
  const calId  = import.meta.env.VITE_GCAL_CALENDAR_ID
  if (!apiKey || !calId) return []

  const timeMin = new Date(date + 'T09:00:00+05:30').toISOString()
  const timeMax = new Date(date + 'T18:00:00+05:30').toISOString()

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/freeBusy?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeMin, timeMax, items: [{ id: calId }] }),
      }
    )
    const data = await res.json()
    return data.calendars?.[calId]?.busy ?? []
  } catch {
    return []
  }
}

export async function createGCalEvent(viewing) {
  const { client_name, agent, date, time_slot, property_type, area, id } = viewing
  const [time, period] = time_slot.split(' ')
  const [h, m] = time.split(':')
  let hour = parseInt(h)
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0

  const startISO = `${date}T${String(hour).padStart(2, '0')}:${m}:00`
  const endISO   = `${date}T${String(hour + 1).padStart(2, '0')}:${m}:00`

  try {
    const res = await fetch('https://propnest-backend.onrender.com/api/gcal-create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `${client_name} — Viewing (${property_type}) w/ ${agent}`,
        description: `Viewing ID: ${id}\nAgent: ${agent}\nClient: ${client_name}\nProperty: ${property_type}${area ? '\nArea: ' + area : ''}`,
        start: { dateTime: startISO, timeZone: 'Asia/Kolkata' },
        end:   { dateTime: endISO,   timeZone: 'Asia/Kolkata' },
      }),
    })
    if (res.ok) {
      const event = await res.json()
      await supabase.from('viewings').update({ gcal_event_id: event.id }).eq('id', id)
      return event.id
    }
  } catch (e) {
    console.warn('GCal event creation failed:', e)
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function parseSlotTime(date, slot) {
  const [time, period] = slot.split(' ')
  const [h, m] = time.split(':')
  let hour = parseInt(h)
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${m}:00+05:30`)
}
