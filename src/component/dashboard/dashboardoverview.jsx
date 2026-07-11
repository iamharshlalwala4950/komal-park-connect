import React from "react";

export default function DashboardOverview({ financialMetrics, uniquePaidMembersCount, totalFlats, cardClass }) {
    return (
        <div className="row g-3 mb-4" id="DashboardOverview">
            {/* 1. Current Balance Card */}
            <div className="col-12 col-sm-6 col-xl-3">
                <div className={`card h-100 ${cardClass}`}>
                    <div className="card-body d-flex align-items-center justify-content-between">
                        <div>
                            <h6 className="text-muted fw-semibold text-uppercase small mb-1">Current Balance</h6>
                            <h3 className={`fw-bold mb-0 ${financialMetrics.rollingBalance >= 0 ? "text-success" : "text-danger"}`}>
                                ₹ {financialMetrics.rollingBalance.toLocaleString("en-IN")}
                            </h3>
                            <small className="text-muted text-capitalize">Cumulative Timeline</small>
                        </div>
                        <div className="fs-1 text-success bg-success bg-opacity-10 p-3 rounded-circle">
                            <i className="fa-solid fa-wallet"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Monthly Collection Card */}
            <div className="col-12 col-sm-6 col-xl-3">
                <div className={`card h-100 ${cardClass}`}>
                    <div className="card-body d-flex align-items-center justify-content-between">
                        <div>
                            <h6 className="text-muted fw-semibold text-uppercase small mb-1">Monthly Collection</h6>
                            <h3 className="fw-bold mb-0 text-primary">
                                ₹ {financialMetrics.currentMonthCollection.toLocaleString("en-IN")}
                            </h3>
                        </div>
                        <div className="fs-1 text-primary bg-primary bg-opacity-10 p-3 rounded-circle">
                            <i className="fa-solid fa-scale-balanced"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Expenses Card */}
            <div className="col-12 col-sm-6 col-xl-3">
                <div className={`card h-100 ${cardClass}`}>
                    <div className="card-body d-flex align-items-center justify-content-between">
                        <div>
                            <h6 className="text-muted fw-semibold text-uppercase small mb-1">Expenses (Current Month)</h6>
                            <h3 className="fw-bold mb-0 text-danger">
                                ₹ {financialMetrics.currentMonthExpense.toLocaleString("en-IN")}
                            </h3>
                        </div>
                        <div className="fs-1 text-danger bg-danger bg-opacity-10 p-3 rounded-circle">
                            <i className="fa-solid fa-money-bill-transfer"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Paid Members Counter Card */}
            <div className="col-12 col-sm-6 col-xl-3">
                <div className={`card h-100 ${cardClass}`}>
                    <div className="card-body d-flex align-items-center justify-content-between">
                        <div>
                            <h6 className="text-muted fw-semibold text-uppercase small mb-1">Paid Members</h6>
                            <h3 className="fw-bold mb-0 text-info">
                                {uniquePaidMembersCount} / {totalFlats} Flats
                            </h3>
                        </div>
                        <div className="fs-1 text-info bg-info bg-opacity-10 p-3 rounded-circle">
                            <i className="fa-solid fa-square-check"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}