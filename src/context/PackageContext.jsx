import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react'
// Triggering fresh Vercel build with clean code
import { supabase, uploadPhoto, deletePhoto } from '../lib/supabase'
import { getSession } from '../lib/auth'
import toast from 'react-hot-toast'

const PackageContext = createContext(null)

const DEFAULT_PACKAGE = {
  id: null,
  title: '5 Nights 6 Days Kashmir Tour Package',
  sub_title: "Shera Travels — Let's Travel The World",
  nights: 5,
  days: 6,
  start_location: 'Srinagar, Jammu & Kashmir',
  hero_photo_url: null,
  inclusions: ['MAP (Room + Breakfast + Dinner)', 'Sightseeing', 'Transfers', 'Pickup & Drop', 'Private Cab', 'Accommodation', 'Shikara Ride Dal Lake'],
  exclusions: ['Personal Activities', 'Honeymoon Special Services'],
  tc_payment: '20% Advance of total booking amount.\nAirfare/Transport fare to be paid in full at one time in advance.',
  tc_cancel: 'Upon cancellation, refund will be made after deducting the Retention Amount.\nRetention Amount varies as per days left before package start date.\nRefund within 15 working days.',
  tc_notes: '',
  company_name: 'Shera Travels',
  company_addr: 'Radio Colony, Srinagar, Lawaypora, Srinagar, Jammu and Kashmir 190017',
  company_email: 'sheratravels21@gmail.com',
  company_phone: '+91-9149406965, 9858966518',
  company_gst: '01KODPS7232P1ZE',
}

const initialState = {
  packages: [],
  currentPackage: null,
  prices: [],
  days: [],
  library: [],
  loading: false,
  saving: false,
  saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved'
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PACKAGES': return { ...state, packages: action.payload }
    case 'SET_CURRENT_PACKAGE': return { ...state, currentPackage: action.payload }
    case 'UPDATE_PACKAGE_FIELD': return { ...state, currentPackage: { ...state.currentPackage, [action.field]: action.value } }
    case 'SET_PRICES': return { ...state, prices: action.payload }
    case 'SET_DAYS': return { ...state, days: action.payload }
    case 'SET_LIBRARY': return { ...state, library: action.payload }
    case 'SET_LOADING': return { ...state, loading: action.payload }
    case 'SET_SAVING': return { ...state, saving: action.payload, saveStatus: action.payload ? 'saving' : 'saved' }
    case 'SET_SAVE_STATUS': return { ...state, saveStatus: action.payload }
    default: return state
  }
}

export function PackageProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const saveTimerRef = useRef(null)
  const packagesLoadedRef = useRef(false)
  const libraryLoadedRef = useRef(false)

  // ── PACKAGES ──────────────────────────────
  // `force` re-fetches even if packages are already cached — the provider
  // persists state across route changes, so plain remounts (e.g. navigating
  // Home -> Itinerary -> Home) should reuse cached data instead of refetching.
  const fetchPackages = useCallback(async (force = false) => {
    if (packagesLoadedRef.current && !force) return
    dispatch({ type: 'SET_LOADING', payload: true })
    // Ownership scoping: admins see every itinerary; everyone else sees only
    // the ones they created (created_by = their user id).
    const session = getSession()
    // The list view only needs a handful of light columns. Selecting '*' here
    // pulled every column — including large base64 photo fields — bloating the
    // response to ~2.4MB for the whole table. Restricting to the columns the
    // Itinerary list and Home quote modal actually read drops it to ~12KB.
    const LIST_COLS = 'id, title, days, nights, start_location, created_by, client_name, inclusions, created_at'
    let query = supabase.from('packages').select(LIST_COLS).order('created_at', { ascending: false })
    if (session && !session.is_admin) {
      query = query.eq('created_by', session.id)
    }
    const { data, error } = await query
    if (!error) {
      dispatch({ type: 'SET_PACKAGES', payload: data || [] })
      packagesLoadedRef.current = true
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  const loadPackage = useCallback(async (id) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    const [pkgRes, pricesRes, daysRes] = await Promise.all([
      supabase.from('packages').select('*').eq('id', id).single(),
      supabase.from('prices').select('*').eq('package_id', id).order('sort_order'),
      supabase.from('days').select('*, day_photos(*)').eq('package_id', id).order('sort_order'),
    ])
    // Ownership guard: a non-admin must not open an itinerary created by
    // someone else, even via a direct /editor/:id URL.
    const session = getSession()
    const pkg = pkgRes.data
    if (!pkgRes.error && pkg && session && !session.is_admin && pkg.created_by && pkg.created_by !== session.id) {
      toast.error("You don't have access to this itinerary")
      dispatch({ type: 'SET_CURRENT_PACKAGE', payload: null })
      dispatch({ type: 'SET_LOADING', payload: false })
      return
    }
    if (!pkgRes.error) dispatch({ type: 'SET_CURRENT_PACKAGE', payload: pkgRes.data })
    if (!pricesRes.error) dispatch({ type: 'SET_PRICES', payload: pricesRes.data || [] })
    if (!daysRes.error) dispatch({ type: 'SET_DAYS', payload: daysRes.data || [] })
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  const createNewPackage = useCallback(async () => {
    // Use saved company defaults if available
    const savedCompany = localStorage.getItem('company_defaults')
    const company = savedCompany ? JSON.parse(savedCompany) : {}

    const newPkg = {
      ...DEFAULT_PACKAGE,
      company_name: company.name || DEFAULT_PACKAGE.company_name,
      company_addr: company.addr || DEFAULT_PACKAGE.company_addr,
      company_email: company.email || DEFAULT_PACKAGE.company_email,
      company_phone: company.phone || DEFAULT_PACKAGE.company_phone,
      company_gst: company.gst || DEFAULT_PACKAGE.company_gst,
    }

    const pkgToInsert = { ...newPkg }
    delete pkgToInsert.id           // Let DB generate UUID
    delete pkgToInsert.company_gst  // Exclude until DB column is confirmed

    // Stamp the creator so ownership scoping can filter itineraries per-user.
    const session = getSession()
    if (session?.id) pkgToInsert.created_by = session.id

    dispatch({ type: 'SET_SAVING', payload: true })
    const { data, error } = await supabase.from('packages').insert([pkgToInsert]).select().single()
    if (error) {
      console.error('Package create error:', error)
      toast.error('Failed to create package: ' + (error.message || 'Check Supabase connection'))
      dispatch({ type: 'SET_SAVING', payload: false })
      return null
    }

    // Store GST in the package state even if not in DB yet
    const fullPkg = { ...data, company_gst: newPkg.company_gst }
    dispatch({ type: 'SET_CURRENT_PACKAGE', payload: fullPkg })

    // Use saved price templates if available
    const savedTemplates = localStorage.getItem('price_templates')
    const priceRows = savedTemplates
      ? JSON.parse(savedTemplates)
      : [
          { pax_type: 'Adult', age_limit: 'Above 12 years', price: 17500 },
          { pax_type: 'Child', age_limit: '5–12 years', price: 8000 },
        ]
    await supabase.from('prices').insert(
      priceRows.map((r, i) => ({ package_id: data.id, ...r, sort_order: i }))
    )

    dispatch({ type: 'SET_SAVING', payload: false })
    return data.id
  }, [])

  const deletePackage = useCallback(async (id) => {
    const { error } = await supabase.from('packages').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return false }
    toast.success('Package deleted')
    return true
  }, [])

  // Deep-copy an itinerary: the package row plus its prices, days and each
  // day's photos, into a brand-new package owned by the current user. Returns
  // the new package id so the caller can open it in the editor.
  const duplicatePackage = useCallback(async (id) => {
    dispatch({ type: 'SET_SAVING', payload: true })
    try {
      const [pkgRes, pricesRes, daysRes] = await Promise.all([
        supabase.from('packages').select('*').eq('id', id).single(),
        supabase.from('prices').select('*').eq('package_id', id).order('sort_order'),
        supabase.from('days').select('*, day_photos(*)').eq('package_id', id).order('sort_order'),
      ])
      if (pkgRes.error || !pkgRes.data) throw pkgRes.error || new Error('Itinerary not found')

      const session = getSession()
      // created_by is a uuid column; some bootstrap/admin sessions carry a
      // non-uuid id, which the DB rejects. Only claim ownership when the id is
      // a real uuid, otherwise keep whatever the source itinerary had.
      const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '')

      // New package row: drop identity/timestamps, tag as a copy, set owner.
      const pkgRow = { ...pkgRes.data }
      delete pkgRow.id
      delete pkgRow.created_at
      delete pkgRow.updated_at
      pkgRow.title = `${pkgRes.data.title || 'Untitled'} (Copy)`
      pkgRow.created_by = isUuid(session?.id) ? session.id : (pkgRes.data.created_by || null)

      const { data: newPkg, error: insErr } = await supabase
        .from('packages').insert([pkgRow]).select().single()
      if (insErr) throw insErr

      // Copy prices
      const prices = pricesRes.data || []
      if (prices.length) {
        const priceRows = prices.map((p, i) => {
          const row = { ...p }
          delete row.id
          delete row.created_at
          row.package_id = newPkg.id
          row.sort_order = row.sort_order ?? i
          return row
        })
        const { error: priceErr } = await supabase.from('prices').insert(priceRows)
        if (priceErr) throw priceErr
      }

      // Copy days, then each day's photos (day_photos need the new day id).
      const days = daysRes.data || []
      for (const d of days) {
        const dayRow = { ...d }
        delete dayRow.id
        delete dayRow.created_at
        delete dayRow.day_photos
        dayRow.package_id = newPkg.id

        const { data: newDay, error: dayErr } = await supabase
          .from('days').insert([dayRow]).select().single()
        if (dayErr) throw dayErr

        const photos = d.day_photos || []
        if (photos.length && newDay) {
          const photoRows = photos.map(ph => {
            const row = { ...ph }
            delete row.id
            delete row.created_at
            row.day_id = newDay.id
            return row
          })
          const { error: photoErr } = await supabase.from('day_photos').insert(photoRows)
          if (photoErr) throw photoErr
        }
      }

      await fetchPackages(true)
      toast.success('Itinerary copied — you can edit it now')
      dispatch({ type: 'SET_SAVING', payload: false })
      return newPkg.id
    } catch (e) {
      console.error('Duplicate error:', e)
      toast.error('Copy failed: ' + (e.message || 'Check database connection'))
      dispatch({ type: 'SET_SAVING', payload: false })
      return null
    }
  }, [fetchPackages])

  // Reassign an itinerary to another user by moving its created_by ownership.
  const transferPackage = useCallback(async (id, newOwnerId) => {
    const { error } = await supabase.from('packages')
      .update({ created_by: newOwnerId || null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('Transfer error:', error)
      toast.error('Transfer failed: ' + (error.message || 'Check database connection'))
      return false
    }
    toast.success('Itinerary transferred')
    await fetchPackages(true)
    return true
  }, [fetchPackages])

  // ── AUTO-SAVE (debounced) ─────────────────
  const triggerSave = useCallback((pkg, prices, days) => {
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'unsaved' })
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveAll(pkg, prices, days), 1000)
  }, []) // eslint-disable-line

  const saveAll = useCallback(async (pkg, prices, days) => {
    if (!pkg?.id) return
    dispatch({ type: 'SET_SAVING', payload: true })
    try {
      // Update package (exclude id from body)
      const { id: _, ...pkgUpdates } = pkg
      const { error: pkgErr } = await supabase.from('packages').update({ ...pkgUpdates, updated_at: new Date().toISOString() }).eq('id', pkg.id)
      if (pkgErr) throw pkgErr

      // Upsert prices
      await Promise.all(prices.map(async (p, i) => {
        const { id: pid, ...pData } = p
        const payload = { ...pData, sort_order: i, package_id: pkg.id }
        if (pid) {
          const { error } = await supabase.from('prices').update(payload).eq('id', pid)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('prices').insert([payload]).select().single()
          if (error) throw error
          if (data) p.id = data.id
        }
      }))

      // Upsert days
      await Promise.all(days.map(async (d, i) => {
        const { id: did, day_photos: pendingPhotos, _open: __, ...dData } = d
        const payload = { ...dData, sort_order: i, package_id: pkg.id }
        if (did) {
          const { error } = await supabase.from('days').update(payload).eq('id', did)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('days').insert([payload]).select().single()
          if (error) throw error
          if (data) {
            d.id = data.id
            // Save any photos that were assigned before this day had a DB id
            const unsaved = (pendingPhotos || []).filter(ph => !ph.id)
            await Promise.all(unsaved.map(async (ph) => {
              const { data: pd } = await supabase.from('day_photos').insert([{
                day_id: data.id,
                photo_url: ph.photo_url,
                tag_name: ph.tag_name,
                tag_type: ph.tag_type,
                slot_index: ph.slot_index,
              }]).select().single()
              if (pd) ph.id = pd.id
            }))
          }
        }
      }))
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' })
    } catch (e) {
      console.error('Save error:', e)
      toast.error('Save failed: ' + (e.message || 'Check database connection'))
    }
    dispatch({ type: 'SET_SAVING', payload: false })
  }, [])

  // ── PACKAGE FIELD UPDATE ──────────────────
  const updateField = useCallback((field, value) => {
    dispatch({ type: 'UPDATE_PACKAGE_FIELD', field, value })
  }, [])

  // ── PRICES ──────────────────────────────
  const addPrice = useCallback(() => {
    dispatch({ type: 'SET_PRICES', payload: [...state.prices, { id: null, pax_type: '', age_limit: '', price: '' }] })
  }, [state.prices])

  const addPricePreset = useCallback((preset) => {
    const exists = state.prices.some(p => p.pax_type === preset.pax_type)
    if (exists) return
    dispatch({ type: 'SET_PRICES', payload: [...state.prices, { id: null, pax_type: preset.pax_type, age_limit: preset.age_limit, price: preset.price }] })
  }, [state.prices])

  const updatePrice = useCallback((idx, field, value) => {
    const updated = [...state.prices]
    updated[idx] = { ...updated[idx], [field]: value }
    dispatch({ type: 'SET_PRICES', payload: updated })
  }, [state.prices])

  const removePrice = useCallback(async (idx) => {
    const p = state.prices[idx]
    if (p?.id) await supabase.from('prices').delete().eq('id', p.id)
    const updated = [...state.prices]
    updated.splice(idx, 1)
    dispatch({ type: 'SET_PRICES', payload: updated })
  }, [state.prices])

  // ── DAYS ──────────────────────────────
  const addDay = useCallback(() => {
    const n = state.days.length + 1
    const newDay = {
      id: null,
      package_id: state.currentPackage?.id,
      day_number: n,
      title: `Day ${n}: `,
      description: '',
      distance: '',
      hotspots: [],
      themes: [],
      meals: ['Stay', 'Breakfast', 'Dinner'],
      accommodation: '',
      accom_star: 3,
      hotel_photo_url: null,
      sort_order: n - 1,
      day_photos: [],
      _open: true,
    }
    dispatch({ type: 'SET_DAYS', payload: [...state.days, newDay] })
  }, [state.days, state.currentPackage])

  const removeDay = useCallback(async (idx) => {
    const day = state.days[idx]
    if (day?.id) await supabase.from('days').delete().eq('id', day.id)
    const updated = [...state.days]
    updated.splice(idx, 1)
    dispatch({ type: 'SET_DAYS', payload: updated })
  }, [state.days])

  const updateDay = useCallback((idx, field, value) => {
    const updated = [...state.days]
    updated[idx] = { ...updated[idx], [field]: value }
    dispatch({ type: 'SET_DAYS', payload: updated })
  }, [state.days])

  const toggleDayOpen = useCallback((idx) => {
    const updated = [...state.days]
    updated[idx] = { ...updated[idx], _open: !updated[idx]._open }
    dispatch({ type: 'SET_DAYS', payload: updated })
  }, [state.days])

  const moveDay = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx == null || toIdx == null) return
    const updated = [...state.days]
    if (fromIdx < 0 || fromIdx >= updated.length || toIdx < 0 || toIdx >= updated.length) return
    const [moved] = updated.splice(fromIdx, 1)
    updated.splice(toIdx, 0, moved)
    dispatch({ type: 'SET_DAYS', payload: updated })
  }, [state.days])

  // ── PHOTO LIBRARY ─────────────────────
  const fetchLibrary = useCallback(async (force = false) => {
    if (libraryLoadedRef.current && !force) return
    const { data } = await supabase.from('photo_library').select('*').order('created_at', { ascending: false })
    dispatch({ type: 'SET_LIBRARY', payload: data || [] })
    libraryLoadedRef.current = true
  }, [])

  const uploadToLibrary = useCallback(async (file, tagType, tagName) => {
    try {
      const url = await uploadPhoto(file, 'library')
      const { data, error } = await supabase.from('photo_library').insert([{
        photo_url: url, file_name: file.name, tag_type: tagType, tag_name: tagName || 'Unnamed'
      }]).select().single()
      if (error) throw error
      dispatch({ type: 'SET_LIBRARY', payload: [data, ...state.library] })
    } catch (e) {
      const msg = e?.message || ''
      if (msg.includes('Storage full') || msg.includes('quota')) {
        toast.error('Storage full — images are too large. Try smaller photos.')
      } else if (msg.includes('bucket') || msg.includes('storage')) {
        toast.error('Storage bucket not found. Check your Supabase setup.')
      } else {
        toast.error('Upload failed: ' + (msg || 'Check your connection or Supabase credentials.'))
      }
    }
  }, [state.library])

  const deleteLibraryPhoto = useCallback(async (id, url) => {
    await deletePhoto(url)
    await supabase.from('photo_library').delete().eq('id', id)
    dispatch({ type: 'SET_LIBRARY', payload: state.library.filter(p => p.id !== id) })
  }, [state.library])

  // ── DAY PHOTOS ────────────────────────
  const setDayPhoto = useCallback(async (dayIdx, slotIdx, photo) => {
    const updated = [...state.days]
    const day = { ...updated[dayIdx] }
    const photos = [...(day.day_photos || [])]
    // Remove existing at slot
    const existing = photos.find(p => p.slot_index === slotIdx)
    if (existing?.id) {
      await supabase.from('day_photos').delete().eq('id', existing.id)
    }
    // Insert new
    let newPhoto = { ...photo, slot_index: slotIdx, day_id: day.id, id: null }
    if (day.id) {
      const { data, error } = await supabase.from('day_photos').insert([{
        day_id: day.id, 
        photo_url: photo.photo_url, 
        tag_name: photo.tag_name, 
        tag_type: photo.tag_type, 
        slot_index: slotIdx
      }]).select().single()
      if (error) {
        console.error('Photo insert error:', error)
        toast.error('Failed to save photo to DB')
      }
      if (data) newPhoto = data
    }
    const filtered = photos.filter(p => p.slot_index !== slotIdx)
    day.day_photos = [...filtered, newPhoto]
    updated[dayIdx] = day
    dispatch({ type: 'SET_DAYS', payload: updated })
  }, [state.days])

  const removeDayPhoto = useCallback(async (dayIdx, slotIdx) => {
    const updated = [...state.days]
    const day = { ...updated[dayIdx] }
    const photos = [...(day.day_photos || [])]
    const existing = photos.find(p => p.slot_index === slotIdx)
    if (existing?.id) await supabase.from('day_photos').delete().eq('id', existing.id)
    day.day_photos = photos.filter(p => p.slot_index !== slotIdx)
    updated[dayIdx] = day
    dispatch({ type: 'SET_DAYS', payload: updated })
  }, [state.days])

  const setHeroPhoto = useCallback(async (photo) => {
    dispatch({ type: 'UPDATE_PACKAGE_FIELD', field: 'hero_photo_url', value: photo.photo_url })
  }, [])

  const setHotelPhoto = useCallback(async (dayIdx, photo) => {
    const updated = [...state.days]
    updated[dayIdx] = { ...updated[dayIdx], hotel_photo_url: photo.photo_url }
    dispatch({ type: 'SET_DAYS', payload: updated })
  }, [state.days])

  return (
    <PackageContext.Provider value={{
      ...state,
      fetchPackages, loadPackage, createNewPackage, deletePackage, duplicatePackage, transferPackage,
      updateField, triggerSave, saveAll,
      addPrice, addPricePreset, updatePrice, removePrice,
      addDay, removeDay, updateDay, toggleDayOpen, moveDay,
      fetchLibrary, uploadToLibrary, deleteLibraryPhoto,
      setDayPhoto, removeDayPhoto, setHeroPhoto, setHotelPhoto,
    }}>
      {children}
    </PackageContext.Provider>
  )
}

export const usePackage = () => useContext(PackageContext)
