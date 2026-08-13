import { useMemo, useState } from 'react';
import {
    filterPipelineItems,
    getEventPipelinesForDate,
    getItemsByDate,
    makeRequest,
} from '../services/lacrmApi';
import { AZ_CITIES, SALESMEN } from '../data';
import styles from './Reports.module.css';

const DAILY_PIPELINE_ID = '3533819624848357990560426858357';

const getTodayLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toNumber = (value) => {
    const parsed = Number(String(value || '').replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const toUsDate = (isoDate) => {
    if (!isoDate || !isoDate.includes('-')) return isoDate;
    const [year, month, day] = isoDate.split('-');
    return `${Number(month)}/${Number(day)}/${year}`;
};

const toUsDatePadded = (isoDate) => {
    if (!isoDate || !isoDate.includes('-')) return isoDate;
    const [year, month, day] = isoDate.split('-');
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
};

const toUsDateShort = (isoDate) => {
    if (!isoDate || !isoDate.includes('-')) return isoDate;
    const [year, month, day] = isoDate.split('-');
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`;
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
};

const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;

const getStatusName = (item) => {
    if (item?.StatusMetaData && typeof item.StatusMetaData === 'object') {
        return item.StatusMetaData.Name || '';
    }

    return item?.StatusMetaData || '';
};

const isSaleWon = (item) => {
    return String(getStatusName(item)).toLowerCase().includes('sale won');
};

const isCancelledLead = (item) => {
    return String(getStatusName(item)).toLowerCase().includes('cancel');
};

const getNextDay = (isoDate) => {
    const date = new Date(isoDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
};

const getDateVariants = (isoDate) => {
    return [...new Set([isoDate, toUsDate(isoDate), toUsDatePadded(isoDate)])];
};

const getExclusiveEndDate = (isoDate) => {
    const date = new Date(isoDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
};

const isDateInRange = (value, start, endExclusive) => {
    return Boolean(value && value >= start && value < endExclusive);
};

const isInRangeByAppointmentOrSaleDate = (item, start, endExclusive) => {
    const appointmentDate = normalizeDate(item['Appointment Date']);
    const saleDate = normalizeDate(item['Sale Date']);

    return isDateInRange(appointmentDate, start, endExclusive)
        || isDateInRange(saleDate, start, endExclusive);
};

const normalizeDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const mainDate = raw.split('T')[0].split(' ')[0].trim();
    if (!mainDate) return '';

    if (mainDate.includes('-')) {
        const [year, month, day] = mainDate.split('-');
        if (year && month && day) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    if (mainDate.includes('/')) {
        const [month, day, year] = mainDate.split('/');
        if (year && month && day) {
            const normalizedYear = String(year).length === 2 ? `20${year}` : String(year);
            return `${normalizedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return '';
};

const getCustomerName = (item) => {
    if (item.contactName) return item.contactName;

    if (Array.isArray(item.ContactMetaData) && item.ContactMetaData[0]?.Name) {
        return item.ContactMetaData[0].Name;
    }

    if (item.ContactMetaData?.Name) return item.ContactMetaData.Name;
    if (item.Contact?.Name) return item.Contact.Name;

    return 'Unknown Customer';
};

const getTextField = (item, fieldNames) => {
    for (const fieldName of fieldNames) {
        const value = item?.[fieldName];

        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }

        if (value && typeof value === 'object') {
            const candidate = value.Name || value.Value || value.value || value.name;
            if (typeof candidate === 'string' && candidate.trim()) {
                return candidate.trim();
            }
        }
    }

    return '';
};

const getSalesRepName = (item) => {
    return getTextField(item, [
        'Sales Rep Assigned',
        'Customer Service Representative',
        'Salesman',
        'Sales Rep',
    ]) || 'Unassigned';
};

const normalizeRepKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeLocationKey = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');

const AZ_CITY_LOOKUP = new Set(
    AZ_CITIES.list
        .map((option) => normalizeLocationKey(option?.value || option?.name))
        .filter(Boolean)
);

const SALESMAN_AREA_LOOKUP = SALESMEN.list.reduce((acc, rep) => {
    const area = rep.region === 'AZ' ? 'AZ' : rep.subregion || 'CC';
    const names = [rep.name, rep.value];

    names.forEach((name) => {
        const key = normalizeRepKey(name);
        if (key) {
            acc[key] = area;
        }
    });

    return acc;
}, {});

const getAreaForSalesRep = (salesRep) => {
    const normalized = normalizeRepKey(salesRep);
    const exact = SALESMAN_AREA_LOOKUP[normalized];
    if (exact) return exact;

    const aliasChecks = [
        { match: ['sal'], area: 'SC' },
        { match: ['zac'], area: 'SC' },
        { match: ['dave'], area: 'NC' },
        { match: ['nickb', 'bennett'], area: 'NC' },
        { match: ['chris', 'payne'], area: 'AZ' },
        { match: ['nickm', 'mackenzie'], area: 'AZ' },
    ];

    for (const alias of aliasChecks) {
        if (alias.match.some((value) => normalized.includes(value))) {
            return alias.area;
        }
    }

    return 'CC';
};

const getCityStateZipText = (item) => {
    const candidateValues = [
        item?.['City, State & Zip'],
        item?.['City, State, & Zip'],
        item?.['City, State, Zip'],
        item?.CityStateZip,
        item?.cityStateZip,
    ];

    for (const candidate of candidateValues) {
        if (!candidate) continue;

        if (typeof candidate === 'string') {
            return candidate.trim();
        }

        if (typeof candidate === 'object') {
            const value = candidate.Name || candidate.Value || candidate.value || candidate.name;
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
    }

    return '';
};

const getAreaFromLocation = (item) => {
    const cityStateZip = getCityStateZipText(item);
    if (!cityStateZip) return '';

    const normalizedLocation = cityStateZip.toLowerCase();
    if (/[,\s]az(?:\s|$)/i.test(cityStateZip) || normalizedLocation.includes(', az')) {
        return 'AZ';
    }

    const city = cityStateZip.split(',')[0]?.trim() || '';
    if (city && AZ_CITY_LOOKUP.has(normalizeLocationKey(city))) {
        return 'AZ';
    }

    return '';
};

const getAreaForItem = (item) => {
    const salesRep = getSalesRepName(item);
    const salesRepArea = getAreaForSalesRep(salesRep);
    const locationArea = getAreaFromLocation(item);

    if (locationArea === 'AZ') {
        return 'AZ';
    }

    if (normalizeRepKey(salesRep).includes('dom')) {
        return 'SC';
    }

    return salesRepArea;
};

const getAmountFromAnyMatchingKey = (item) => {
    if (!item || typeof item !== 'object') return 0;

    for (const [key, rawValue] of Object.entries(item)) {
        const normalizedKey = String(key || '').toLowerCase();
        const looksLikeSaleAmount =
            (normalizedKey.includes('sale') && normalizedKey.includes('amount')) ||
            (normalizedKey.includes('approved') && normalizedKey.includes('amount')) ||
            (normalizedKey.includes('contract') && normalizedKey.includes('amount'));

        if (!looksLikeSaleAmount) continue;

        let candidate = rawValue;
        if (candidate && typeof candidate === 'object') {
            candidate = candidate.Name || candidate.Value || candidate.value || candidate.name;
        }

        const amount = toNumber(candidate);
        if (amount > 0) return amount;
    }

    return 0;
};

const getSaleAmount = (item) => {
    // Primary source: exact Sale Amount field from the sold pipeline item.
    const saleAmount = toNumber(getTextField(item, ['Sale Amount', 'Sale amount']));
    if (saleAmount > 0) return saleAmount;

    const approvedAmount = toNumber(getTextField(item, ['Approved Amount']));
    if (approvedAmount > 0) return approvedAmount;

    const fuzzyAmount = getAmountFromAnyMatchingKey(item);
    if (fuzzyAmount > 0) return fuzzyAmount;

    return 0;
};

const isSameReportDate = (item, reportDate) => {
    const saleDate = normalizeDate(item['Sale Date']);
    if (saleDate) {
        return saleDate === reportDate;
    }

    const appointmentDate = normalizeDate(item['Appointment Date']);
    return appointmentDate === reportDate;
};

const isLikelySaleRecord = (item) => {
    const amount = getSaleAmount(item);
    return amount > 0 || isSaleWon(item) || isCancelledLead(item);
};

const getRowId = (item) => {
    return item.PipelineItemId || `${item.ContactId || ''}-${item['Sale Date'] || ''}-${item['Appointment Date'] || ''}`;
};

const getDateRangeDays = (startDate, endDate) => {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate || startDate);

    if (!start || !end) {
        return [];
    }

    const days = [];
    const cursor = new Date(start);
    const endBoundary = new Date(getExclusiveEndDate(end));

    while (cursor < endBoundary) {
        days.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
    }

    return days;
};

const shiftDateByYears = (isoDate, yearOffset) => {
    const normalized = normalizeDate(isoDate);
    if (!normalized) return '';

    const [year, month, day] = normalized.split('-').map(Number);
    const shiftedYear = year + yearOffset;
    const lastDayOfMonth = new Date(shiftedYear, month, 0).getDate();
    const shiftedDay = Math.min(day, lastDayOfMonth);

    return `${shiftedYear}-${String(month).padStart(2, '0')}-${String(shiftedDay).padStart(2, '0')}`;
};

const getYearComparisonRanges = (startDate, endDate, previousYears = 2) => {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate || startDate);

    if (!start || !end) {
        return [];
    }

    return Array.from({ length: previousYears + 1 }, (_, index) => {
        const offset = -index;

        return {
            year: Number(start.slice(0, 4)) + offset,
            start: shiftDateByYears(start, offset),
            end: shiftDateByYears(end, offset),
        };
    });
};


const createEmptySummary = () => ({
    writtenQty: 0,
    writtenAmount: 0,
    cancelledQty: 0,
    cancelledAmount: 0,
    nonCancelledQty: 0,
    nonCancelledAmount: 0,
});

const buildSummaryRows = (records, keyField, preferredOrder = []) => {
    const grouped = new Map();

    records.forEach((record) => {
        const key = record[keyField] || 'Unassigned';
        if (!grouped.has(key)) {
            grouped.set(key, createEmptySummary());
        }

        const summary = grouped.get(key);
        summary.writtenQty += 1;
        summary.writtenAmount += record.amount;

        if (record.isCancelled) {
            summary.cancelledQty += 1;
            summary.cancelledAmount += record.amount;
        } else {
            summary.nonCancelledQty += 1;
            summary.nonCancelledAmount += record.amount;
        }
    });

    const rows = Array.from(grouped.entries()).map(([key, summary]) => {
        const avgNonCancelled = summary.nonCancelledQty > 0
            ? summary.nonCancelledAmount / summary.nonCancelledQty
            : 0;

        const qtyCancelledPercent = summary.writtenQty > 0
            ? summary.cancelledQty / summary.writtenQty
            : 0;

        const revenueCancelledPercent = summary.writtenAmount > 0
            ? summary.cancelledAmount / summary.writtenAmount
            : 0;

        return {
            key,
            ...summary,
            avgNonCancelled,
            qtyCancelledPercent,
            revenueCancelledPercent,
        };
    });

    if (preferredOrder.length > 0) {
        const orderIndex = preferredOrder.reduce((acc, item, index) => {
            acc[item] = index;
            return acc;
        }, {});

        rows.sort((a, b) => {
            const aOrder = orderIndex[a.key];
            const bOrder = orderIndex[b.key];

            if (aOrder !== undefined || bOrder !== undefined) {
                return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
            }

            return b.writtenAmount - a.writtenAmount;
        });

        preferredOrder.forEach((key) => {
            if (!rows.some((row) => row.key === key)) {
                rows.push({
                    key,
                    ...createEmptySummary(),
                    avgNonCancelled: 0,
                    qtyCancelledPercent: 0,
                    revenueCancelledPercent: 0,
                });
            }
        });

        return rows;
    }

    return rows.sort((a, b) => b.writtenAmount - a.writtenAmount);
};

export default function Reports() {
    const [activeSection, setActiveSection] = useState('barGraph');
    const [compareMode, setCompareMode] = useState('salesman');
    const [barGraphStartDate, setBarGraphStartDate] = useState(getTodayLocalDate());
    const [barGraphEndDate, setBarGraphEndDate] = useState('');
    const [spreadsheetStartDate, setSpreadsheetStartDate] = useState(getTodayLocalDate());
    const [spreadsheetEndDate, setSpreadsheetEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [barGraphRows, setBarGraphRows] = useState([]);
    const [companyYearComparison, setCompanyYearComparison] = useState([]);
    const [spreadsheetRows, setSpreadsheetRows] = useState([]);

    const mapSaleRow = (item) => ({
        id: getRowId(item),
        customer: getCustomerName(item),
        salesRep: getSalesRepName(item),
        region: getAreaForItem(item),
        saleDate: normalizeDate(item['Sale Date']) || normalizeDate(item['Appointment Date']),
        amount: getSaleAmount(item),
        isCancelled: isCancelledLead(item),
    });

    const fetchPipelineItemsForDate = async (targetDate) => {
        const dateVariants = getDateVariants(targetDate);

        const variantResults = await Promise.allSettled(
            dateVariants.map((dateValue) => getItemsByDate(DAILY_PIPELINE_ID, dateValue))
        );

        const mergedById = new Map();
        variantResults.forEach((result) => {
            if (result.status !== 'fulfilled') return;

            result.value.forEach((item) => {
                const id = getRowId(item);
                if (!mergedById.has(id)) {
                    mergedById.set(id, item);
                }
            });
        });

        let pipelineItems = Array.from(mergedById.values());

        if (pipelineItems.length === 0) {
            const allItemsResponse = await makeRequest('GetPipelineItems', {
                PipelineId: DAILY_PIPELINE_ID,
            });

            const allItems = filterPipelineItems(allItemsResponse.Results || []);
            pipelineItems = allItems.filter((item) => isSameReportDate(item, targetDate));
        }

        if (pipelineItems.length === 0) {
            const eventPipelines = await getEventPipelinesForDate(
                DAILY_PIPELINE_ID,
                targetDate,
                getNextDay(targetDate)
            );
            pipelineItems = eventPipelines.filter((item) => isSameReportDate(item, targetDate));
        }

        return pipelineItems;
    };

    const fetchPipelineItemsForRange = async (startDate, endDate) => {
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate || startDate);

        if (!start || !end) {
            return [];
        }

        const mergedById = new Map();
        const cursor = new Date(start);
        const endBoundary = new Date(getExclusiveEndDate(end));

        while (cursor < endBoundary) {
            const day = cursor.toISOString().split('T')[0];
            const nextDay = getExclusiveEndDate(day);
            const dayItems = await getEventPipelinesForDate(DAILY_PIPELINE_ID, day, nextDay);

            dayItems.forEach((item) => {
                const id = getRowId(item);
                if (!mergedById.has(id)) {
                    mergedById.set(id, item);
                }
            });

            cursor.setDate(cursor.getDate() + 1);
        }

        const allItemsResponse = await makeRequest('GetPipelineItems', {
            PipelineId: DAILY_PIPELINE_ID,
        });

        const directRangeItems = filterPipelineItems(allItemsResponse.Results || [])
            .filter((item) => isInRangeByAppointmentOrSaleDate(item, start, getExclusiveEndDate(end)));

        directRangeItems.forEach((item) => {
            const id = getRowId(item);
            if (!mergedById.has(id)) {
                mergedById.set(id, item);
            }
        });

        return Array.from(mergedById.values());
    };

    const loadBarGraphReport = async () => {
        setLoading(true);
        setError('');

        try {
            const start = normalizeDate(barGraphStartDate);
            const end = normalizeDate(barGraphEndDate || barGraphStartDate);

            if (!start || !end) {
                throw new Error('Please select a valid date range.');
            }

            const pipelineItems = await fetchPipelineItemsForRange(start, end);

            const rows = pipelineItems
                .filter((item) => isInRangeByAppointmentOrSaleDate(item, start, getExclusiveEndDate(end)))
                .filter(isLikelySaleRecord)
                .map(mapSaleRow)
                .sort((a, b) => {
                    const dateA = a.saleDate || '';
                    const dateB = b.saleDate || '';

                    if (dateA !== dateB) {
                        return dateB.localeCompare(dateA);
                    }

                    return b.amount - a.amount;
                });

            setBarGraphRows(rows);

            if (activeSection === 'lineGraph' && compareMode === 'companyYear') {
                const yearRanges = getYearComparisonRanges(start, end, 2);

                const comparisonRows = await Promise.all(
                    yearRanges.map(async (range) => {
                        const rangeItems = await fetchPipelineItemsForRange(range.start, range.end);
                        const rangeRows = rangeItems
                            .filter((item) => isInRangeByAppointmentOrSaleDate(item, range.start, getExclusiveEndDate(range.end)))
                            .filter(isLikelySaleRecord)
                            .map(mapSaleRow)
                            .sort((a, b) => {
                                const dateA = a.saleDate || '';
                                const dateB = b.saleDate || '';

                                if (dateA !== dateB) {
                                    return dateB.localeCompare(dateA);
                                }

                                return b.amount - a.amount;
                            });

                        return {
                            year: String(range.year),
                            startDate: range.start,
                            endDate: range.end,
                            rows: rangeRows,
                        };
                    })
                );

                setCompanyYearComparison(comparisonRows);
            } else {
                setCompanyYearComparison([]);
            }
        } catch (fetchError) {
            setError(fetchError.message || 'Failed to load bar graph report');
            setCompanyYearComparison([]);
        } finally {
            setLoading(false);
        }
    };

    const loadSpreadsheetReport = async () => {
        setLoading(true);
        setError('');

        try {
            const start = normalizeDate(spreadsheetStartDate);
            const end = normalizeDate(spreadsheetEndDate || spreadsheetStartDate);

            if (!start || !end) {
                throw new Error('Please select a valid date range.');
            }

            const pipelineItems = await fetchPipelineItemsForRange(start, end);

            const mappedRows = Array.from(pipelineItems)
                .map((item) => {
                    const appointmentDate = normalizeDate(item['Appointment Date']);
                    const saleDate = normalizeDate(item['Sale Date']);

                    const dateValue = isDateInRange(appointmentDate, start, getExclusiveEndDate(end))
                        ? appointmentDate
                        : saleDate;
                    const statusLabel = String(getStatusName(item) || '').trim();
                    const statusName = statusLabel.toLowerCase();
                    const isCancelled = statusName.includes('cancel');
                    const isSold = statusName.includes('sale won');
                    const salesRep = getSalesRepName(item);
                    const amount = getSaleAmount(item);

                    return {
                        id: getRowId(item),
                        contactName: getCustomerName(item),
                        dateValue,
                        isWritten: isCancelled || isSold,
                        isCancelled,
                        isSold,
                        statusLabel,
                        salesRep,
                        area: getAreaForItem(item),
                        amount,
                        appointmentDate,
                        saleDate,
                    };
                })
                .filter((row) => isDateInRange(row.appointmentDate, start, getExclusiveEndDate(end)) || isDateInRange(row.saleDate, start, getExclusiveEndDate(end)));

            const writtenRows = mappedRows.filter((row) => row.isWritten);

            const deduped = new Map();
            writtenRows.forEach((row) => {
                if (!deduped.has(row.id)) {
                    deduped.set(row.id, row);
                }
            });

            setSpreadsheetRows(Array.from(deduped.values()));
        } catch (fetchError) {
            setError(fetchError.message || 'Failed to load spreadsheet report');
            setSpreadsheetRows([]);
        } finally {
            setLoading(false);
        }
    };

    const totals = useMemo(() => {
        const totalAmount = barGraphRows.reduce((sum, row) => sum + row.amount, 0);
        const count = barGraphRows.length;

        const groupedSales = barGraphRows.reduce((acc, row) => {
            const groupName = compareMode === 'region' ? (row.region || 'CC') : row.salesRep;

            if (!acc[groupName]) {
                acc[groupName] = {
                    salesQty: 0,
                    salesAmount: 0,
                    nonCancelledQty: 0,
                    nonCancelledAmount: 0,
                    cancelledQty: 0,
                    cancelledAmount: 0,
                };
            }

            acc[groupName].salesQty += 1;
            acc[groupName].salesAmount += row.amount;

            if (row.isCancelled) {
                acc[groupName].cancelledQty += 1;
                acc[groupName].cancelledAmount += row.amount;
            } else {
                acc[groupName].nonCancelledQty += 1;
                acc[groupName].nonCancelledAmount += row.amount;
            }

            return acc;
        }, {});

        const repSeries = Object.entries(groupedSales)
            .map(([label, stats]) => ({ label, ...stats }))
            .sort((a, b) => b.salesAmount - a.salesAmount);

        const maxAmount = repSeries.length ? Math.max(...repSeries.map((entry) => entry.salesAmount)) : 0;

        return {
            totalAmount,
            count,
            averageAmount: count ? totalAmount / count : 0,
            repSeries,
            maxAmount,
            groupLabel: compareMode === 'region' ? 'Region' : 'Salesman',
        };
    }, [barGraphRows, compareMode]);

    const lineGraph = useMemo(() => {
        const days = getDateRangeDays(barGraphStartDate, barGraphEndDate || barGraphStartDate);
        const palette = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569'];

        if (compareMode === 'companyYear') {
            const series = companyYearComparison
                .map((entry, index) => {
                    const dailySales = new Map();
                    entry.rows.forEach((row) => {
                        if (!row.saleDate) return;
                        dailySales.set(row.saleDate, (dailySales.get(row.saleDate) || 0) + row.amount);
                    });

                    const rangeDays = getDateRangeDays(entry.startDate, entry.endDate);
                    let runningTotal = 0;
                    const points = days.map((day, pointIndex) => {
                        const actualDay = rangeDays[pointIndex] || '';
                        runningTotal += actualDay ? (dailySales.get(actualDay) || 0) : 0;

                        return {
                            day,
                            actualDay,
                            value: runningTotal,
                        };
                    });

                    return {
                        label: entry.year,
                        color: palette[index % palette.length],
                        points,
                        finalValue: runningTotal,
                    };
                })
                .sort((a, b) => Number(b.label) - Number(a.label));

            const maxValue = series.length
                ? Math.max(...series.map((entry) => Math.max(...entry.points.map((point) => point.value), 0)))
                : 0;

            return {
                days,
                series,
                maxValue,
                title: 'Sales by Year',
            };
        }

        const groupedDailySales = new Map();

        barGraphRows.forEach((row) => {
            const groupName = compareMode === 'region' ? (row.region || 'CC') : row.salesRep;
            const day = row.saleDate;

            if (!day) return;

            if (!groupedDailySales.has(groupName)) {
                groupedDailySales.set(groupName, new Map());
            }

            const dailySales = groupedDailySales.get(groupName);
            dailySales.set(day, (dailySales.get(day) || 0) + row.amount);
        });

        const series = Array.from(groupedDailySales.entries())
            .map(([label, dailySales], index) => {
                let runningTotal = 0;
                const points = days.map((day) => {
                    runningTotal += dailySales.get(day) || 0;
                    return {
                        day,
                        value: runningTotal,
                    };
                });

                return {
                    label,
                    color: palette[index % palette.length],
                    points,
                    finalValue: runningTotal,
                };
            })
            .sort((a, b) => b.finalValue - a.finalValue);

        const maxValue = series.length
            ? Math.max(...series.map((entry) => Math.max(...entry.points.map((point) => point.value), 0)))
            : 0;

        return {
            days,
            series,
            maxValue,
            title: `Sales by ${compareMode === 'region' ? 'Region' : 'Salesman'}`,
        };
    }, [barGraphRows, compareMode, barGraphStartDate, barGraphEndDate, companyYearComparison]);

    const companyYearSummary = useMemo(() => {
        return companyYearComparison
            .map((entry) => {
                const summary = createEmptySummary();

                entry.rows.forEach((row) => {
                    summary.writtenQty += 1;
                    summary.writtenAmount += row.amount;

                    if (row.isCancelled) {
                        summary.cancelledQty += 1;
                        summary.cancelledAmount += row.amount;
                    } else {
                        summary.nonCancelledQty += 1;
                        summary.nonCancelledAmount += row.amount;
                    }
                });

                return {
                    label: entry.year,
                    salesQty: summary.writtenQty,
                    salesAmount: summary.writtenAmount,
                    nonCancelledQty: summary.nonCancelledQty,
                    nonCancelledAmount: summary.nonCancelledAmount,
                    cancelledQty: summary.cancelledQty,
                    cancelledAmount: summary.cancelledAmount,
                };
            })
            .sort((a, b) => Number(b.label) - Number(a.label));
    }, [companyYearComparison]);

    const handleSectionChange = (nextSection) => {
        setActiveSection(nextSection);

        if (nextSection === 'barGraph' && compareMode === 'companyYear') {
            setCompareMode('salesman');
        }
    };

    const monthlyReport = useMemo(() => {
        const bySalesman = buildSummaryRows(spreadsheetRows, 'salesRep');
        const byArea = buildSummaryRows(spreadsheetRows, 'area', ['SC', 'NC', 'AZ', 'CC']);

        const company = spreadsheetRows.reduce((summary, row) => {
            summary.writtenQty += 1;
            summary.writtenAmount += row.amount;

            if (row.isCancelled) {
                summary.cancelledQty += 1;
                summary.cancelledAmount += row.amount;
            } else {
                summary.nonCancelledQty += 1;
                summary.nonCancelledAmount += row.amount;
            }

            return summary;
        }, createEmptySummary());

        const companyAvg = company.nonCancelledQty > 0 ? company.nonCancelledAmount / company.nonCancelledQty : 0;
        const companyQtyCancelledPercent = company.writtenQty > 0 ? company.cancelledQty / company.writtenQty : 0;
        const companyRevenueCancelledPercent = company.writtenAmount > 0 ? company.cancelledAmount / company.writtenAmount : 0;

        return {
            bySalesman,
            byArea,
            company: {
                ...company,
                avgNonCancelled: companyAvg,
                qtyCancelledPercent: companyQtyCancelledPercent,
                revenueCancelledPercent: companyRevenueCancelledPercent,
            },
        };
    }, [spreadsheetRows]);

    return (
        <div className={styles.container}>
            <h2 className={styles.pageTitle}>Reports</h2>

            <div className={styles.sections}>
                <section className={`${styles.sectionCard} ${styles.reportPanel} ${activeSection === 'barGraph' ? styles.visible : ''}`}>
                    <div className={styles.sectionHeader}>
                        <select
                            className={styles.graphTypeSelect}
                            value={activeSection}
                            onChange={(event) => handleSectionChange(event.target.value)}
                            aria-label="Graph type"
                        >
                            <option value="barGraph">Bar Graph</option>
                            <option value="lineGraph">Line Graph</option>
                        </select>
                        <div className={styles.controls}>
                            <label className={styles.dateLabel}>
                                <span>From:</span>
                                <input
                                    type="date"
                                    value={barGraphStartDate}
                                    onChange={(event) => setBarGraphStartDate(event.target.value)}
                                />
                            </label>
                            <label className={styles.dateLabel}>
                                <span>To:</span>
                                <input
                                    type="date"
                                    value={barGraphEndDate}
                                    onChange={(event) => setBarGraphEndDate(event.target.value)}
                                    placeholder="End Date (Optional)"
                                    title="Optional - leave blank for single day"
                                />
                            </label>
                            <label className={styles.filterLabel}>
                                <span>Filter by:</span>
                                <select
                                    value={compareMode}
                                    onChange={(event) => setCompareMode(event.target.value)}
                                >
                                    <option value="salesman">Salesman</option>
                                    <option value="region">Region</option>
                                </select>
                            </label>
                            <button type="button" onClick={loadBarGraphReport} disabled={loading}>
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </div>

                    {error && <div className={styles.error}>Error: {error}</div>}

                    {!error && (
                        <>
                            <div className={styles.metrics}>
                                <div className={styles.metricTile}>
                                    <span className={styles.metricLabel}>Sales Count</span>
                                    <span className={styles.metricValue}>{totals.count}</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <span className={styles.metricLabel}>Total Revenue</span>
                                    <span className={styles.metricValue}>{formatCurrency(totals.totalAmount)}</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <span className={styles.metricLabel}>Average Sale</span>
                                    <span className={styles.metricValue}>{formatCurrency(totals.averageAmount)}</span>
                                </div>
                            </div>

                            <div className={styles.chartCard}>
                                <div className={styles.chartTitle}>
                                    {activeSection === 'lineGraph'
                                        ? lineGraph.title
                                        : `Sales by ${totals.groupLabel}`}
                                </div>
                                {totals.repSeries.length === 0 ? (
                                    <div className={styles.emptyState}>No sold pipeline items found for this range.</div>
                                ) : activeSection === 'lineGraph' ? (
                                    <div className={styles.lineChartContainer}>
                                        <svg
                                            className={styles.lineChart}
                                            viewBox="0 0 760 260"
                                            role="img"
                                            aria-label={lineGraph.title}
                                        >
                                            <line x1="48" y1="16" x2="48" y2="220" className={styles.lineAxis} />
                                            <line x1="48" y1="220" x2="736" y2="220" className={styles.lineAxis} />
                                            {[0, 0.25, 0.5, 0.75, 1].map((tick, index) => {
                                                const y = 220 - (tick * 204);
                                                const value = lineGraph.maxValue * tick;

                                                return (
                                                    <g key={index}>
                                                        <line x1="48" y1={y} x2="736" y2={y} className={styles.lineGrid} />
                                                        <text x="40" y={y + 4} textAnchor="end" className={styles.lineAxisText}>
                                                            {value > 0 ? formatCurrency(value) : '$0'}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                            {lineGraph.days.map((day, index) => {
                                                const x = lineGraph.days.length > 1
                                                    ? 48 + ((688 / (lineGraph.days.length - 1)) * index)
                                                    : 392;
                                                const labelStep = lineGraph.days.length > 8
                                                    ? Math.ceil(lineGraph.days.length / 8)
                                                    : 1;

                                                if (index % labelStep !== 0 && index !== lineGraph.days.length - 1) {
                                                    return null;
                                                }

                                                return (
                                                    <text key={day} x={x} y="242" textAnchor="middle" className={styles.lineAxisText}>
                                                        {toUsDateShort(day)}
                                                    </text>
                                                );
                                            })}
                                            {lineGraph.series.map((entry) => {
                                                const points = entry.points.map((point, index) => {
                                                    const x = lineGraph.days.length > 1
                                                        ? 48 + ((688 / (lineGraph.days.length - 1)) * index)
                                                        : 392;
                                                    const y = lineGraph.maxValue > 0
                                                        ? 220 - ((point.value / lineGraph.maxValue) * 204)
                                                        : 220;

                                                    return `${x},${y}`;
                                                }).join(' ');

                                                return (
                                                    <g key={entry.label}>
                                                        <polyline
                                                            fill="none"
                                                            stroke={entry.color}
                                                            strokeWidth="3"
                                                            points={points}
                                                            className={styles.lineSeries}
                                                        />
                                                        {entry.points.map((point, index) => {
                                                            const x = lineGraph.days.length > 1
                                                                ? 48 + ((688 / (lineGraph.days.length - 1)) * index)
                                                                : 392;
                                                            const y = lineGraph.maxValue > 0
                                                                ? 220 - ((point.value / lineGraph.maxValue) * 204)
                                                                : 220;

                                                            return (
                                                                <circle
                                                                    key={`${entry.label}-${point.day}`}
                                                                    cx={x}
                                                                    cy={y}
                                                                    r="3.5"
                                                                    fill={entry.color}
                                                                >
                                                                    <title>{`${entry.label} ${toUsDateShort(point.day)}: ${formatCurrency(point.value)}`}</title>
                                                                </circle>
                                                            );
                                                        })}
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                        <div className={styles.lineLegend}>
                                            {lineGraph.series.map((entry) => (
                                                <div key={entry.label} className={styles.lineLegendItem}>
                                                    <div className={styles.lineLegendKey}>
                                                        <span
                                                            className={styles.lineLegendSwatch}
                                                            style={{ backgroundColor: entry.color }}
                                                        />
                                                        <span className={styles.lineLegendLabel}>{entry.label}</span>
                                                    </div>
                                                    <span className={styles.lineLegendValue}>{formatCurrency(entry.finalValue)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.chartArea}>
                                        <div className={styles.chartGrid}>
                                            {totals.repSeries.map((entry) => {
                                                const totalAmount = entry.salesAmount || 0;
                                                const nonCancelledHeightPercent = totalAmount > 0
                                                    ? (entry.nonCancelledAmount / totalAmount) * 100
                                                    : 0;
                                                const cancelledHeightPercent = totalAmount > 0
                                                    ? (entry.cancelledAmount / totalAmount) * 100
                                                    : 0;
                                                const barHeightPercent = totals.maxAmount > 0
                                                    ? Math.max(8, (totalAmount / totals.maxAmount) * 100)
                                                    : 0;

                                                return (
                                                    <div key={entry.label} className={styles.barGroup}>
                                                        <div className={styles.barValue}>{formatCurrency(totalAmount)}</div>
                                                        <div className={styles.barTrack}>
                                                            <div className={styles.barStack} style={{ height: `${barHeightPercent}%` }}>
                                                                <div
                                                                    className={styles.barSegment}
                                                                    style={{ height: `${nonCancelledHeightPercent}%` }}
                                                                    title={`${entry.label}: ${formatCurrency(entry.nonCancelledAmount)} non-cancelled`}
                                                                />
                                                                {entry.cancelledAmount > 0 && (
                                                                    <div
                                                                        className={`${styles.barSegment} ${styles.barSegmentCancelled}`}
                                                                        style={{ height: `${cancelledHeightPercent}%` }}
                                                                        title={`${entry.label}: ${formatCurrency(entry.cancelledAmount)} cancelled`}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className={styles.barLabel}>{entry.label}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {totals.repSeries.length > 0 && (
                                <div className={styles.repSummary}>
                                    <h4>Summary</h4>
                                    <table className={`${styles.repSummaryTable} ${styles.dailyRepSummaryTable}`}>
                                        <thead>
                                            <tr className={styles.groupHeaderRow}>
                                                <th rowSpan="2">{totals.groupLabel}</th>
                                                <th colSpan="2">Non-Cancelled</th>
                                                <th colSpan="2">Cancelled</th>
                                                <th colSpan="2">Total</th>
                                            </tr>
                                            <tr className={styles.subHeaderRow}>
                                                <th>QTY</th>
                                                <th>AMT</th>
                                                <th>QTY</th>
                                                <th>AMT</th>
                                                <th>QTY</th>
                                                <th>AMT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {totals.repSeries.map((entry) => {
                                                return (
                                                    <tr key={entry.label}>
                                                        <td>{entry.label}</td>
                                                        <td>{entry.nonCancelledQty}</td>
                                                        <td>{formatCurrency(entry.nonCancelledAmount)}</td>
                                                        <td className={styles.cancelledMetric}>{entry.cancelledQty}</td>
                                                        <td className={styles.cancelledMetric}>{formatCurrency(entry.cancelledAmount)}</td>
                                                        <td>{entry.salesQty}</td>
                                                        <td>{formatCurrency(entry.salesAmount)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {barGraphRows.length > 0 && (
                                <div className={styles.logCard}>
                                    <h4 className={styles.logTitle}>Sales Log</h4>
                                    <div className={styles.tableWrapper}>
                                        <table className={`${styles.reportTable} ${styles.dailyReportTable}`}>
                                            <thead>
                                                <tr>
                                                    <th>Customer</th>
                                                    <th>Sales Rep</th>
                                                    <th>Sale Date</th>
                                                    <th>Sale Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {barGraphRows.map((row) => (
                                                    <tr key={row.id} className={row.isCancelled ? styles.cancelledRow : ''}>
                                                        <td>{row.customer}</td>
                                                        <td>{row.salesRep}</td>
                                                        <td>{row.saleDate ? toUsDateShort(row.saleDate) : '-'}</td>
                                                        <td>{formatCurrency(row.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>

                <section className={`${styles.sectionCard} ${styles.reportPanel} ${activeSection === 'lineGraph' ? styles.visible : ''}`}>
                    <div className={styles.sectionHeader}>
                        <select
                            className={styles.graphTypeSelect}
                            value={activeSection}
                            onChange={(event) => handleSectionChange(event.target.value)}
                            aria-label="Graph type"
                        >
                            <option value="barGraph">Bar Graph</option>
                            <option value="lineGraph">Line Graph</option>
                        </select>
                        <div className={styles.controls}>
                            <label className={styles.dateLabel}>
                                <span>From:</span>
                                <input
                                    type="date"
                                    value={barGraphStartDate}
                                    onChange={(event) => setBarGraphStartDate(event.target.value)}
                                />
                            </label>
                            <label className={styles.dateLabel}>
                                <span>To:</span>
                                <input
                                    type="date"
                                    value={barGraphEndDate}
                                    onChange={(event) => setBarGraphEndDate(event.target.value)}
                                    placeholder="End Date (Optional)"
                                    title="Optional - leave blank for single day"
                                />
                            </label>
                            <label className={styles.filterLabel}>
                                <span>Filter by:</span>
                                <select
                                    value={compareMode}
                                    onChange={(event) => setCompareMode(event.target.value)}
                                >
                                    <option value="salesman">Salesman</option>
                                    <option value="region">Region</option>
                                    <option value="companyYear">Year</option>
                                </select>
                            </label>
                            <button type="button" onClick={loadBarGraphReport} disabled={loading}>
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </div>

                    {error && <div className={styles.error}>Error: {error}</div>}

                    {!error && (
                        <>
                            <div className={styles.metrics}>
                                <div className={styles.metricTile}>
                                    <span className={styles.metricLabel}>Sales Count</span>
                                    <span className={styles.metricValue}>{totals.count}</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <span className={styles.metricLabel}>Total Revenue</span>
                                    <span className={styles.metricValue}>{formatCurrency(totals.totalAmount)}</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <span className={styles.metricLabel}>Average Sale</span>
                                    <span className={styles.metricValue}>{formatCurrency(totals.averageAmount)}</span>
                                </div>
                            </div>

                            <div className={styles.chartCard}>
                                <div className={styles.chartTitle}>{lineGraph.title}</div>
                                {totals.repSeries.length === 0 ? (
                                    <div className={styles.emptyState}>No sold pipeline items found for this range.</div>
                                ) : (
                                    <div className={styles.lineChartContainer}>
                                        <svg
                                            className={styles.lineChart}
                                            viewBox="0 0 760 260"
                                            role="img"
                                            aria-label={lineGraph.title}
                                        >
                                            <line x1="48" y1="16" x2="48" y2="220" className={styles.lineAxis} />
                                            <line x1="48" y1="220" x2="736" y2="220" className={styles.lineAxis} />
                                            {[0, 0.25, 0.5, 0.75, 1].map((tick, index) => {
                                                const y = 220 - (tick * 204);
                                                const value = lineGraph.maxValue * tick;

                                                return (
                                                    <g key={index}>
                                                        <line x1="48" y1={y} x2="736" y2={y} className={styles.lineGrid} />
                                                        <text x="40" y={y + 4} textAnchor="end" className={styles.lineAxisText}>
                                                            {value > 0 ? formatCurrency(value) : '$0'}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                            {lineGraph.days.map((day, index) => {
                                                const x = lineGraph.days.length > 1
                                                    ? 48 + ((688 / (lineGraph.days.length - 1)) * index)
                                                    : 392;
                                                const labelStep = lineGraph.days.length > 8
                                                    ? Math.ceil(lineGraph.days.length / 8)
                                                    : 1;

                                                if (index % labelStep !== 0 && index !== lineGraph.days.length - 1) {
                                                    return null;
                                                }

                                                return (
                                                    <text key={day} x={x} y="242" textAnchor="middle" className={styles.lineAxisText}>
                                                        {toUsDateShort(day)}
                                                    </text>
                                                );
                                            })}
                                            {lineGraph.series.map((entry) => {
                                                const points = entry.points.map((point, index) => {
                                                    const x = lineGraph.days.length > 1
                                                        ? 48 + ((688 / (lineGraph.days.length - 1)) * index)
                                                        : 392;
                                                    const y = lineGraph.maxValue > 0
                                                        ? 220 - ((point.value / lineGraph.maxValue) * 204)
                                                        : 220;

                                                    return `${x},${y}`;
                                                }).join(' ');

                                                return (
                                                    <g key={entry.label}>
                                                        <polyline
                                                            fill="none"
                                                            stroke={entry.color}
                                                            strokeWidth="3"
                                                            points={points}
                                                            className={styles.lineSeries}
                                                        />
                                                        {entry.points.map((point, index) => {
                                                            const x = lineGraph.days.length > 1
                                                                ? 48 + ((688 / (lineGraph.days.length - 1)) * index)
                                                                : 392;
                                                            const y = lineGraph.maxValue > 0
                                                                ? 220 - ((point.value / lineGraph.maxValue) * 204)
                                                                : 220;

                                                            return (
                                                                <circle
                                                                    key={`${entry.label}-${point.day}`}
                                                                    cx={x}
                                                                    cy={y}
                                                                    r="3.5"
                                                                    fill={entry.color}
                                                                >
                                                                    <title>{`${entry.label} ${toUsDateShort(point.actualDay || point.day)}: ${formatCurrency(point.value)}`}</title>
                                                                </circle>
                                                            );
                                                        })}
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                        <div className={styles.lineLegend}>
                                            {lineGraph.series.map((entry) => (
                                                <div key={entry.label} className={styles.lineLegendItem}>
                                                    <div className={styles.lineLegendKey}>
                                                        <span
                                                            className={styles.lineLegendSwatch}
                                                            style={{ backgroundColor: entry.color }}
                                                        />
                                                        <span className={styles.lineLegendLabel}>{entry.label}</span>
                                                    </div>
                                                    <span className={styles.lineLegendValue}>{formatCurrency(entry.finalValue)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {(compareMode === 'companyYear' ? companyYearSummary.length > 0 : totals.repSeries.length > 0) && (
                                <div className={styles.repSummary}>
                                    <h4>Summary</h4>
                                    <table className={`${styles.repSummaryTable} ${styles.dailyRepSummaryTable}`}>
                                        <thead>
                                            <tr className={styles.groupHeaderRow}>
                                                <th rowSpan="2">{compareMode === 'companyYear' ? 'Year' : totals.groupLabel}</th>
                                                <th colSpan="2">Non-Cancelled</th>
                                                <th colSpan="2">Cancelled</th>
                                                <th colSpan="2">Total</th>
                                            </tr>
                                            <tr className={styles.subHeaderRow}>
                                                <th>QTY</th>
                                                <th>AMT</th>
                                                <th>QTY</th>
                                                <th>AMT</th>
                                                <th>QTY</th>
                                                <th>AMT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(compareMode === 'companyYear' ? companyYearSummary : totals.repSeries).map((entry) => {
                                                return (
                                                    <tr key={entry.label}>
                                                        <td>{entry.label}</td>
                                                        <td>{entry.nonCancelledQty}</td>
                                                        <td>{formatCurrency(entry.nonCancelledAmount)}</td>
                                                        <td className={styles.cancelledMetric}>{entry.cancelledQty}</td>
                                                        <td className={styles.cancelledMetric}>{formatCurrency(entry.cancelledAmount)}</td>
                                                        <td>{entry.salesQty}</td>
                                                        <td>{formatCurrency(entry.salesAmount)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {compareMode !== 'companyYear' && barGraphRows.length > 0 && (
                                <div className={styles.logCard}>
                                    <h4 className={styles.logTitle}>Sales Log</h4>
                                    <div className={styles.tableWrapper}>
                                        <table className={`${styles.reportTable} ${styles.dailyReportTable}`}>
                                            <thead>
                                                <tr>
                                                    <th>Customer</th>
                                                    <th>Sales Rep</th>
                                                    <th>Sale Date</th>
                                                    <th>Sale Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {barGraphRows.map((row) => (
                                                    <tr key={row.id} className={row.isCancelled ? styles.cancelledRow : ''}>
                                                        <td>{row.customer}</td>
                                                        <td>{row.salesRep}</td>
                                                        <td>{row.saleDate ? toUsDateShort(row.saleDate) : '-'}</td>
                                                        <td>{formatCurrency(row.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>

            </div>
        </div>
    );
}
