import React from 'react';

export default function FlatCard({ flat, onEditClick, onPayClick }) {
  const isPaid = flat.maintenance_status === 'Paid';

  return (
    <div className="card h-100 shadow-sm border-0">
      <div className="card-body d-flex flex-column justify-content-between">
        <div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="card-title text-indigo fw-bold mb-0">Flat {flat.flat_no}</h5>
            <span className={`badge ${isPaid ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
              {flat.maintenance_status}
            </span>
          </div>
          <h6 className="card-subtitle mb-1 text-muted fw-semibold">{flat.owner_name}</h6>
          <p className="card-text text-secondary small mb-0">📞 {flat.contact_no}</p>
        </div>
        
        <div className="d-flex gap-2 mt-4">
          <button onClick={onEditClick} className="btn btn-outline-secondary btn-sm flex-grow-1">
            Edit
          </button>
          <button onClick={onPayClick} className="btn btn-primary btn-sm flex-grow-1">
            Collect
          </button>
        </div>
      </div>
    </div>
  );
}