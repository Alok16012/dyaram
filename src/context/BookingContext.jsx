import { createContext, useContext, useReducer, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { sendNewBookingEmail, sendReceiptEmail } from '../lib/email'
import toast from 'react-hot-toast'

const BookingContext = createContext(null)

// ── Status config ──────────────────────────────────────────
export const BOOKING_STATUSES = [
  { id: 'confirmed',     label: 'Confirmed',     color: '#4F6EF7', bg: '#EEF2FF',  emoji: '✅' },
  { id: 'advance_paid',  label: 'Advance Paid',  color: '#10B981', bg: '#ECFDF5',  emoji: '💰' },
  { id: 'balance_due',   label: 'Balance Due',   color: '#F59E0B', bg: '#FFFBEB',  emoji: '⏳' },
  { id: 'fully_paid',    label: 'Fully Paid',    color: '#059669', bg: '#D1FAE5',  emoji: '🎉' },
  { id: 'completed',     label: 'Completed',     color: '#64748B', bg: '#F1F5F9',  emoji: '🏁' },
  { id: 'cancelled',     label: 'Cancelled',     color: '#EF4444', bg: '#FEE2E2',  emoji: '❌' },
]

// ── Booking ref generator ─────────────────────────────────
function genRef() {
  const yr  = new Date().getFullYear()
  const num = String(Math.floor(Math.random() * 9000) + 1000)
  return `ST-${yr}-${num}`
}

function warnUnconfigured() {
  toast.error('Supabase not configured. Go to Admin → Connect Cloud.')
}

// ── Reducer ───────────────────────────────────────────────
const initial = { bookings: [], currentBooking: null, payments: [], loading: false, saving: false }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_BOOKINGS':  return { ...state, bookings: action.payload }
    case 'ADD_BOOKING':   return { ...state, bookings: [action.payload, ...state.bookings] }
    case 'UPD_BOOKING':   return {
      ...state,
      bookings: state.bookings.map(b => b.id === action.payload.id ? action.payload : b),
      currentBooking: state.currentBooking?.id === action.payload.id ? action.payload : state.currentBooking,
    }
    case 'SET_CURRENT':   return { ...state, currentBooking: action.payload }
    case 'DEL_BOOKING':   return { ...state, bookings: state.bookings.filter(b => b.id !== action.payload) }
    case 'SET_PAYMENTS':  return { ...state, payments: action.payload }
    case 'ADD_PAYMENT':   return { ...state, payments: [action.payload, ...state.payments] }
    case 'SET_LOADING':   return { ...state, loading: action.payload }
    case 'SET_SAVING':    return { ...state, saving: action.payload }
    default: return state
  }
}

// ── Provider ──────────────────────────────────────────────
export function BookingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const bookingsLoadedRef = useRef(false)

  // ── Fetch all bookings ──────────────────────────────────
  // `force` re-fetches even if bookings are already cached — the provider
  // persists state across route changes, so plain remounts (e.g. navigating
  // Home -> Bookings -> Home) should reuse cached data instead of refetching.
  const fetchBookings = useCallback(async (force = false) => {
    if (bookingsLoadedRef.current && !force) return
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const { data, error } = await supabase
        .from('bookings').select('*').order('created_at', { ascending: false })
      if (error) throw error
      dispatch({ type: 'SET_BOOKINGS', payload: data || [] })
      bookingsLoadedRef.current = true
    } catch (err) {
      console.error('fetchBookings error:', err)
      if (isConfigured) toast.error(`Load failed: ${err.message || 'check RLS/schema'}`)
      dispatch({ type: 'SET_BOOKINGS', payload: [] })
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  // ── Fetch single booking ────────────────────────────────
  const fetchBooking = useCallback(async (id) => {
    // Clear stale booking first so previous booking doesn't flash on screen
    dispatch({ type: 'SET_CURRENT', payload: null })
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single()
      if (error) throw error
      dispatch({ type: 'SET_CURRENT', payload: data })
    } catch (err) {
      console.error('fetchBooking error:', err)
      if (isConfigured) toast.error(`Booking load failed: ${err.message || 'not found'}`)
      dispatch({ type: 'SET_CURRENT', payload: null })
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  // ── Fetch booking by public token (customer form) ───────
  const fetchBookingByToken = useCallback(async (token) => {
    try {
      const { data, error } = await supabase
        .from('bookings').select('*, packages(title, nights, days, company_name, company_phone)')
        .eq('booking_token', token).single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('fetchBookingByToken error:', err)
      return null
    }
  }, [])

  // ── Create booking ──────────────────────────────────────
  const createBooking = useCallback(async (formData) => {
    if (!isConfigured) { warnUnconfigured(); return null }
    dispatch({ type: 'SET_SAVING', payload: true })
    const advance = Math.round((formData.total_amount * (formData.advance_percent || 20)) / 100)
    const row = {
      ...formData,
      booking_ref: genRef(),
      advance_amount: advance,
      balance_amount: formData.total_amount - advance,
      paid_amount: 0,
      status: 'confirmed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    try {
      const { data, error } = await supabase.from('bookings').insert([row]).select().single()
      if (error) throw error
      dispatch({ type: 'ADD_BOOKING', payload: data })
      if (formData.lead_id) {
        try {
          await supabase.from('leads').update({ stage: 'advance_paid', updated_at: new Date().toISOString() }).eq('id', formData.lead_id)
        } catch (e) {
          console.warn('Could not update lead stage:', e)
        }
      }
      toast.success(`Booking ${data.booking_ref} created!`)
      // Fire-and-forget — send confirmation email to customer + admin
      sendNewBookingEmail(data).catch(err => console.warn('Booking email error:', err))
      return data
    } catch (err) {
      console.error('createBooking error:', err)
      toast.error(`Save failed: ${err.message || 'check RLS/schema'}`)
      throw err
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false })
    }
  }, [])

  // ── Update booking ──────────────────────────────────────
  const updateBooking = useCallback(async (id, changes) => {
    if (!isConfigured) { warnUnconfigured(); return null }
    const updated = { ...changes, updated_at: new Date().toISOString() }
    try {
      const { data, error } = await supabase.from('bookings').update(updated).eq('id', id).select().single()
      if (error) throw error
      dispatch({ type: 'UPD_BOOKING', payload: data })
      return data
    } catch (err) {
      console.error('updateBooking error:', err)
      toast.error(`Update failed: ${err.message || 'check RLS/schema'}`)
      throw err
    }
  }, [])

  // ── Delete booking ──────────────────────────────────────
  const deleteBooking = useCallback(async (id) => {
    if (!isConfigured) { warnUnconfigured(); return }
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id)
      if (error) throw error
      dispatch({ type: 'DEL_BOOKING', payload: id })
      toast.success('Booking deleted')
    } catch (err) {
      console.error('deleteBooking error:', err)
      toast.error(`Delete failed: ${err.message || 'check RLS/schema'}`)
    }
  }, [])

  // ── Fetch payments for a booking ────────────────────────
  const fetchPayments = useCallback(async (bookingId) => {
    try {
      const { data, error } = await supabase.from('payments').select('*').eq('booking_id', bookingId).order('created_at', { ascending: false })
      if (error) throw error
      dispatch({ type: 'SET_PAYMENTS', payload: data || [] })
    } catch (err) {
      console.error('fetchPayments error:', err)
      dispatch({ type: 'SET_PAYMENTS', payload: [] })
    }
  }, [])

  // ── Record payment (after Razorpay success) ─────────────
  const recordPayment = useCallback(async (bookingId, paymentData) => {
    if (!isConfigured) { warnUnconfigured(); return }
    const booking = state.bookings.find(b => b.id === bookingId)
    if (!booking) { toast.error('Booking not found'); return }

    const newPaid = (Number(booking.paid_amount) || 0) + Number(paymentData.amount)
    const newStatus = newPaid >= booking.total_amount ? 'fully_paid'
      : newPaid >= booking.advance_amount ? 'balance_due'
      : booking.status

    const payRow = {
      booking_id: bookingId,
      amount: paymentData.amount,
      type: paymentData.type || 'advance',
      method: paymentData.method || 'razorpay',
      razorpay_payment_id: paymentData.razorpay_payment_id || null,
      razorpay_order_id: paymentData.razorpay_order_id || null,
      status: 'success',
      notes: paymentData.notes || '',
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    try {
      const { data: pay, error } = await supabase.from('payments').insert([payRow]).select().single()
      if (error) throw error
      dispatch({ type: 'ADD_PAYMENT', payload: pay })
      await updateBooking(bookingId, { paid_amount: newPaid, status: newStatus })
      toast.success(`₹${Number(paymentData.amount).toLocaleString('en-IN')} payment recorded!`)

      // Auto-send receipt to customer + sheratravels21@gmail.com
      const newBalance    = Math.max(0, Number(booking.total_amount || 0) - newPaid)
      const updatedBooking = { ...booking, paid_amount: newPaid }
      sendReceiptEmail(updatedBooking, Number(paymentData.amount), newPaid, newBalance, payRow)
        .then(() => toast.success(booking.customer_email ? `Receipt sent to ${booking.customer_email}` : 'Receipt sent to admin', { duration: 3000 }))
        .catch(err => console.warn('Receipt email error:', err))
    } catch (err) {
      console.error('recordPayment error:', err)
      toast.error(`Payment failed: ${err.message || 'check RLS/schema'}`)
    }
  }, [state.bookings, updateBooking])

  // ── Update customer details from public form ─────────────
  const updateFromPublicForm = useCallback(async (token, formData) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('booking_token', token)
        .select().single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('updateFromPublicForm error:', err)
      toast.error(`Save failed: ${err.message || 'check RLS/schema'}`)
      return null
    }
  }, [])

  // ── Stats ────────────────────────────────────────────────
  const getBookingStats = useCallback(() => {
    const b = state.bookings
    const totalRevenue = b.reduce((s, x) => s + (Number(x.paid_amount) || 0), 0)
    const pendingBalance = b.reduce((s, x) => s + Math.max(0, (Number(x.total_amount) || 0) - (Number(x.paid_amount) || 0)), 0)
    return {
      total:          b.length,
      confirmed:      b.filter(x => x.status === 'confirmed').length,
      advance_paid:   b.filter(x => x.status === 'advance_paid').length,
      balance_due:    b.filter(x => x.status === 'balance_due').length,
      fully_paid:     b.filter(x => x.status === 'fully_paid').length,
      completed:      b.filter(x => x.status === 'completed').length,
      totalRevenue,
      pendingBalance,
    }
  }, [state.bookings])

  return (
    <BookingContext.Provider value={{
      ...state,
      fetchBookings, fetchBooking, fetchBookingByToken,
      createBooking, updateBooking, deleteBooking,
      fetchPayments, recordPayment,
      updateFromPublicForm,
      getBookingStats,
    }}>
      {children}
    </BookingContext.Provider>
  )
}

export const useBooking = () => useContext(BookingContext)
