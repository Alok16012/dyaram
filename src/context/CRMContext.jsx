// @refresh reset
import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { getSession } from '../lib/auth'
import toast from 'react-hot-toast'

const CRMContext = createContext(null)

export const LEAD_STAGES = [
  { id: 'new_inquiry',   label: 'New Inquiry',       color: '#4F6EF7', bg: '#EEF2FF', emoji: '🆕' },
  { id: 'contacted',     label: 'Contacted',          color: '#6366F1', bg: '#F0F0FF', emoji: '📞' },
  { id: 'itinerary_sent',label: 'Itinerary Sent',     color: '#8B5CF6', bg: '#F5F3FF', emoji: '📋' },
  { id: 'negotiation',   label: 'Negotiation',        color: '#F59E0B', bg: '#FFFBEB', emoji: '💬' },
  { id: 'advance_paid',  label: 'Advance Paid',       color: '#10B981', bg: '#ECFDF5', emoji: '💰' },
  { id: 'documents',     label: 'Docs Collected',     color: '#14B8A6', bg: '#F0FDFA', emoji: '📄' },
  { id: 'trip_ongoing',  label: 'Trip Ongoing',       color: '#0EA5E9', bg: '#F0F9FF', emoji: '✈️' },
  { id: 'completed',     label: 'Completed',          color: '#059669', bg: '#D1FAE5', emoji: '✅' },
  { id: 'lost',           label: 'Lost',               color: '#EF4444', bg: '#FEF2F2', emoji: '❌' },
]

export const LEAD_SOURCES = [
  'WhatsApp', 'Phone Call', 'Walk-in',
  'Website', 'Referral', 'Social Media',
  'JustDial', 'Other',
]

const initialState = {
  leads:      [],
  loading:    false,
  saving:     false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LEADS':   return { ...state, leads: action.payload }
    case 'ADD_LEAD':    return { ...state, leads: [action.payload, ...state.leads] }
    case 'UPDATE_LEAD': return { ...state, leads: state.leads.map(l => l.id === action.payload.id ? action.payload : l) }
    case 'REMOVE_LEAD': return { ...state, leads: state.leads.filter(l => l.id !== action.payload) }
    case 'SET_LOADING': return { ...state, loading: action.payload }
    case 'SET_SAVING':  return { ...state, saving: action.payload }
    default: return state
  }
}

function warnUnconfigured() {
  toast.error('Supabase not configured. Go to Admin → Connect Cloud.')
}

export function CRMProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const leadsLoadedRef = useRef(false)

  // `force` re-fetches even if leads are already cached — pass true after
  // out-of-band changes. Otherwise we skip refetching on every remount
  // (e.g. navigating Home -> Leads -> Bookings -> Home) since the provider
  // already persists this data across route changes.
  const fetchLeads = useCallback(async (force = false) => {
    if (leadsLoadedRef.current && !force) return
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const { data, error } = await supabase
        .from('leads').select('*').order('created_at', { ascending: false })
      if (error) throw error
      dispatch({ type: 'SET_LEADS', payload: data || [] })
      leadsLoadedRef.current = true
    } catch (err) {
      console.error('fetchLeads error:', err)
      if (isConfigured) toast.error(`Load failed: ${err.message || 'check RLS/schema'}`)
      dispatch({ type: 'SET_LEADS', payload: [] })
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  // Sanitize form data before sending to Supabase —
  // empty strings break date/int/numeric columns
  const sanitizeLead = (data) => ({
    ...data,
    travel_date:  data.travel_date  || null,
    return_date:  data.return_date  || null,
    adults:       Number(data.adults)   || 1,
    children:     Number(data.children) || 0,
    infants:      Number(data.infants)  || 0,
    budget_min:   data.budget_min ? Number(data.budget_min) : null,
    budget_max:   data.budget_max ? Number(data.budget_max) : null,
    email:        data.email  || null,
    whatsapp:     data.whatsapp || null,
  })

  const addLead = useCallback(async (formData) => {
    if (!isConfigured) { warnUnconfigured(); return null }
    dispatch({ type: 'SET_SAVING', payload: true })
    const stage = formData.stage === 'new' ? 'new_inquiry' : formData.stage
    const session = getSession()
    const lead = {
      ...sanitizeLead(formData),
      id: crypto.randomUUID(),
      stage,
      // New leads default to whoever created them; can be reassigned later.
      assigned_to:   formData.assigned_to   || session?.id || null,
      assigned_name: formData.assigned_name || session?.full_name || session?.username || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    try {
      const { data, error } = await supabase.from('leads').insert([lead]).select().single()
      if (error) throw error
      const saved = data || lead
      dispatch({ type: 'ADD_LEAD', payload: saved })
      toast.success('Lead saved!')
      return saved
    } catch (err) {
      console.error('addLead error:', err)
      toast.error(`Save failed: ${err.message || 'check RLS/schema'}`)
      throw err
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false })
    }
  }, [])

  const updateLead = useCallback(async (id, changes) => {
    if (!isConfigured) { warnUnconfigured(); return null }
    const updated = { ...sanitizeLead(changes), updated_at: new Date().toISOString() }
    try {
      const { data, error } = await supabase.from('leads').update(updated).eq('id', id).select().single()
      if (error) throw error
      const merged = data || { ...state.leads.find(l => l.id === id), ...updated, id }
      dispatch({ type: 'UPDATE_LEAD', payload: merged })
      toast.success('Lead updated!')
      return merged
    } catch (err) {
      console.error('updateLead error:', err)
      toast.error(`Update failed: ${err.message || 'check RLS/schema'}`)
      throw err
    }
  }, [state.leads])

  // Reassign a lead to another user. Kept separate from updateLead because
  // updateLead runs sanitizeLead (which would reset pax/dates to defaults when
  // those fields aren't part of the change set).
  const transferLead = useCallback(async (id, assignedTo, assignedName) => {
    if (!isConfigured) { warnUnconfigured(); return null }
    try {
      const { data, error } = await supabase.from('leads')
        .update({ assigned_to: assignedTo || null, assigned_name: assignedName || null, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      const merged = data || { ...state.leads.find(l => l.id === id), assigned_to: assignedTo, assigned_name: assignedName }
      dispatch({ type: 'UPDATE_LEAD', payload: merged })
      toast.success(assignedName ? `Lead transferred to ${assignedName}` : 'Lead unassigned')
      return merged
    } catch (err) {
      console.error('transferLead error:', err)
      toast.error(`Transfer failed: ${err.message || 'check schema'}`)
      throw err
    }
  }, [state.leads])

  const changeStage = useCallback(async (leadId, newStage) => {
    const lead = state.leads.find(l => l.id === leadId)
    if (!lead || lead.stage === newStage) return
    const newStageLabel = LEAD_STAGES.find(s => s.id === newStage)?.label || newStage
    await updateLead(leadId, { stage: newStage })
    toast.success(`Stage: ${newStageLabel}`)
  }, [state.leads, updateLead])

  const deleteLead = useCallback(async (id) => {
    if (!isConfigured) { warnUnconfigured(); return }
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error
      dispatch({ type: 'REMOVE_LEAD', payload: id })
      toast.success('Lead deleted')
    } catch (err) {
      console.error('deleteLead error:', err)
      toast.error(`Delete failed: ${err.message || 'check RLS/schema'}`)
    }
  }, [])

  const getStats = useCallback(() => {
    const leads = state.leads
    const now = new Date()
    const thisMonth = leads.filter(l => {
      const d = new Date(l.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const active = leads.filter(l => !['completed', 'lost'].includes(l.stage))
    const hot    = leads.filter(l => l.stage === 'negotiation')
    const booked = leads.filter(l => ['advance_paid', 'documents', 'trip_ongoing', 'completed'].includes(l.stage))
    const stageDist = LEAD_STAGES.map(s => ({...s, count: leads.filter(l => l.stage === s.id).length}))
    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const label = d.toLocaleString('default', { month: 'short' })
      const count = leads.filter(l => {
        const ld = new Date(l.created_at)
        return ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear()
      }).length
      monthly.push({ label, count })
    }
    return { total: leads.length, thisMonth: thisMonth.length, active: active.length, hot: hot.length, booked: booked.length, stageDist, monthly }
  }, [state.leads])

  return (
    <CRMContext.Provider value={{
      ...state,
      fetchLeads, addLead, updateLead, changeStage, deleteLead, transferLead,
      getStats,
    }}>
      {children}
    </CRMContext.Provider>
  )
}

export const useCRM = () => useContext(CRMContext)
