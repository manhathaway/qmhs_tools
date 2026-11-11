import { useState, useEffect } from 'react';
import { getEventPipelinesForDate } from '../services/lacrmApi';
import { buildSaleEntryPrefill, canTransferLeadToSaleEntry, getStatusShortName } from '../leadTransfer';
import styles from './LeadsBoard.module.css';

const getTodayLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

export default function LeadsBoard({ onLeadSelect }) {
    const pipelineId = '3533819624848357990560426858357'; // Fixed pipeline ID
    const [startDate, setStartDate] = useState(getTodayLocalDate());
    const [endDate, setEndDate] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [updateTrigger, setUpdateTrigger] = useState(0);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedReps, setSelectedReps] = useState([]);
    const [showFilters, setShowFilters] = useState(false);

    // Update progress bars in real-time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setUpdateTrigger(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Fetch data for the selected date range.
    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const start = new Date(startDate);
            let end = new Date(start);

            // UI end date is inclusive; convert to an exclusive next-day boundary.
            if (endDate) {
                end = new Date(endDate);
                end.setDate(end.getDate() + 1);
            } else {
                end.setDate(end.getDate() + 1);
            }

            const endDateStr = end.toISOString().split('T')[0];

            // For ranges, fetch day-by-day and merge unique pipeline items.
            const isRange = Boolean(endDate);
            if (!isRange) {
                const result = await getEventPipelinesForDate(pipelineId, startDate, endDateStr);
                setItems(result);
                return;
            }

            const cursor = new Date(startDate);
            const endBoundary = new Date(endDateStr);
            const mergedById = new Map();

            while (cursor < endBoundary) {
                const dayStart = cursor.toISOString().split('T')[0];
                const nextDay = new Date(cursor);
                nextDay.setDate(nextDay.getDate() + 1);
                const dayEnd = nextDay.toISOString().split('T')[0];

                const dayItems = await getEventPipelinesForDate(pipelineId, dayStart, dayEnd);

                dayItems.forEach((item) => {
                    const id = item.PipelineItemId || `${item['Appointment Date'] || ''}-${item['Sale Date'] || ''}-${item.contactId || item.ContactId || ''}`;
                    if (!mergedById.has(id)) {
                        mergedById.set(id, item);
                    }
                });

                cursor.setDate(cursor.getDate() + 1);
            }

            setItems(Array.from(mergedById.values()));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Get unique statuses and sales reps for filter options
    const uniqueStatuses = [...new Set(items.map(item => {
        return getStatusShortName(item);
    }).filter(Boolean))].sort();

    const uniqueReps = [...new Set(items.map(item => item['Sales Rep Assigned']).filter(Boolean))].sort();

    // Filter items based on selected filters
    const filteredItems = items.filter(item => {
        const statusName = getStatusShortName(item);
        const rep = item['Sales Rep Assigned'];

        const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(statusName);
        const repMatch = selectedReps.length === 0 || selectedReps.includes(rep);

        return statusMatch && repMatch;
    });

    const toggleStatus = (status) => {
        setSelectedStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const toggleRep = (rep) => {
        setSelectedReps(prev =>
            prev.includes(rep)
                ? prev.filter(r => r !== rep)
                : [...prev, rep]
        );
    };

    const deriveCountsFromItems = (lead) => {
        const contactId = lead.contactId || lead.ContactId;
        const contactItems = contactId
            ? items.filter((item) => String(item.contactId || item.ContactId || '') === String(contactId))
            : items.filter((item) => String(item.contactName || '').trim() === String(lead.contactName || '').trim());

        const uniquePipelineIds = new Set();
        const uniqueSoldPipelineIds = new Set();

        contactItems.forEach((item) => {
            const itemId = item.PipelineItemId || `${item['Appointment Date'] || ''}-${item['Sale Date'] || ''}-${item.contactId || ''}`;
            uniquePipelineIds.add(itemId);

            if (getStatusShortName(item) === 'Sale Won') {
                uniqueSoldPipelineIds.add(itemId);
            }
        });

        return {
            contactPipelineCount: Number(uniquePipelineIds.size) || 0,
            contactSoldPipelineCount: Number(uniqueSoldPipelineIds.size) || 0,
        };
    };

    const transferLead = (lead) => {
        if (!canTransferLeadToSaleEntry(lead) || !onLeadSelect) return;

        const fallbackCounts = deriveCountsFromItems(lead);
        const leadWithCounts = {
            ...lead,
            contactPipelineCount: Number(lead.contactPipelineCount ?? fallbackCounts.contactPipelineCount) || 0,
            contactSoldPipelineCount: Number(lead.contactSoldPipelineCount ?? fallbackCounts.contactSoldPipelineCount) || 0,
        };

        const prefillData = buildSaleEntryPrefill(leadWithCounts);
        onLeadSelect(prefillData);
    };

    const handleLeadClick = (lead) => {
        transferLead(lead);
    };

    const handleContactClick = (lead, event) => {
        event.stopPropagation();

        const contactId = lead.contactId || lead.ContactId;
        if (!contactId) return;

        window.open(
            `https://account.lessannoyingcrm.com/app/View_Contact?ContactId=${contactId}`,
            `lacrm-contact-${contactId}`,
            'popup=yes,width=1200,height=850,left=120,top=80,resizable=yes,scrollbars=yes'
        );
    };

    const handleTransferClick = (lead, event) => {
        event.stopPropagation();
        transferLead(lead);
    };

    const formatTimeForRange = (value) => {
        if (!value) return '';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerRight}>
                    {loading && <div className={styles.spinner}></div>}
                </div>
                <div className={styles.headerLeft}>
                    <label className={styles.dateLabel}>
                        <span>From:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            placeholder="Start Date"
                        />
                    </label>
                    <label className={styles.dateLabel}>
                        <span>To:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            placeholder="End Date (Optional)"
                            title="Optional - leave blank for single day"
                        />
                    </label>
                    <button
                        className={styles.filterButton}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>
                    <button
                        className={styles.filterButton}
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className={styles.filterPanel}>
                    <div className={styles.filterSection}>
                        <div className={styles.filterTitle}>Statuses</div>
                        <div className={styles.filterOptions}>
                            {uniqueStatuses.map(status => (
                                <label key={status} className={styles.filterCheckbox}>
                                    <input
                                        type="checkbox"
                                        checked={selectedStatuses.includes(status)}
                                        onChange={() => toggleStatus(status)}
                                    />
                                    {status}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.filterSection}>
                        <div className={styles.filterTitle}>Sales Reps</div>
                        <div className={styles.filterOptions}>
                            {uniqueReps.map(rep => (
                                <label key={rep} className={styles.filterCheckbox}>
                                    <input
                                        type="checkbox"
                                        checked={selectedReps.includes(rep)}
                                        onChange={() => toggleRep(rep)}
                                    />
                                    {rep}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {error && <div className={styles.error}>Error: {error}</div>}

            {filteredItems.length > 0 && (
                <div className={styles.results}>
                    <h3>Results ({filteredItems.length} of {items.length} pipelines)</h3>
                    <div className={styles.itemsList}>
                        {filteredItems.sort((a, b) => {
                            // Sort by appointment date first
                            const dateA = a['Appointment Date'] ? new Date(a['Appointment Date']).getTime() : Infinity;
                            const dateB = b['Appointment Date'] ? new Date(b['Appointment Date']).getTime() : Infinity;
                            if (dateA !== dateB) {
                                return dateA - dateB;
                            }

                            // Then by event start time
                            const startA = a.eventStartTime ? new Date(a.eventStartTime).getTime() : Infinity;
                            const startB = b.eventStartTime ? new Date(b.eventStartTime).getTime() : Infinity;
                            if (startA !== startB) {
                                return startA - startB;
                            }

                            // Finally by event end time
                            const endA = a.eventEndTime ? new Date(a.eventEndTime).getTime() : Infinity;
                            const endB = b.eventEndTime ? new Date(b.eventEndTime).getTime() : Infinity;
                            return endA - endB;
                        }).map((item, idx) => {
                            const statusName = getStatusShortName(item);
                            let statusClass = '';
                            if (statusName === 'Sale Won') statusClass = styles.saleWon;
                            else if (statusName === 'Sale Lost' || statusName === 'Cancelled') statusClass = styles.saleLost;
                            else if (statusName === 'No-Pitch' || statusName === 'Left Bid' || statusName === 'Porched/No Show') statusClass = styles.noOptionOrLeftBid;
                            else if (statusName === 'Appointment Confirmed') statusClass = styles.appointmentConfirmed;

                            const canTransfer = canTransferLeadToSaleEntry(item);

                            // Calculate progress value for progress element (updates every second)
                            let progressValue = 100; // Default to 100 (solid) for non-Appointment Confirmed

                            // Only calculate time-based progress for "Appointment Confirmed" status
                            if (statusName === 'Appointment Confirmed' && item.eventStartTime && item.eventEndTime) {
                                const start = new Date(item.eventStartTime).getTime();
                                const end = new Date(item.eventEndTime).getTime();
                                const now = new Date().getTime();

                                if (now >= end) {
                                    progressValue = 100;
                                } else if (now >= start) {
                                    progressValue = Math.round(((now - start) / (end - start)) * 100);
                                } else {
                                    progressValue = 0;
                                }
                            }
                            // Use updateTrigger to ensure re-render every second for live updates
                            void updateTrigger;

                            return (
                                <div
                                    key={idx}
                                    className={`${styles.item} ${statusClass} ${canTransfer ? styles.clickableItem : ''}`}
                                    onClick={() => handleLeadClick(item)}
                                    onKeyDown={(e) => {
                                        if (!canTransfer) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleLeadClick(item);
                                        }
                                    }}
                                    role={canTransfer ? 'button' : undefined}
                                    tabIndex={canTransfer ? 0 : undefined}
                                    title={canTransfer ? 'Click to load into Sale Entry' : undefined}
                                >
                                    {(item.eventStartTime || item.eventEndTime) && (
                                        <div className={styles.progressDateRange}>
                                            {`${formatTimeForRange(item.eventStartTime) || '-'} - ${formatTimeForRange(item.eventEndTime) || '-'}`}
                                        </div>
                                    )}
                                    <progress className={styles.progress} value={progressValue} max="100"></progress>

                                    <div className={styles.itemContent}>
                                        {/* Left side - Contact and Sales Rep */}
                                        <div className={styles.leftColumn}>
                                            {item.contactName && <div className={styles.contactName}>{item.contactName}</div>}
                                            {item['Sales Rep Assigned'] && <div className={styles.salesRep}>{item['Sales Rep Assigned']}</div>}
                                        </div>

                                        {/* Right side - Lead Type and Lead Source */}
                                        <div className={styles.rightColumn}>
                                            {item['Lead Type'] && <div className={styles.leadType}>{item['Lead Type']}</div>}
                                            {item['Lead Source'] && <div className={styles.leadSource}>{item['Lead Source']}</div>}
                                        </div>
                                    </div>

                                    <div className={styles.itemFooter}>
                                        <div className={styles.footerLeft}>
                                            {item.StatusMetaData && <div className={styles.status}>{statusName}</div>}
                                        </div>

                                        <div className={styles.footerRight}>
                                            {item['Appointment Date'] && <div className={styles.date}>{item['Appointment Date']}</div>}
                                        </div>
                                    </div>

                                    <div className={styles.actions}>
                                        <button
                                            type="button"
                                            className={`${styles.actionButtonPrimary} ${statusClass}`}
                                            onClick={(event) => handleTransferClick(item, event)}
                                            disabled={!canTransfer || !onLeadSelect}
                                            title={canTransfer ? 'Copy data to Sale Entry' : 'Only Sale Won and Cancelled pipelines can transfer'}
                                        >
                                            Copy Data
                                        </button>

                                        <button
                                            type="button"
                                            className={`${styles.actionButtonSecondary} ${statusClass}`}
                                            onClick={(event) => handleContactClick(item, event)}
                                            disabled={!item.contactId && !item.ContactId}
                                            title={item.contactId || item.ContactId ? 'Open contact page' : 'Missing contact id'}
                                        >
                                            View Contact
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {items.length === 0 && !loading && !error && (
                <div className={styles.empty}>No pipelines found</div>
            )}

            {filteredItems.length === 0 && items.length > 0 && !loading && !error && (
                <div className={styles.empty}>No pipelines match the selected filters</div>
            )}
        </div>
    );
}
