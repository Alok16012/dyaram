import { useRef } from 'react'
import { usePackage } from '../context/PackageContext'
import DayCard from './DayCard'
import { CalendarDays, Map as MapIcon } from 'lucide-react'

export default function DayBuilder() {
  const { days, addDay } = usePackage()
  const listRef = useRef(null)

  const handleAddDay = () => {
    addDay()
    setTimeout(() => {
      listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }

  return (
    <div className="editor-main">
      <div className="editor-main-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={20} color="var(--primary)" /> Day-wise Itinerary</h2>
        <button className="btn btn-primary" onClick={handleAddDay}>+ Add Day</button>
      </div>

      <div className="days-list" ref={listRef}>
        {days.length === 0 ? (
          <div className="day-empty">
            <div className="day-empty-icon"><MapIcon size={36} strokeWidth={1.4} /></div>
            <h3>No days yet</h3>
            <p>Click "Add Day" to start building your itinerary</p>
          </div>
        ) : (
          days.map((day, idx) => (
            <DayCard key={day.id || `pending-${idx}`} day={day} idx={idx} />
          ))
        )}
      </div>
    </div>
  )
}
