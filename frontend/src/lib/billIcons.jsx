import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faBolt, faDroplet, faWifi } from '@fortawesome/free-solid-svg-icons';

export const BILL_TYPE_META = {
  rent: { label: 'Rent', icon: faHouse },
  electricity: { label: 'Electricity', icon: faBolt },
  water: { label: 'Water', icon: faDroplet },
  wifi: { label: 'Wifi', icon: faWifi },
};

export function BillIcon({ type, className = '' }) {
  const meta = BILL_TYPE_META[type];
  if (!meta) return null;
  return <FontAwesomeIcon icon={meta.icon} className={className} aria-hidden="true" />;
}
