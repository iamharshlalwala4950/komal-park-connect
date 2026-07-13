import React, { useState, useEffect, useCallback } from "react";
import DashboardOverview from "../dashboard/dashboardoverview";
import { supabase } from "../../supabaseClient";
import "./dashboard.css";

export default function Dashboard({ onLogout }) {
    // Global Calendar Matrices
    const MONTH_MATRIX = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); // 0-indexed month

    // 1. Structural View States
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [isNavbarOpen, setIsNavbarOpen] = useState(false); // Mobile menu toggle state

    // Live Supabase Sync States
    const [flats, setFlats] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [expenses, setExpenses] = useState([]); // Track dynamic extra expenses
    const [isLoading, setIsLoading] = useState(true);

    // Filter Controls
    const [selectedFilterYear, setSelectedFilterYear] = useState(currentYear);
    const [selectedFilterMonth, setSelectedFilterMonth] = useState(
        MONTH_MATRIX[currentMonthIndex],
    );

    // Ledger Tab States
    const [ledgerStartDate, setLedgerStartDate] = useState("");
    const [ledgerEndDate, setLedgerEndDate] = useState("");
    const [filteredLedgerData, setFilteredLedgerData] = useState([]);
    const [hasQueriedLedger, setHasFilteredLedger] = useState(false);
    const [ledgerCurrentPage, setLedgerCurrentPage] = useState(1);
    const ledgerEntriesPerPage = 10;

    // Building Management / Setting States
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedSecretaryFlatNo, setSelectedSecretaryFlatNo] = useState("");
    const [currentSecretary, setCurrentSecretary] = useState(null);
    const [maintenanceRate, setMaintenanceRate] = useState(500);
    const [transferFeeAmount, setTransferFeeAmount] = useState(2500);

    // 2. Controlled Form States & Modal Controls (Make Maintenance Entry Modal)
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [formFlatNo, setFormFlatNo] = useState("");
    const [formSelectedMonths, setFormSelectedMonths] = useState([]);
    const [includeTransferFee, setIncludeTransferFee] = useState(false);

    // Controlled Form States & Modal Controls (Extra Expense Modal)
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseName, setExpenseName] = useState("");
    const [expenseAmount, setExpenseAmount] = useState("");

    // Controlled Form States & Modal Controls (Edit Flat Member Modal)
    const [isFlatEditModalOpen, setIsFlatEditModalOpen] = useState(false);
    const [editingFlatId, setEditingFlatId] = useState(null);
    const [formFlatNoEdit, setFormFlatNoEdit] = useState("");
    const [formOwnerNameEdit, setFormOwnerNameEdit] = useState("");
    const [formContactNoEdit, setFormContactNoEdit] = useState("");

    // 3. Pagination Parameters (Unified Account Log Registry)
    const [currentPage, setCurrentPage] = useState(1);
    const entriesPerPage = 5;

    // Reset ledger parameters automatically when leaving the ledger tab
    useEffect(() => {
        if (activeTab !== "ledger") {
            setLedgerStartDate("");
            setLedgerEndDate("");
            setFilteredLedgerData([]);
            setHasFilteredLedger(false);
            setLedgerCurrentPage(1);
        }
    }, [activeTab]);

    // Pre-select current operational calendar month by default when maintenance entry modal launches
    useEffect(() => {
        if (isEntryModalOpen) {
            const currentStringTarget = `${MONTH_MATRIX[currentMonthIndex]} ${selectedFilterYear}`;
            setFormSelectedMonths([currentStringTarget]);
            setIncludeTransferFee(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEntryModalOpen, selectedFilterYear]);

    // Helper Utility function to format dates to DD-MM-YY
    const formatDateDDMMYY = (dateString) => {
        if (!dateString) return "N/A";
        try {
            const dateObj = new Date(dateString);
            if (isNaN(dateObj.getTime())) return dateString; 
            const day = String(dateObj.getDate()).padStart(2, "0");
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const year = String(dateObj.getFullYear()).slice(-2); 
            return `${day}-${month}-${year}`;
        } catch (e) {
            return dateString;
        }
    };

    // Helper function to convert dynamic values into a clean standard YYYY-MM-DD string
    const getCleanISODate = (dateInput) => {
        if (!dateInput) return "";
        try {
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return "";
            return d.toISOString().split("T")[0];
        } catch (e) {
            return "";
        }
    };

    // Fetch master relational profiles when filters or updates mutate
    const fetchInitialData = useCallback(async () => {
        try {
            setIsLoading(true);

            // Promise tracking for historical relational parameters
            const [flatsResponse, transactionsResponse, expensesResponse] =
                await Promise.all([
                    supabase.from("flats").select("*"),
                    supabase
                        .from("transactions")
                        .select("*")
                        .order("id", { ascending: false }),
                    supabase
                        .from("expenses")
                        .select("*")
                        .order("id", { ascending: false }),
                ]);

            if (flatsResponse.error) throw flatsResponse.error;
            if (transactionsResponse.error) throw transactionsResponse.error;
            if (expensesResponse.error) {
                console.warn(
                    "Expenses table reference omitted or unprovisioned. Falling back to safe arrays.",
                );
            }

            // Numeric sorting patch configuration logic
            const sortedFlats = (flatsResponse.data || []).sort((a, b) => {
                return parseInt(a.flat_no, 10) - parseInt(b.flat_no, 10);
            });

            setFlats(sortedFlats);
            setTransactions(transactionsResponse.data || []);
            setExpenses(expensesResponse?.data || []);
        } catch (error) {
            console.error("Supabase operational read crash:", error.message);
            alert(
                "Syncing Error: Failed to load ledger logs from Supabase server.",
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // 4. Financial Dashboard Rolling Carry-Forward Aggregations Logic
    const getRollingFinancialTotals = () => {
        let totalCollectedMaintenance = 0;
        let totalExtraExpensesPaid = 0;

        const selectedMonthIdx = MONTH_MATRIX.indexOf(selectedFilterMonth);

        // Filter transactions up to the currently selected month and year bound
        transactions.forEach((t) => {
            const matchYear = t.billing_year;
            if (matchYear < selectedFilterYear) {
                totalCollectedMaintenance += Number(t.amount);
            } else if (matchYear === selectedFilterYear) {
                t.selected_months.forEach((mStr) => {
                    const mName = mStr.split(" ")[0];
                    const mIdx = MONTH_MATRIX.indexOf(mName);
                    if (mIdx <= selectedMonthIdx) {
                        totalCollectedMaintenance +=
                            Number(t.amount) / t.selected_months.length;
                    }
                });
            }
        });

        // Compute expenditures dynamically against carry forward matrix
        expenses.forEach((e) => {
            const expDate = new Date(e.expense_date || e.created_at);
            const expYear = expDate.getFullYear();
            const expMonthIdx = expDate.getMonth();

            if (expYear < selectedFilterYear) {
                totalExtraExpensesPaid += Number(e.amount);
            } else if (
                expYear === selectedFilterYear &&
                expMonthIdx <= selectedMonthIdx
            ) {
                totalExtraExpensesPaid += Number(e.amount);
            }
        });

        const activeMonthCollection = transactions
            .filter(
                (t) =>
                    t.billing_year === selectedFilterYear &&
                    t.selected_months.some((m) =>
                        m.startsWith(selectedFilterMonth),
                    ),
            )
            .reduce(
                (acc, curr) =>
                    acc + Number(curr.amount) / curr.selected_months.length,
                0,
            );

        const activeMonthExpense = expenses
            .filter((e) => {
                const d = new Date(e.expense_date || e.created_at);
                return (
                    d.getFullYear() === selectedFilterYear &&
                    d.getMonth() === selectedMonthIdx
                );
            })
            .reduce((acc, curr) => acc + Number(curr.amount), 0);

        return {
            rollingBalance: totalCollectedMaintenance - totalExtraExpensesPaid,
            currentMonthCollection: activeMonthCollection,
            currentMonthExpense: activeMonthExpense,
        };
    };

    const financialMetrics = getRollingFinancialTotals();

    // Unique active members context counter filter matching target window selection scope
    const uniquePaidMembersCount = new Set(
        transactions
            .filter(
                (t) =>
                    t.billing_year === selectedFilterYear &&
                    t.selected_months.some((m) =>
                        m.startsWith(selectedFilterMonth),
                    ),
            )
            .map((t) => t.flat_no),
    ).size;

    // 5. UNIFIED LEDGER ASSEMBLY ENGINE (Credit & Debit Mapping Integration)
    const creditRows = transactions
        .filter((t) => t.billing_year === selectedFilterYear)
        .map((t) => ({
            ...t,
            ledger_type: "CREDIT",
            sorting_date: t.payment_date || t.created_at,
        }));

    const debitRows = expenses
        .filter((e) => {
            const d = new Date(e.expense_date || e.created_at);
            return d.getFullYear() === selectedFilterYear;
        })
        .map((e) => ({
            ...e,
            ledger_type: "DEBIT",
            flat_no: "N/A",
            name: e.description || "Building Expenditure",
            contact: "N/A",
            payment_date: e.expense_date || e.created_at.split("T")[0],
            selected_months: [e.expense_type || "Anonymous"],
            sorting_date: e.expense_date || e.created_at,
        }));

    // Combine lists and order them descending based on actual dates or entry ids
    const combinedLedgerList = [...creditRows, ...debitRows].sort((a, b) => {
        return new Date(b.sorting_date) - new Date(a.sorting_date);
    });

    // 6. Pagination View Row Slicing Calculations
    const indexOfLastEntry = currentPage * entriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
    const currentEntries = combinedLedgerList.slice(
        indexOfFirstEntry,
        indexOfLastEntry,
    );
    const totalPages = Math.ceil(combinedLedgerList.length / entriesPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    // Core execution engine helper for Ledger filtration logic
    const executeLedgerQuery = (start, end) => {
        const cleanStart = getCleanISODate(start);
        const cleanEnd = getCleanISODate(end);

        const masterCredits = transactions.map((t) => ({
            ...t,
            ledger_type: "CREDIT",
            sorting_date: t.payment_date || t.created_at,
        }));

        const masterDebits = expenses.map((e) => ({
            ...e,
            ledger_type: "DEBIT",
            flat_no: "N/A",
            name: e.description || "Building Expenditure",
            contact: "N/A",
            payment_date: e.expense_date || e.created_at.split("T")[0],
            selected_months: [e.expense_type || "Anonymous"],
            sorting_date: e.expense_date || e.created_at,
        }));

        const compiledList = [...masterCredits, ...masterDebits].filter((row) => {
            const rowTargetDate = getCleanISODate(row.payment_date || row.sorting_date);
            return rowTargetDate >= cleanStart && rowTargetDate <= cleanEnd;
        }).sort((a, b) => new Date(b.sorting_date) - new Date(a.sorting_date));

        setFilteredLedgerData(compiledList);
        setLedgerCurrentPage(1);
        setHasFilteredLedger(true);
    };

    // 6b. Ledger Tab Operations & Calculations
    const handleShowLedgerData = () => {
        if (!ledgerStartDate || !ledgerEndDate) {
            alert("Validation Interrupted: Please select both a start date and an end date.");
            return;
        }
        if (getCleanISODate(ledgerStartDate) > getCleanISODate(ledgerEndDate)) {
            alert("Validation Interrupted: Start date cannot be after the selected end date.");
            return;
        }
        executeLedgerQuery(ledgerStartDate, ledgerEndDate);
    };

    // Quick filter implementation fetching data bounds matching current active physical month
    const handleQuickShowCurrentMonth = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        
        // Offset timezone mapping safely to extract pristine ISO dates locally
        const formatLocalISO = (dObj) => {
            const offset = dObj.getTimezoneOffset();
            const localDate = new Date(dObj.getTime() - (offset * 60 * 1000));
            return localDate.toISOString().split('T')[0];
        };

        const startISO = formatLocalISO(firstDay);
        const endISO = formatLocalISO(lastDay);

        setLedgerStartDate(startISO);
        setLedgerEndDate(endISO);
        
        executeLedgerQuery(startISO, endISO);
    };

    const handleExportLedgerToExcel = () => {
        if (filteredLedgerData.length === 0) {
            alert("Export Omitted: No rows available inside the filtered date bounds.");
            return;
        }

        const timeStr = new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).replace(/\s+/g, "");

        const currentHour = new Date().getHours();
        const ampm = currentHour >= 12 ? 'PM' : 'AM';

        const rawStart = new Date(ledgerStartDate);
        const rawEnd = new Date(ledgerEndDate);
        
        const startFormatted = `${String(rawStart.getDate()).padStart(2, "0")}/${String(rawStart.getMonth() + 1).padStart(2, "0")}/${rawStart.getFullYear()}`;
        const endFormatted = `${String(rawEnd.getDate()).padStart(2, "0")}/${String(rawEnd.getMonth() + 1).padStart(2, "0")}/${rawEnd.getFullYear()}`;

        const sheetFileName = `Komal-Park-${startFormatted.replace(/\//g, "-")}-${endFormatted.replace(/\//g, "-")}-${timeStr}${ampm}.xls`;

        let totalIncome = 0;
        let totalExpense = 0;

        filteredLedgerData.forEach(item => {
            const amt = Number(item.amount) || 0;
            if (item.ledger_type === "CREDIT") {
                totalIncome += amt;
            } else {
                totalExpense += amt;
            }
        });

        const remainingBalance = totalIncome - totalExpense;

        let excelTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
        excelTemplate += `<head><meta charset="UTF-8"></head><body>`;
        excelTemplate += `<table border="1">`;
        excelTemplate += `<tr style="background-color: #0d6efd; color: white; font-weight: bold;">`;
        excelTemplate += `<th>Type</th><th>Flat No</th><th>Full Name / Description</th><th>Contact Number</th><th>Entry Date</th><th>For Which Month / Tag</th><th>Amount Rs</th>`;
        excelTemplate += `</tr>`;

        filteredLedgerData.forEach((item) => {
            excelTemplate += `<tr>`;
            excelTemplate += `<td>${item.ledger_type === "CREDIT" ? "Entry" : "Debit"}</td>`;
            excelTemplate += `<td>${item.flat_no}</td>`;
            excelTemplate += `<td>${item.name}</td>`;
            excelTemplate += `<td>${item.contact}</td>`;
            excelTemplate += `<td>${formatDateDDMMYY(item.payment_date)}</td>`;
            excelTemplate += `<td>${item.selected_months.join(", ")}</td>`;
            excelTemplate += `<td>${item.ledger_type === "CREDIT" ? "+" : "-"}${item.amount}</td>`;
            excelTemplate += `</tr>`;
        });

        excelTemplate += `<tr><td colspan="7" style="border:none;"></td></tr>`;
        excelTemplate += `<tr><td colspan="5" style="text-align:right; font-weight:bold;">Total Income:</td><td colspan="2" style="font-weight:bold; color:green;">₹ ${totalIncome.toLocaleString("en-IN")}</td></tr>`;
        excelTemplate += `<tr><td colspan="5" style="text-align:right; font-weight:bold;">Total Expense:</td><td colspan="2" style="font-weight:bold; color:red;">₹ ${totalExpense.toLocaleString("en-IN")}</td></tr>`;
        excelTemplate += `<tr><td colspan="5" style="text-align:right; font-weight:bold; background-color:#f1f3f5;">Remaining Total Balance:</td><td colspan="2" style="font-weight:bold; background-color:#f1f3f5; color:${remainingBalance >= 0 ? 'blue' : 'darkred'};">₹ ${remainingBalance.toLocaleString("en-IN")}</td></tr>`;
        excelTemplate += `</table></body></html>`;

        const blobContent = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8;" });
        const downloadUrlLink = URL.createObjectURL(blobContent);
        const attachmentTriggerElement = document.createElement("a");
        attachmentTriggerElement.href = downloadUrlLink;
        attachmentTriggerElement.download = sheetFileName;
        document.body.appendChild(attachmentTriggerElement);
        attachmentTriggerElement.click();
        document.body.removeChild(attachmentTriggerElement);
    };

    const ledgerIndexOfLastEntry = ledgerCurrentPage * ledgerEntriesPerPage;
    const ledgerIndexOfFirstEntry = ledgerIndexOfLastEntry - ledgerEntriesPerPage;
    const currentLedgerEntries = filteredLedgerData.slice(ledgerIndexOfFirstEntry, ledgerIndexOfLastEntry);
    const ledgerTotalPages = Math.ceil(filteredLedgerData.length / ledgerEntriesPerPage);

    // 7. Form Multi-Month Input State Handlers
    const handleMonthSelectionToggle = (monthName) => {
        const constructStringTarget = `${monthName} ${selectedFilterYear}`;
        if (formSelectedMonths.includes(constructStringTarget)) {
            setFormSelectedMonths(
                formSelectedMonths.filter((m) => m !== constructStringTarget),
            );
        } else {
            setFormSelectedMonths([
                ...formSelectedMonths,
                constructStringTarget,
            ]);
        }
    };

    const handleDiscardForm = () => {
        setFormFlatNo("");
        setFormSelectedMonths([]);
        setIncludeTransferFee(false);
        setIsEntryModalOpen(false);
    };

    // Global settings update architecture pipeline handler
    const handleSaveBuildingSettings = (e) => {
        e.preventDefault();
        const profileMatch = flats.find(f => f.flat_no === selectedSecretaryFlatNo);
        if (profileMatch) {
            setCurrentSecretary(profileMatch);
        } else {
            setCurrentSecretary(null);
        }
        setIsSettingsModalOpen(false);
        alert("Building Settings Applied: Maintenance fee baselines, Transfer fees, and Secretary profiles configured successfully.");
    };

    // 8. DB Core Submission pipeline handlers
    const handleSubmitMaintenanceEntry = async (e) => {
        e.preventDefault();
        if (!formFlatNo || formSelectedMonths.length === 0) {
            alert(
                "Validation Interrupted: Choose target resident unit profile and months.",
            );
            return;
        }

        const targetMemberProfile = flats.find((f) => f.flat_no === formFlatNo);
        
        // Calculate structural dynamic summaries matching custom parameter toggles
        const totalBaseMaintenance = formSelectedMonths.length * maintenanceRate;
        const finalCalculatedFee = totalBaseMaintenance + (includeTransferFee ? Number(transferFeeAmount) : 0);

        // Compile output array tags sequentially
        const statementTagsArray = [...formSelectedMonths];
        if (includeTransferFee) {
            statementTagsArray.push("Transfer Fee Paid");
        }

        const payloadData = {
            flat_no: formFlatNo,
            name: targetMemberProfile ? targetMemberProfile.owner_name : "Unknown Occupant",
            contact: targetMemberProfile ? targetMemberProfile.contact_no : "N/A",
            payment_date: new Date().toISOString().split("T")[0],
            selected_months: statementTagsArray,
            total_months_paid: formSelectedMonths.length,
            amount: finalCalculatedFee,
            billing_year: parseInt(selectedFilterYear),
        };

        try {
            const { data, error } = await supabase
                .from("transactions")
                .insert([payloadData])
                .select();
            if (error) throw error;

            if (data) {
                setTransactions([data[0], ...transactions]);
            }
            setCurrentPage(1);
            handleDiscardForm();
        } catch (error) {
            alert(`Database Persistence Crash: ${error.message}`);
        }
    };

    const handleSubmitExtraExpense = async (e) => {
        e.preventDefault();
        if (!expenseName || !expenseAmount) {
            alert(
                "Please complete the form detailing description and pricing metrics.",
            );
            return;
        }

        const payloadExpense = {
            expense_type: "Anonymous",
            description: expenseName,
            amount: Number(expenseAmount),
            expense_date: new Date().toISOString().split("T")[0],
        };

        try {
            const { data, error } = await supabase
                .from("expenses")
                .insert([payloadExpense])
                .select();
            if (error) throw error;

            if (data) {
                setExpenses([data[0], ...expenses]);
            } else {
                setExpenses([
                    {
                        id: Date.now(),
                        created_at: new Date().toISOString(),
                        ...payloadExpense,
                    },
                    ...expenses,
                ]);
            }

            setExpenseName("");
            setExpenseAmount("");
            setIsExpenseModalOpen(false);
            alert("Extra Expense registered and configured successfully!");
        } catch (error) {
            console.error(error);
            setExpenses([
                {
                    id: Date.now(),
                    created_at: new Date().toISOString(),
                    ...payloadExpense,
                },
                ...expenses,
            ]);
            setExpenseName("");
            setExpenseAmount("");
            setIsExpenseModalOpen(false);
        }
    };

    const handleDeleteRecordRow = async (item) => {
        const targetTable =
            item.ledger_type === "CREDIT" ? "transactions" : "expenses";
        if (
            !window.confirm(
                `Cloud Execution Rule: Purge selected ${item.ledger_type.toLowerCase()} registry item permanently?`,
            )
        )
            return;

        try {
            const { error } = await supabase
                .from(targetTable)
                .delete()
                .eq("id", item.id);
            if (error) throw error;

            if (targetTable === "transactions") {
                setTransactions(transactions.filter((t) => t.id !== item.id));
            } else {
                setExpenses(expenses.filter((e) => e.id !== item.id));
            }
        } catch (error) {
            alert(`Deletion Process Stopped: ${error.message}`);
        }
    };

    const handleEditFlatClick = (flat) => {
        setEditingFlatId(flat.id);
        setFormFlatNoEdit(flat.flat_no);
        setFormOwnerNameEdit(flat.owner_name);
        setFormContactNoEdit(flat.contact_no);
        setIsFlatEditModalOpen(true);
    };

    const handleSubmitFlatEdit = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from("flats")
                .update({
                    owner_name: formOwnerNameEdit,
                    contact_no: formContactNoEdit,
                })
                .eq("id", editingFlatId);

            if (error) throw error;

            const updatedFlats = flats.map((f) =>
                f.id === editingFlatId
                    ? {
                          ...f,
                          owner_name: formOwnerNameEdit,
                          contact_no: formContactNoEdit,
                      }
                    : f,
            );
            setFlats(
                updatedFlats.sort(
                    (a, b) => parseInt(a.flat_no, 10) - parseInt(b.flat_no, 10),
                ),
            );
            setIsFlatEditModalOpen(false);
        } catch (error) {
            alert(`Database Update Failed: ${error.message}`);
        }
    };

    // 9. WHATSAPP INVOICE GENERATOR ROUTER (With Dynamic Secretary Metadata Signature Routing)
    const handleSendWhatsAppInvoice = (item) => {
        if (item.ledger_type === "DEBIT") {
            alert(
                "Expenditure logs cannot be routed to a specific resident profile via WhatsApp.",
            );
            return;
        }

        const cleanContact = item.contact
            ? item.contact.replace(/\D/g, "")
            : "";
        if (!cleanContact || cleanContact.length < 10) {
            alert(
                "Operation Aborted: Target flat member profile does not possess a valid contact number.",
            );
            return;
        }

        const currentTimeString = new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });

        const secretarySignature = currentSecretary 
            ? `\n\n*Regards,*\n*Secretary:* ${currentSecretary.owner_name} (Flat ${currentSecretary.flat_no})` 
            : "";

        const messagePayload = `*Komal Park Maintenance Receipt*

*Name:* ${item.name}
*Flat No:* ${item.flat_no}
*Contact Number:* ${item.contact}
*Entry Date:* ${formatDateDDMMYY(item.payment_date)}
*Statement Tag Matrix:* ${item.selected_months.join(", ")}
*Amount Paid:* ₹${Number(item.amount).toLocaleString("en-IN")}
*Time:* ${currentTimeString}${secretarySignature}`;

        const encodedURLText = encodeURIComponent(messagePayload);
        const formattedPhone =
            cleanContact.length === 10 ? `91${cleanContact}` : cleanContact;
        const targetApiEndpoint = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedURLText}`;

        window.open(targetApiEndpoint, "_blank");
    };

    // Layout Theme Styles Configuration Setup
    const themeClass = isDarkMode ? "bg-dark text-white" : "bg-light text-dark";
    const cardClass = isDarkMode
        ? "bg-secondary bg-opacity-25 border-secondary text-white"
        : "bg-white text-dark border-0 shadow-sm";
    const sidebarBg = isDarkMode
        ? "bg-black bg-opacity-50 text-white"
        : "bg-white text-dark";
    const tableClass = isDarkMode
        ? "table-dark table-striped"
        : "table-striped";
    const modalBgClass = isDarkMode
        ? "bg-dark text-white border-secondary"
        : "bg-white text-dark";

    return (
        <div
            className={`container-fluid min-vh-100 ${themeClass} p-0 transition-all`}
        >
            <div className="d-flex flex-column flex-md-row min-vh-100">
                {/* LEFT PORTAL SIDEBAR INTERFACE WRAPPER LAYOUT PANEL */}
                <div
                    className={`col-12 col-md-3 col-lg-2 p-3 border-end d-flex flex-column mySidebar ${sidebarBg}`}
                >
                    <div className="text-center text-md-start mb-2 mb-md-4">
                        <h5 className="fw-bold text-primary mb-0">
                            <i className="fa-solid fa-building me-2"></i>Komal Park
                        </h5>
                        <small className="text-muted d-none d-sm-inline">
                            Management Portal
                        </small>
                    </div>
                    <hr className="d-none d-md-block" />
                    <ul className="nav nav-pills row g-2 row-cols-3 row-cols-md-1 flex-md-column mb-auto px-1">
                        <li className="nav-item col mt-0">
                            <button
                                onClick={() => setActiveTab("dashboard")}
                                className={`nav-link w-100 text-center text-md-start fw-semibold py-2 ${activeTab === "dashboard" ? "active" : "text-secondary"}`}
                            >
                                <i className="fa-solid fa-chart-pie me-md-2"></i>
                                <span className="d-none d-sm-inline d-md-inline"> Dashboard</span>
                                <span className="d-inline d-sm-none"> Dashboard</span>
                            </button>
                        </li>
                        <li className="nav-item col mt-0">
                            <button
                                onClick={() => setActiveTab("members")}
                                className={`nav-link w-100 text-center text-md-start fw-semibold py-2 ${activeTab === "members" ? "active" : "text-secondary"}`}
                            >
                                <i className="fa-solid fa-users me-md-2"></i>
                                <span className="d-none d-sm-inline d-md-inline"> Total Flat Member</span>
                                <span className="d-inline d-sm-none"> Members</span>
                            </button>
                        </li>
                        <li className="nav-item col mt-0">
                            <button
                                onClick={() => setActiveTab("ledger")}
                                className={`nav-link w-100 text-center text-md-start fw-semibold py-2 ${activeTab === "ledger" ? "active" : "text-secondary"}`}
                            >
                                <i className="fa-solid fa-book me-md-2"></i>
                                <span className="d-none d-sm-inline d-md-inline"> Ledger logs</span>
                                <span className="d-inline d-sm-none"> Ledger</span>
                            </button>
                        </li>
                    </ul>
                </div>

                {/* RIGHT CENTRAL WORKSPACE CONSOLE PANEL DESIGN AREA */}
                <div className="col-12 col-md-9 col-lg-10 p-3 p-md-4 d-flex flex-column">
                    
                    {/* BOOTSTRAP RESPONSIVE ACTION CONTROLLER NAVBAR */}
                    <nav className="navbar navbar-expand-lg p-0 mb-4 border-bottom pb-3">
                        <div className="container-fluid p-0 d-flex justify-content-between align-items-center">
                            
                            {/* Left Brand Title */}
                            <h2 className="h4 fw-bold text-primary mb-0">
                                Admin Controller
                            </h2>

                            {/* Breadcrumb Menu Logo Button (Visible < 991px) */}
                            <button 
                                className={`navbar-toggler border-0 ${isDarkMode ? 'text-white' : 'text-dark'}`}
                                type="button" 
                                onClick={() => setIsNavbarOpen(!isNavbarOpen)}
                                aria-controls="adminActionsNavbar" 
                                aria-expanded={isNavbarOpen} 
                                aria-label="Toggle actions navigation"
                                style={{ outline: 'none', boxShadow: 'none' }}
                            >
                                <i className={`fa-solid ${isNavbarOpen ? 'fa-xmark fs-3' : 'fa-bars fs-3'}`}></i>
                            </button>

                            {/* Dropdown / Collapse Menu Content Container */}
                            <div className={`collapse navbar-collapse justify-content-end mt-3 mt-lg-0 ${isNavbarOpen ? 'show' : ''}`} id="adminActionsNavbar">
                                <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-3 w-100 justify-content-lg-end">
                                    
                                    {/* Month and Year Selectors */}
                                    <div className="d-flex flex-row align-items-center gap-2">
                                        <select
                                            className={`form-select form-select-sm fw-bold text-info border-info p-2 bg-transparent ${isDarkMode ? 'bg-dark' : 'bg-white'}`}
                                            style={{ minWidth: "120px" }}
                                            value={selectedFilterMonth}
                                            onChange={(e) => setSelectedFilterMonth(e.target.value)}
                                        >
                                            {MONTH_MATRIX.map((mth) => (
                                                <option key={mth} value={mth} className="text-dark">
                                                    {mth}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            className={`form-select form-select-sm font-monospace fw-bold text-primary border-primary p-2 bg-transparent ${isDarkMode ? 'bg-dark' : 'bg-white'}`}
                                            style={{ minWidth: "120px" }}
                                            value={selectedFilterYear}
                                            onChange={(e) => {
                                                setSelectedFilterYear(parseInt(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                        >
                                            {[2025, 2026, 2027, 2028].map((yr) => (
                                                <option key={yr} value={yr} className="text-dark">
                                                    Year: {yr}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Core Utility Buttons Layout Group */}
                                    <div className="d-flex flex-column flex-sm-row flex-lg-row align-items-stretch align-items-sm-center gap-2">
                                        {/* Dark Mode Trigger Button */}
                                        <button
                                            type="button"
                                            onClick={() => setIsDarkMode(!isDarkMode)}
                                            className={`btn btn-sm ${isDarkMode ? "btn-light" : "btn-dark"} fw-bold py-2 px-3`}
                                        >
                                            <i className={`fa-solid ${isDarkMode ? "fa-sun text-warning" : "fa-moon"} me-2`}></i>
                                            Theme Switcher
                                        </button>

                                        {/* Add Maintenance Button */}
                                        <button
                                            className="btn btn-sm btn-outline-primary fw-bold py-2 px-3 shadow-sm"
                                            onClick={() => {
                                                setIsEntryModalOpen(true);
                                                setIsNavbarOpen(false); 
                                            }}
                                        >
                                            <i className="fa-solid fa-circle-plus me-1"></i> Add Maintenance
                                        </button>

                                        {/* Extra Expense Button */}
                                        <button
                                            className="btn btn-sm btn-outline-danger fw-bold py-2 px-3 shadow-sm"
                                            onClick={() => {
                                                setIsExpenseModalOpen(true);
                                                setIsNavbarOpen(false); 
                                            }}
                                        >
                                            <i className="fa-solid fa-receipt me-1"></i> Extra Expense
                                        </button>

                                        {/* Custom Profile Dropdown Admin Action Button Component */}
                                        <div className="position-relative">
                                            <button
                                                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                                className="btn btn-sm btn-outline-primary dropdown-toggle fw-semibold py-2 px-3 w-100"
                                                type="button"
                                            >
                                                <i className="fa-solid fa-user-tie me-1"></i>Admin Controls
                                            </button>
                                            {showProfileDropdown && (
                                                <ul
                                                    className="dropdown-menu dropdown-menu-end d-block position-absolute shadow-lg mt-1 start-sm-auto"
                                                    style={{ minWidth: "160px", zIndex: 1000 }}
                                                >
                                                    <li>
                                                        <button
                                                            className="dropdown-item fw-semibold text-dark"
                                                            onClick={() => {
                                                                setIsSettingsModalOpen(true);
                                                                setShowProfileDropdown(false);
                                                                setIsNavbarOpen(false);
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-sliders me-2 text-primary"></i> Building Settings
                                                        </button>
                                                    </li>
                                                    <li><hr className="dropdown-divider" /></li>
                                                    <li>
                                                        <button
                                                            className="dropdown-item text-danger fw-semibold"
                                                            onClick={() => {
                                                                onLogout();
                                                                setIsNavbarOpen(false);
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-sign-out-alt me-2"></i> Logout
                                                        </button>
                                                    </li>
                                                </ul>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>

                        </div>
                    </nav>

                    {isLoading ? (
                        <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1 py-5">
                            <div className="spinner-border text-primary mb-3" role="status"></div>
                            <span className="text-muted fw-semibold">
                                Synchronizing Live Supabase Ledger Data...
                            </span>
                        </div>
                    ) : (
                        <div className="flex-grow-1">
                            {activeTab === "dashboard" && (
                                <div className="w-100">
                                    <DashboardOverview
                                        financialMetrics={financialMetrics}
                                        uniquePaidMembersCount={uniquePaidMembersCount}
                                        totalFlats={flats.length}
                                        cardClass={cardClass}
                                    />

                                    <div className={`card shadow-sm ${cardClass} mb-4`}>
                                        <div className="card-body p-0">
                                            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                                                <h5 className="mb-0 fw-bold">
                                                    <i className="fa-solid fa-receipt me-2 text-primary"></i>
                                                    Unified Account Log Registry ({selectedFilterYear})
                                                </h5>
                                            </div>
                                            <div className="table-responsive">
                                                <table className={`table table-hover align-middle mb-0 ${tableClass}`}>
                                                    <thead>
                                                        <tr>
                                                            <th className="px-3">Type</th>
                                                            <th>Flat No</th>
                                                            <th>Full Name / Description</th>
                                                            <th>Contact Number</th>
                                                            <th>Entry Date</th>
                                                            <th>For Which Month / Tag</th>
                                                            <th>Amount Rs</th>
                                                            <th className="text-center">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {currentEntries.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="8" className="text-center py-4 text-muted">
                                                                    No statement logs matching target year scope bounds.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            currentEntries.map((item) => (
                                                                <tr key={`${item.ledger_type}-${item.id}`}>
                                                                    <td className="px-3">
                                                                        <span className={`badge ${item.ledger_type === "CREDIT" ? "bg-success" : "bg-danger"}`}>
                                                                            {item.ledger_type === "CREDIT" ? "Entry" : "Debit"}
                                                                        </span>
                                                                    </td>
                                                                    <td className="fw-bold text-primary">{item.flat_no}</td>
                                                                    <td>{item.name}</td>
                                                                    <td className="font-monospace">{item.contact}</td>
                                                                    <td>{formatDateDDMMYY(item.payment_date)}</td>
                                                                    <td>
                                                                        <div className="d-flex flex-wrap gap-1" style={{ maxWidth: "280px" }}>
                                                                            {item.selected_months.map((m, idx) => (
                                                                                <span key={idx} className={`badge bg-opacity-10 border px-2 py-1 small ${item.ledger_type === "CREDIT" ? (m === "Transfer Fee Paid" ? "bg-danger text-danger border-danger" : "bg-info text-info border-info") : "bg-warning text-warning border-warning"}`}>
                                                                                    {m}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className={`fw-bold ${item.ledger_type === "CREDIT" ? "text-success" : "text-danger"}`}>
                                                                        {item.ledger_type === "CREDIT" ? "+" : "-"} ₹{Number(item.amount).toLocaleString("en-IN")}
                                                                    </td>
                                                                    <td className="text-center">
                                                                        <div className="d-flex justify-content-center gap-1">
                                                                            <button className="btn btn-sm btn-outline-danger" title="Delete Row" onClick={() => handleDeleteRecordRow(item)}>
                                                                                <i className="fa-solid fa-trash-can"></i>
                                                                            </button>
                                                                            {item.ledger_type === "CREDIT" && (
                                                                                <button className="btn btn-sm btn-outline-success" title="Send WhatsApp Invoice" onClick={() => handleSendWhatsAppInvoice(item)}>
                                                                                    <i className="fa-brands fa-whatsapp text-success fw-bold"></i>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {totalPages > 1 && (
                                        <nav className="d-flex justify-content-start">
                                            <ul className="pagination pagination-sm mb-0 shadow-sm border rounded">
                                                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                                                    <button className="page-link px-3 py-2 fw-semibold" onClick={() => handlePageChange(currentPage - 1)}>
                                                        Previous
                                                    </button>
                                                </li>
                                                {[...Array(totalPages)].map((_, i) => (
                                                    <li key={i + 1} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                                                        <button className="page-link px-3 py-2 fw-semibold" onClick={() => handlePageChange(i + 1)}>
                                                            {i + 1}
                                                        </button>
                                                    </li>
                                                ))}
                                                <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                                                    <button className="page-link px-3 py-2 fw-semibold" onClick={() => handlePageChange(currentPage + 1)}>
                                                        Next
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    )}
                                </div>
                            )}

                            {activeTab === "members" && (
                                <div className={`card p-3 p-md-4 shadow-sm ${cardClass}`}>
                                    <h4 className="fw-bold mb-2">Total Flat Members Directory Matrix</h4>
                                    <p className="text-muted mb-3">Permanent core properties schema registry sequentially sourced.</p>
                                    <div className="table-responsive">
                                        <table className={`table table-hover ${tableClass} align-middle`}>
                                            <thead>
                                                <tr>
                                                    <th>Flat No</th>
                                                    <th>Full Name</th>
                                                    <th>Contact Number</th>
                                                    <th className="text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {flats.map((flat) => (
                                                    <tr key={flat.id}>
                                                        <td className="fw-bold text-primary">Flat {flat.flat_no}</td>
                                                        <td>{flat.owner_name}</td>
                                                        <td className="font-monospace">{flat.contact_no}</td>
                                                        <td className="text-center">
                                                            <button className="btn btn-sm btn-outline-warning" title="Edit Member Details" onClick={() => handleEditFlatClick(flat)}>
                                                                <i className="fa-solid fa-pen-to-square"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* LEDGER WORKSPACE GRAPHICAL MATRIX VIEW */}
                            {activeTab === "ledger" && (
                                <div className="w-100">
                                    <div className={`card p-3 p-md-4 shadow-sm ${cardClass} mb-4`}>
                                        <h4 className="fw-bold text-primary mb-3">Select the Month Bounds</h4>
                                        <div className="row g-3 align-items-end">
                                            <div className="col-12 col-sm-6 col-md-3">
                                                <label className="form-label small fw-bold text-uppercase text-muted">Start Date</label>
                                                <input 
                                                    type="date" 
                                                    className={`form-control ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`} 
                                                    value={ledgerStartDate}
                                                    onChange={(e) => setLedgerStartDate(e.target.value)}
                                                />
                                            </div>
                                            <div className="col-12 col-sm-6 col-md-3">
                                                <label className="form-label small fw-bold text-uppercase text-muted">End Date</label>
                                                <input 
                                                    type="date" 
                                                    className={`form-control ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`} 
                                                    value={ledgerEndDate}
                                                    onChange={(e) => setLedgerEndDate(e.target.value)}
                                                />
                                            </div>
                                            <div className="col-12 col-sm-6 col-md-3">
                                                <button 
                                                    type="button" 
                                                    className="btn btn-primary fw-bold px-4 w-100"
                                                    onClick={handleShowLedgerData}
                                                >
                                                    <i className="fa-solid fa-magnifying-glass me-2"></i>Show
                                                </button>
                                            </div>
                                            <div className="col-12 col-sm-6 col-md-3">
                                                <button 
                                                    type="button" 
                                                    className="btn btn-outline-info fw-bold px-3 w-100"
                                                    onClick={handleQuickShowCurrentMonth}
                                                >
                                                    <i className="fa-solid fa-calendar-day me-2"></i>Current Month
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {hasQueriedLedger && (
                                        <div className={`card shadow-sm ${cardClass} mb-4`}>
                                            <div className="card-body p-0">
                                                <div className="p-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
                                                    <h5 className="mb-0 fw-bold">
                                                        <i className="fa-solid fa-book-open me-2 text-primary"></i>Statement Ledger Search Results
                                                    </h5>
                                                    {filteredLedgerData.length > 0 && (
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-sm btn-success fw-bold px-3 shadow-sm"
                                                            onClick={handleExportLedgerToExcel}
                                                        >
                                                            <i className="fa-solid fa-file-excel me-2"></i>Export to Excel
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="table-responsive">
                                                    <table className={`table align-middle mb-0 ${tableClass}`}>
                                                        <thead>
                                                            <tr>
                                                                <th className="px-3">Type</th>
                                                                <th>Flat No</th>
                                                                <th>Full Name / Description</th>
                                                                <th>Contact Number</th>
                                                                <th>Entry Date</th>
                                                                <th>For Which Month / Tag</th>
                                                                <th>Amount Rs</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {currentLedgerEntries.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan="7" className="text-center py-4 text-muted fw-semibold">
                                                                        No logs generated within the targeted start and end parameters.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                currentLedgerEntries.map((item) => (
                                                                    <tr key={`ledger-${item.ledger_type}-${item.id}`}>
                                                                        <td className="px-3">
                                                                            <span className={`badge ${item.ledger_type === "CREDIT" ? "bg-success" : "bg-danger"}`}>
                                                                                {item.ledger_type === "CREDIT" ? "Entry" : "Debit"}
                                                                            </span>
                                                                        </td>
                                                                        <td className="fw-bold text-primary">{item.flat_no}</td>
                                                                        <td>{item.name}</td>
                                                                        <td className="font-monospace">{item.contact}</td>
                                                                        <td>{formatDateDDMMYY(item.payment_date)}</td>
                                                                        <td>
                                                                            <div className="d-flex flex-wrap gap-1" style={{ maxWidth: "280px" }}>
                                                                                {item.selected_months.map((m, idx) => (
                                                                                    <span key={idx} className={`badge bg-opacity-10 border px-2 py-1 small ${item.ledger_type === "CREDIT" ? (m === "Transfer Fee Paid" ? "bg-danger text-danger border-danger" : "bg-info text-info border-info") : "bg-warning text-warning border-warning"}`}>
                                                                                        {m}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className={`fw-bold ${item.ledger_type === "CREDIT" ? "text-success" : "text-danger"}`}>
                                                                            {item.ledger_type === "CREDIT" ? "+" : "-"} ₹{Number(item.amount).toLocaleString("en-IN")}
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {hasQueriedLedger && ledgerTotalPages > 1 && (
                                        <nav className="d-flex justify-content-start">
                                            <ul className="pagination pagination-sm mb-0 shadow-sm border rounded">
                                                <li className={`page-item ${ledgerCurrentPage === 1 ? "disabled" : ""}`}>
                                                    <button className="page-link px-3 py-2 fw-semibold" onClick={() => setLedgerCurrentPage(ledgerCurrentPage - 1)}>
                                                        Previous
                                                    </button>
                                                </li>
                                                {[...Array(ledgerTotalPages)].map((_, i) => (
                                                    <li key={`ledger-pg-${i + 1}`} className={`page-item ${ledgerCurrentPage === i + 1 ? "active" : ""}`}>
                                                        <button className="page-link px-3 py-2 fw-semibold" onClick={() => setLedgerCurrentPage(i + 1)}>
                                                            {i + 1}
                                                        </button>
                                                    </li>
                                                ))}
                                                <li className={`page-item ${ledgerCurrentPage === ledgerTotalPages ? "disabled" : ""}`}>
                                                    <button className="page-link px-3 py-2 fw-semibold" onClick={() => setLedgerCurrentPage(ledgerCurrentPage + 1)}>
                                                        Next
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* UNIFIED BUILDING SETTINGS MODAL */}
            {isSettingsModalOpen && (
                <div className="modal d-block position-fixed top-0 start-0 w-100 h-100 filter-dark-overlay" style={{ zIndex: 1060, overflowY: "auto" }}>
                    <div className="modal-dialog modal-dialog-centered modal-md">
                        <div className={`modal-content shadow-lg ${modalBgClass}`}>
                            <div className="modal-header border-bottom border-opacity-25">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-sliders me-2 text-primary"></i>Building Settings Configuration
                                </h5>
                                <button type="button" className={`btn-close ${isDarkMode ? "btn-close-white" : ""}`} onClick={() => setIsSettingsModalOpen(false)}></button>
                            </div>
                            <form onSubmit={handleSaveBuildingSettings}>
                                <div className="modal-body">
                                    
                                    {/* Tab 1: Assign Secretary */}
                                    <div className="mb-4">
                                        <label className="form-label fw-bold small text-uppercase text-primary mb-1">
                                            <i className="fa-solid fa-user-shield me-1"></i> Executive Secretary Profile
                                        </label>
                                        <select 
                                            className={`form-select ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`}
                                            value={selectedSecretaryFlatNo}
                                            onChange={(e) => setSelectedSecretaryFlatNo(e.target.value)}
                                        >
                                            <option value="">-- No Active Secretary Assigned --</option>
                                            {flats.map((f) => (
                                                <option key={`sec-opt-${f.id}`} value={f.flat_no}>
                                                    Flat No: {f.flat_no} - {f.owner_name} ({f.contact_no})
                                                </option>
                                            ))}
                                        </select>
                                        <small className="text-muted d-block mt-1">Assigns a signature row under billing receipt text metrics.</small>
                                    </div>

                                    {/* Tab 2: Global Maintenance Rate */}
                                    <div className="mb-4">
                                        <label className="form-label fw-bold small text-uppercase text-primary mb-1">
                                            <i className="fa-solid fa-wallet me-1"></i> Monthly Maintenance Baseline (₹)
                                        </label>
                                        <input 
                                            type="number"
                                            className={`form-control ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`}
                                            value={maintenanceRate}
                                            onChange={(e) => setMaintenanceRate(Math.max(0, Number(e.target.value)))}
                                            min="0"
                                            required
                                        />
                                        <small className="text-muted d-block mt-1">Global collection value baseline applied across all building units.</small>
                                    </div>

                                    {/* Tab 3: Transfer Fee Amount */}
                                    <div className="mb-2">
                                        <label className="form-label fw-bold small text-uppercase text-primary mb-1">
                                            <i className="fa-solid fa-handshake-simple me-1"></i> Ownership Transfer Fees (₹)
                                        </label>
                                        <input 
                                            type="number"
                                            className={`form-control ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`}
                                            value={transferFeeAmount}
                                            onChange={(e) => setTransferFeeAmount(Math.max(0, Number(e.target.value)))}
                                            min="0"
                                            required
                                        />
                                        <small className="text-muted d-block mt-1">Applicable during unit sales to new incoming resident member accounts.</small>
                                    </div>

                                </div>
                                <div className="modal-footer border-top border-opacity-25">
                                    <button type="button" className="btn btn-sm btn-secondary fw-bold px-3" onClick={() => setIsSettingsModalOpen(false)}>Discard</button>
                                    <button type="submit" className="btn btn-sm btn-primary fw-bold px-3 shadow-sm">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MAINTENANCE MODAL ENTRY VIEW */}
            {isEntryModalOpen && (
                <div className="modal d-block position-fixed top-0 start-0 w-100 h-100 filter-dark-overlay" style={{ zIndex: 1060, overflowY: "auto" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className={`modal-content shadow-lg ${modalBgClass}`}>
                            <div className="modal-header border-bottom border-opacity-25">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-calculator me-2 text-primary"></i>Collect Maintenance ({selectedFilterYear})
                                </h5>
                                <button type="button" className={`btn-close ${isDarkMode ? "btn-close-white" : ""}`} onClick={handleDiscardForm}></button>
                            </div>
                            <form onSubmit={handleSubmitMaintenanceEntry}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-uppercase">Select the Flat Member</label>
                                        <select className={`form-select ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`} value={formFlatNo} onChange={(e) => setFormFlatNo(e.target.value)} required>
                                            <option value="">-- Choose Flat Profile --</option>
                                            {flats.map((f) => (
                                                <option key={f.id} value={f.flat_no}>
                                                    Flat No: {f.flat_no} - {f.owner_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-uppercase d-block">Select Months for Year {selectedFilterYear}</label>
                                        <div className="row g-2">
                                            {MONTH_MATRIX.map((monthName, idx) => {
                                                const constructStringTarget = `${monthName} ${selectedFilterYear}`;
                                                const isSelected = formSelectedMonths.includes(constructStringTarget);
                                                return (
                                                    <div key={idx} className="col-6 col-sm-4">
                                                        <button type="button" onClick={() => handleMonthSelectionToggle(monthName)} className={`btn btn-sm w-100 text-truncate fw-semibold ${isSelected ? "btn-primary shadow-sm" : isDarkMode ? "btn-outline-secondary text-white-50" : "btn-outline-primary"}`}>
                                                            {isSelected && <i className="fa-solid fa-check me-1 small"></i>}
                                                            {monthName}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Transfer Fee Checkbox Switch Module */}
                                    <div className="mb-4 mt-2">
                                        <div className="form-check form-switch p-3 border rounded border-opacity-50 shadow-sm bg-black bg-opacity-10">
                                            <input 
                                                className="form-check-input ms-0 me-2 cursor-pointer" 
                                                type="checkbox" 
                                                role="switch" 
                                                id="transferFeeSwitch"
                                                checked={includeTransferFee}
                                                onChange={(e) => setIncludeTransferFee(e.target.checked)}
                                            />
                                            <label className="form-check-label fw-bold text-danger cursor-pointer small text-uppercase" htmlFor="transferFeeSwitch">
                                                Include Ownership Transfer Fees (+ ₹{transferFeeAmount.toLocaleString("en-IN")})
                                            </label>
                                        </div>
                                    </div>

                                    <div className={`p-3 rounded mb-2 ${isDarkMode ? "bg-black bg-opacity-20 border border-secondary" : "bg-light border"}`}>
                                        <div className="d-flex flex-column gap-1">
                                            <div className="d-flex justify-content-between align-items-center small text-muted">
                                                <span>Base Maintenance ({formSelectedMonths.length} x ₹{maintenanceRate}):</span>
                                                <span className="font-monospace">₹ {(formSelectedMonths.length * maintenanceRate).toLocaleString("en-IN")}</span>
                                            </div>
                                            {includeTransferFee && (
                                                <div className="d-flex justify-content-between align-items-center small text-danger fw-semibold">
                                                    <span>Ownership Transfer Surcharge:</span>
                                                    <span className="font-monospace">+ ₹ {transferFeeAmount.toLocaleString("en-IN")}</span>
                                                </div>
                                            )}
                                            <hr className="my-1 border-opacity-25" />
                                            <div className="d-flex justify-content-between align-items-center">
                                                <span className="fw-bold small text-muted text-uppercase">Total Statement Cost Summary:</span>
                                                <span className="badge bg-success font-monospace fs-6">
                                                    ₹ {((formSelectedMonths.length * maintenanceRate) + (includeTransferFee ? Number(transferFeeAmount) : 0)).toLocaleString("en-IN")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-top border-opacity-25">
                                    <button type="button" className="btn btn-sm btn-secondary fw-bold px-3" onClick={handleDiscardForm}>Discard</button>
                                    <button type="submit" className="btn btn-sm btn-success fw-bold px-3 shadow-sm">Submit Form</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* EXTRA EXPENSE OVERLAY MODAL */}
            {isExpenseModalOpen && (
                <div className="modal d-block position-fixed top-0 start-0 w-100 h-100 filter-dark-overlay" style={{ zIndex: 1060, overflowY: "auto" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className={`modal-content shadow-lg ${modalBgClass}`}>
                            <div className="modal-header border-bottom border-opacity-25">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-circle-minus me-2 text-danger"></i>Log Extra Expenditure Row
                                </h5>
                                <button type="button" className={`btn-close ${isDarkMode ? "btn-close-white" : ""}`} onClick={() => setIsExpenseModalOpen(false)}></button>
                            </div>
                            <form onSubmit={handleSubmitExtraExpense}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-uppercase">Add the expense name</label>
                                        <input type="text" className={`form-control ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`} value={expenseName} onChange={(e) => setExpenseName(e.target.value)} placeholder="e.g. Water Pump Repairing" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-uppercase">Add amount</label>
                                        <input type="number" className={`form-control ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`} value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="e.g. 1200" min="1" required />
                                    </div>
                                </div>
                                <div className="modal-footer border-top border-opacity-25">
                                    <button type="button" className="btn btn-sm btn-secondary fw-bold px-3" onClick={() => setIsExpenseModalOpen(false)}>Discard</button>
                                    <button type="submit" className="btn btn-sm btn-danger fw-bold px-3 shadow-sm">Add Amount</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* BOOTSTRAP MODIFY PROFILE MODAL */}
            {isFlatEditModalOpen && (
                <div className="modal d-block position-fixed top-0 start-0 w-100 h-100 filter-dark-overlay" style={{ zIndex: 1060, overflowY: "auto" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className={`modal-content shadow-lg ${modalBgClass}`}>
                            <div className="modal-header border-bottom border-opacity-25">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-user-gear me-2 text-warning"></i>Modify Flat Member Information
                                </h5>
                                <button type="button" className={`btn-close ${isDarkMode ? "btn-close-white" : ""}`} onClick={() => setIsFlatEditModalOpen(false)}></button>
                            </div>
                            <form onSubmit={handleSubmitFlatEdit}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-uppercase">Flat Number</label>
                                        <input type="text" className={`form-select font-monospace fw-bold bg-opacity-10 ${isDarkMode ? "bg-secondary text-white border-secondary" : "bg-secondary text-dark"}`} value={`Flat - ${formFlatNoEdit}`} disabled />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-uppercase">Full Name</label>
                                        <input type="text" className={`form-control ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`} value={formOwnerNameEdit} onChange={(e) => setFormOwnerNameEdit(e.target.value)} placeholder="Enter owner full name" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-uppercase">Contact Number</label>
                                        <input type="tel" className={`form-control font-monospace ${isDarkMode ? "bg-dark text-white border-secondary" : ""}`} value={formContactNoEdit} onChange={(e) => setFormContactNoEdit(e.target.value)} placeholder="Enter contact mobile number" pattern="[0-9]{10}" title="Please enter a valid 10-digit mobile number" required />
                                    </div>
                                </div>
                                <div className="modal-footer border-top border-opacity-25">
                                    <button type="button" className="btn btn-sm btn-secondary fw-bold px-3" onClick={() => setIsFlatEditModalOpen(false)}>Discard</button>
                                    <button type="submit" className="btn btn-sm btn-warning fw-bold px-3 shadow-sm text-dark">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}