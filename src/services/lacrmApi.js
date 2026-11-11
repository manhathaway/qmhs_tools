const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const PROXY_BASE_URL = `${API_BASE_URL}/api`;

const PIPELINE_ITEM_FIELDS = [
    'StatusMetaData',
    'ContactMetaData',
    'Contact',
    'Sale Date',
    'Sales Rep Assigned',
    'Sale Amount',
    'Customer Service Representative',
    'Appointment Date',
    'Deposit Amount',
    'Deposit Type',
    'Depost Type',
    'Finance Institution',
    'Approved Amount',
    'Lead Type',
    'Lead Source',
    'Description of Work',
    'Address',
    'Space #',
    'Space Number',
    'City, State & Zip',
    'Phone #',
    'PipelineItemId',
    'ContactId',
    'eventStartTime',
    'eventEndTime',
    'contactName',
    'contactId',
    'contactPipelineCount',
    'contactSoldPipelineCount'
];

const getStatusName = (item) => {
    if (item?.StatusMetaData && typeof item.StatusMetaData === 'object') {
        return item.StatusMetaData.Name || '';
    }

    return item?.StatusMetaData || '';
};

const isSoldPipelineItem = (item) => {
    const statusName = String(getStatusName(item)).toLowerCase();
    return statusName.includes('sale won');
};

const extractDescriptionOfWorkFromItem = (item) => {
    if (!item || typeof item !== 'object') return '';

    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const direct = item['Description of Work'];

    if (typeof direct === 'string' && direct.trim()) {
        return direct.trim();
    }

    for (const [key, value] of Object.entries(item)) {
        const normalizedKey = normalize(key);
        if (!normalizedKey.includes('description') || !normalizedKey.includes('work')) {
            continue;
        }

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

/**
 * Make a request to the LACRM API
 * @param {string} functionName - LACRM API function name (e.g., 'GetPipelineItems', 'GetContacts')
 * @param {object} parameters - Function parameters
 * @returns {Promise<object>} API response
 */
export async function makeRequest(functionName, parameters = {}) {
    const body = {
        functionName,
        parameters,
    };

    console.log('makeRequest sending:', { functionName, parameters });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
    };

    try {
        const response = await fetch(`${PROXY_BASE_URL}/lacrm`, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('❌ LACRM Proxy Error:', {
                status: response.status,
                statusText: response.statusText,
                lacrm_details: error.details,
                lacrm_message: error.error,
                request_payload: error.request,
                response: error,
            });
            throw new Error(`API Error: ${response.status} - ${error.error || response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ LACRM Response Success:', {
            hasResults: !!result.Results,
            resultCount: result.Results ? result.Results.length : 0,
        });
        return result;
    } catch (error) {
        console.error('LACRM API Error:', error);
        throw error;
    }
}

/**
 * Filter pipeline items to only include specified fields and remove null values
 * @param {array} items - Array of pipeline items from API
 * @returns {array} Filtered pipeline items
 */
export function filterPipelineItems(items) {
    if (!Array.isArray(items)) {
        return items;
    }

    return items.map(item => {
        const filtered = {};
        PIPELINE_ITEM_FIELDS.forEach(field => {
            if (item.hasOwnProperty(field)) {
                const value = item[field];
                // Only include if not null, undefined, or empty string
                if (value !== null && value !== undefined && value !== '') {
                    filtered[field] = value;
                }
            }
        });

        const descriptionOfWork = extractDescriptionOfWorkFromItem(item);
        if (descriptionOfWork) {
            filtered['Description of Work'] = descriptionOfWork;
        }

        return filtered;
    });
}

/**
 * Get pipeline items sold on a specific date
 * @param {string} pipelineId - Pipeline ID
 * @param {string} saleDate - Date in format YYYY-MM-DD (e.g., '2026-07-23')
 * @param {object} options - Optional parameters like { includeArchived: true }
 * @returns {Promise<array>} Array of sold pipeline items with filtered fields
 */
export async function getItemsByDate(pipelineId, date, options = {}) {
    const params = {
        PipelineId: pipelineId,
        AdvancedFilters: [
            {
                Name: 'pipelineField_3536386357020753823161095223915',
                Operation: 'IsExactly',
                Value: date
            },
        ],
    };

    const result = await makeRequest('GetPipelineItems', params);

    // Return only the filtered Results array
    return filterPipelineItems(result.Results || []);
}

export async function getEventsByDateRange(pipelineId, startDate, endDate) {
    const params = {
        IncludeArchivedPipelines: pipelineId,
        StartDate: startDate,
        EndDate: endDate,
    };

    const result = await makeRequest('GetEvents', params);

    // Filter events to only those with ContactIds and extract contactId + contact name + event times
    return (result.Results || [])
        .filter(event => event.ContactIds && event.ContactIds.length > 0)
        .map(event => ({
            contactId: event.ContactIds[0],
            name: event.ContactMetaData && event.ContactMetaData.length > 0
                ? event.ContactMetaData[0].Name
                : 'Unknown',
            eventStartTime: event.StartDate,
            eventEndTime: event.EndDate,
        }));
}

/**
 * Get pipeline items for each event's contact, filtered by appointment date
 * @param {string} pipelineId - Pipeline ID
 * @param {string} startDate - Start date in format YYYY-MM-DD
 * @param {string} endDate - End date in format YYYY-MM-DD
 * @returns {Promise<array>} Array of pipeline items with contact info, filtered by appointment date
 */
export async function getEventPipelinesForDate(pipelineId, startDate, endDate) {
    // First get all events with contacts
    const events = await getEventsByDateRange(pipelineId, startDate, endDate);

    if (!events.length) {
        return [];
    }

    // For each contact, get their pipeline items
    const allPipelines = [];

    for (const event of events) {
        try {
            const result = await makeRequest('GetPipelineItemsAttachedToContact', {
                ContactId: event.contactId,
            });

            const pipelineGroups = (result || []).filter(
                (pipelineGroup) => String(pipelineGroup.PipelineId) === String(pipelineId)
            );

            const allContactPipelineItems = pipelineGroups.flatMap(
                (pipelineGroup) => pipelineGroup.PipelineItems || []
            );

            const uniquePipelineIds = new Set();
            const uniqueSoldPipelineIds = new Set();

            allContactPipelineItems.forEach((pipelineItem) => {
                const itemId = pipelineItem.PipelineItemId || `${pipelineItem.PipelineId || 'pipeline'}-${pipelineItem['Appointment Date'] || ''}-${pipelineItem['Sale Date'] || ''}`;
                uniquePipelineIds.add(itemId);

                if (isSoldPipelineItem(pipelineItem)) {
                    uniqueSoldPipelineIds.add(itemId);
                }
            });

            const contactPipelineCount = Number(uniquePipelineIds.size) || 0;
            const contactSoldPipelineCount = Number(uniqueSoldPipelineIds.size) || 0;

            // Result is filtered to the active pipeline only.
            pipelineGroups.forEach(pipelineGroup => {
                const pipelineItems = pipelineGroup.PipelineItems || [];

                // Filter by appointment date within the range
                pipelineItems.forEach(item => {
                    const appointmentDate = item['Appointment Date'];
                    // Convert appointment date format (MM/DD/YYYY) to YYYY-MM-DD if needed
                    let dateToMatch = appointmentDate;
                    if (appointmentDate && appointmentDate.includes('/')) {
                        const [month, day, year] = appointmentDate.split('/');
                        dateToMatch = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }

                    // Check if date falls within the range using an exclusive end boundary.
                    if (dateToMatch >= startDate && dateToMatch < endDate) {
                        allPipelines.push({
                            ...item,
                            contactName: event.name,
                            contactId: event.contactId,
                            ContactId: event.contactId,
                            eventStartTime: event.eventStartTime,
                            eventEndTime: event.eventEndTime,
                            contactPipelineCount,
                            contactSoldPipelineCount,
                        });
                    }
                });
            });
        } catch (err) {
            console.error(`Error fetching pipelines for contact ${event.contactId}:`, err);
        }
    }

    return filterPipelineItems(allPipelines);
}

export default {
    makeRequest,
    filterPipelineItems,
    getItemsByDate,
    getEventsByDateRange,
    getEventPipelinesForDate,
};