import { useState } from 'react'
import InfoTab from './tabs/InfoTab'
import PhotosTab from './tabs/PhotosTab'
import PricingTab from './tabs/PricingTab'
import TCTab from './tabs/TCTab'

const TABS = [
  { id: 'info', label: 'Info', icon: '📋' },
  { id: 'photos', label: 'Photos', icon: '🖼' },
  { id: 'pricing', label: 'Pricing', icon: '💰' },
  { id: 'tc', label: 'T&C', icon: '📄' },
]

export default function Sidebar({ activeTab, onTabChange, className = '' }) {
  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-tabs">
        {TABS.map(t => (
          <div
            key={t.id}
            className={`stab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.icon} {t.label}
          </div>
        ))}
      </div>
      <div className="sidebar-body">
        <InfoTab active={activeTab === 'info'} />
        <PhotosTab active={activeTab === 'photos'} />
        <PricingTab active={activeTab === 'pricing'} />
        <TCTab active={activeTab === 'tc'} />
      </div>
    </aside>
  )
}
