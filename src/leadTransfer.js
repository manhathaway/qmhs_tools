import { buildInitialState, formatCurrency } from './formHelpers';
import { FORM_SCHEMA, SALESMEN, SOURCES, DEPOSIT_TYPES } from './data';

const TRANSFERABLE_STATUSES = ['Sale Won', 'Cancelled'];
const ZERO_CURRENCY = '$0';

const normalizeDate = (value) => {
    if (!value) return '';

    if (value.includes('-')) {
        return value;
    }

    if (value.includes('/')) {
        const [month, day, year] = value.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return '';
};

const getStatusName = (lead) => {
    return lead.StatusMetaData && typeof lead.StatusMetaData === 'object'
        ? lead.StatusMetaData.Name
        : lead.StatusMetaData;
};

const getStatusShortName = (lead) => {
    const statusName = getStatusName(lead) || '';

    if (statusName.includes('Sale Won')) return 'Sale Won';
    if (statusName.includes('Sale Lost')) return 'Sale Lost';
    if (statusName.includes('Cancelled')) return 'Cancelled';
    if (statusName.includes('No-Pitch')) return 'No-Pitch';
    if (statusName.includes('Left Bid')) return 'Left Bid';
    if (statusName.includes('Porched') || statusName.includes('No Show')) return 'Porched/No Show';
    if (statusName.includes('Appointment Confirmed')) return 'Appointment Confirmed';
    if (statusName.includes('Called to Confirm Appt')) return 'Called to Confirm';
    if (statusName.includes('Assigned to Sales Representative')) return 'Assigned to Sales Rep.';

    return statusName;
};

const getLeadType = (lead) => lead['Lead Type'] || '';
const getLeadSource = (lead) => lead['Lead Source'] || '';
const getSalesRep = (lead) => lead['Sales Rep Assigned'] || '';
const getContractDate = (lead) => lead['Sale Date'] || lead['Appointment Date'] || '';

const getDescriptionOfWork = (lead) => {
    const candidateValues = [
        lead['Description of Work'],
        lead['Description Of Work'],
        lead['description of work'],
        lead.descriptionofwork,
        lead.descriptionOfWork,
        lead.DescriptionOfWork,
    ];

    for (const candidate of candidateValues) {
        if (!candidate) continue;

        if (typeof candidate === 'string') {
            const value = candidate.trim();
            if (value) return value;
            continue;
        }

        if (typeof candidate === 'object') {
            const value = (candidate.Name || candidate.Value || candidate.value || candidate.name || '').trim();
            if (value) return value;
        }
    }

    return '';
};

const getCityStateZipText = (lead) => {
    const candidateValues = [
        lead['City, State & Zip'],
        lead['City, State, & Zip'],
        lead['City, State, Zip'],
        lead.CityStateZip,
        lead.cityStateZip,
    ];

    for (const candidate of candidateValues) {
        if (!candidate) continue;

        if (typeof candidate === 'string') {
            return candidate;
        }

        if (typeof candidate === 'object') {
            return candidate.Name || candidate.Value || candidate.value || candidate.name || '';
        }
    }

    return '';
};

const formatContactNameFirstLast = (name) => {
    const normalized = String(name || '').trim();

    if (!normalized) return '';

    if (normalized.includes(',')) {
        const [lastName, firstName] = normalized.split(',').map((part) => part.trim());
        return [firstName, lastName].filter(Boolean).join(' ');
    }

    return normalized;
};

const buildAddressText = (lead) => {
    const address = String(lead['Address'] || '').trim();
    const cityStateZip = String(lead['City, State & Zip'] || '').trim();
    const phone = String(lead['Phone #'] || '').trim();

    return [address, cityStateZip, phone]
        .filter(Boolean)
        .join('\n');
};

const formatContactName = (name) => {
    const normalized = String(name || '').trim();

    if (!normalized) return '';
    if (normalized.includes(',')) return normalized;

    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return normalized;

    const lastName = parts.pop();
    const firstName = parts.join(' ');

    return `${lastName}, ${firstName}`;
};

const mapSalesman = (salesRep) => {
    const rep = String(salesRep || '').toLowerCase().replace(/[().]/g, '').trim();

    // Explicit disambiguation for reps sharing the same first name.
    if (rep.includes('nick m') || rep.includes('mackenzie')) return 'NickM';
    if (rep.includes('nick b') || rep.includes('bennett')) return 'NB';

    const match = SALESMEN.list.find(option => {
        const name = (option.name || '').toLowerCase().replace(/[().]/g, '').trim();
        const value = (option.value || '').toLowerCase();

        if (!name && !value) return false;

        // Prefer exact/full-name style matches and value matches.
        return (name && rep.includes(name)) || (value && rep.includes(value));
    });

    if (match?.value) return match.value;

    if (rep.includes('sal')) return 'SalS';
    if (rep.includes('zac')) return 'Zac';
    if (rep.includes('dom')) return 'Dom';
    if (rep.includes('dave')) return 'Dave';
    if (rep.includes('nick m')) return 'NickM';
    if (rep.includes('nick b')) return 'NB';
    if (rep.includes('chris')) return 'CHP';

    return '';
};

const mapDepositType = (depositType) => {
    const normalized = String(depositType || '').trim().toLowerCase();

    const match = DEPOSIT_TYPES.list.find(option => {
        const optionValue = String(option.value || '').trim().toLowerCase();
        const optionName = String(option.name || '').trim().toLowerCase();

        return optionValue === normalized || optionName === normalized;
    });

    if (match?.value) return match.value;

    if (normalized.includes('sync')) return 'Synchrony';
    if (normalized.includes('credit') || normalized === 'cc') return 'CC';
    if (normalized.includes('check')) return 'Check';
    if (normalized.includes('cash')) return 'Cash';

    return '';
};

const extractDepositType = (lead) => {
    const candidateValues = [
        lead['Deposit Type'],
        lead['Depost Type'],
        lead.DepositType,
        lead.depositType,
        lead.deposit_type,
    ];

    for (const candidate of candidateValues) {
        if (!candidate) continue;

        if (typeof candidate === 'string') {
            return candidate;
        }

        if (typeof candidate === 'object') {
            return candidate.Name || candidate.Value || candidate.value || candidate.name || '';
        }
    }

    return '';
};

const parseDepositAmount = (depositAmount) => {
    if (depositAmount === null || depositAmount === undefined || depositAmount === '') {
        return ZERO_CURRENCY;
    }

    const numericValue = Number(String(depositAmount).replace(/[^0-9.-]+/g, ''));

    if (!Number.isFinite(numericValue) || numericValue === 0) {
        return ZERO_CURRENCY;
    }

    return formatCurrency(numericValue);
};

const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const scoreSourceMatch = (candidate, target) => {
    const normalizedCandidate = normalizeText(candidate);
    const normalizedTarget = normalizeText(target);

    if (!normalizedCandidate || !normalizedTarget) return 0;
    if (normalizedCandidate === normalizedTarget) return 100;
    if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) return 85;

    const candidateTokens = normalizedCandidate.split(' ');
    const targetTokens = normalizedTarget.split(' ');
    const tokenOverlap = targetTokens.filter((token) => candidateTokens.includes(token)).length;

    if (tokenOverlap === 0) return 0;
    return Math.round((tokenOverlap / Math.max(candidateTokens.length, targetTokens.length)) * 70);
};

const parseCount = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const shouldMarkAsNewCustomer = (lead) => {
    const soldCount = parseCount(lead.contactSoldPipelineCount);

    if (soldCount !== null) {
        // First sold pipeline for the contact => treat as new customer.
        return soldCount <= 1;
    }

    const totalCount = parseCount(lead.contactPipelineCount);
    if (totalCount !== null) {
        return totalCount <= 1;
    }

    return false;
};

const mapSource = (lead) => {
    const leadType = getLeadType(lead);
    const leadSource = getLeadSource(lead);
    const csr = (lead['Customer Service Representative'] || '').trim();
    const normalizedLeadSource = normalizeText(leadSource);

    if (leadType === 'Upsale') return 'Upsale';
    if (leadType === 'Go-Back' || leadType === 'Go Back') return 'Go Back';

    if (leadType === 'Call In') {
        let bestCallInMatch = null;
        let bestCallInScore = 0;

        SOURCES.list
            .filter((option) => option.type === 'CI')
            .forEach((option) => {
                const score = Math.max(
                    scoreSourceMatch(option.name, leadSource),
                    scoreSourceMatch(option.value, leadSource)
                );

                if (score > bestCallInScore) {
                    bestCallInScore = score;
                    bestCallInMatch = option;
                }
            });

        // Common shorthand normalization for web leads.
        if (normalizedLeadSource.includes('web') && normalizedLeadSource.includes('ad')) {
            const webOption = SOURCES.list.find((option) => option.type === 'CI' && normalizeText(option.name).includes('web'));
            if (webOption?.value) return webOption.value;
        }

        return bestCallInScore >= 45 ? bestCallInMatch?.value || '' : '';
    }

    if (leadType === 'Quality Check' || leadType === 'Warranty Check') {
        const wcMatch = SOURCES.list.find(option => option.type === 'WC' && option.name === csr);
        if (wcMatch?.value) return wcMatch.value;
    }

    let bestMatch = null;
    let bestScore = 0;

    SOURCES.list.forEach((option) => {
        const score = Math.max(
            scoreSourceMatch(option.name, leadSource),
            scoreSourceMatch(option.value, leadSource)
        );

        if (score > bestScore) {
            bestScore = score;
            bestMatch = option;
        }
    });

    if (normalizedLeadSource.includes('web') && normalizedLeadSource.includes('ad')) {
        const webOption = SOURCES.list.find((option) => normalizeText(option.name).includes('web'));
        if (webOption?.value) return webOption.value;
    }

    return bestScore >= 45 ? bestMatch?.value || '' : '';
};

export const canTransferLeadToSaleEntry = (lead) => {
    const statusName = getStatusShortName(lead);
    if (!statusName) return false;
    return TRANSFERABLE_STATUSES.includes(statusName);
};

export const buildSaleEntryPrefill = (lead) => {
    const base = buildInitialState(FORM_SCHEMA);

    const saleAmount = lead['Sale Amount'] || '';
    const depositAmount = lead['Deposit Amount'] || '';
    const financeInstitution = lead['Finance Institution'] || '';
    const depositType = extractDepositType(lead);
    const normalizedDepositAmount = parseDepositAmount(depositAmount);
    const hasDeposit = String(normalizedDepositAmount) !== ZERO_CURRENCY;
    const mappedSalesman = mapSalesman(getSalesRep(lead));
    const descriptionOfWork = getDescriptionOfWork(lead);

    const prefill = {
        ...base,
        name: formatContactName(lead.contactName || lead.ContactMetaData?.Name || ''),
        address: buildAddressText(lead),
        job_description: descriptionOfWork || base.job_description,
        new_customer: shouldMarkAsNewCustomer(lead),
        salesman: mappedSalesman,
        contract_date: normalizeDate(getContractDate(lead)),
        price: saleAmount ? formatCurrency(saleAmount) : '',
        deposit: normalizedDepositAmount,
        deposit_type: hasDeposit ? mapDepositType(depositType) : '',
        financed: financeInstitution === 'Synchrony',
        source: mapSource(lead),
    };

    return prefill;
};

export {
    getStatusName,
    getStatusShortName,
};
