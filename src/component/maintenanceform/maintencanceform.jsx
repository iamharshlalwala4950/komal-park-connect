import React, { useState } from 'react';

export default function MaintenanceForm({ flat, onClose, onPaymentComplete }) {
  const FIXED_MONTHLY_RATE = 2000;
  const [monthsCount, setMonthsCount] = useState(1);
  const [paymentMode, setPaymentMode] = useState('UPI');

  const totalAmount = FIXED_MONTHLY_RATE * monthsCount;

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Receipt Generated!\nFlat: ${flat.flat_no}\nAmount: ₹${totalAmount}\nDuration: ${monthsCount} Month(s)`);
    onPaymentComplete(flat.id);
  };

  return (
    <div className="modal d-block bg-dark bg-opacity-50" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">Collect Maintenance — Flat {flat.flat_no}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-medium">Select Duration</label>
                <select 
                  value={monthsCount} 
                  onChange={(e) => setMonthsCount(Number(e.target.value))}
                  className="form-select"
                >
                  <option value={1}>1 Month</option>
                  <option value={3}>3 Months (Quarterly Advance)</option>
                  <option value={6}>6 Months (Half-Yearly Advance)</option>
                  <option value={12}>12 Months (Yearly Advance)</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-medium">Payment Mode</label>
                <select 
                  value={paymentMode} 
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="form-select"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Cash">Cash</option>
                  <option value="Net Banking">Net Banking</option>
                </select>
              </div>

              {/* Bootstrap Info Box for Pre-Calculated State */}
              <div className="alert alert-primary text-center fw-bold mb-0" role="alert">
                Total Amount Due: ₹{totalAmount}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">Confirm & Print</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}