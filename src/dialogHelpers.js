import { AZ_CITIES } from './data';

const normalizeCityKey = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');

const AZ_CITY_INDEX = new Map(
    AZ_CITIES.list
        .filter((item) => item?.value)
        .map((item) => [normalizeCityKey(item.value || item.name), item])
);

const CA_CITY_REGION_LOOKUP = {
    SC: new Set([
        'sandiego', 'losangeles', 'anaheim', 'irvine', 'longbeach', 'santamonica', 'riverside',
        'santaana', 'ontario', 'escondido', 'carlsbad', 'chulavista'
    ]),
    CC: new Set([
        'fresno', 'bakersfield', 'visalia', 'modesto', 'stockton', 'merced', 'madera', 'tulare'
    ]),
    NC: new Set([
        'sacramento', 'roseville', 'chico', 'redding', 'santarosa', 'oakland', 'sanfrancisco',
        'sanjose', 'fremont', 'concord', 'vacaville', 'fairfield'
    ]),
};

const parseCityStateFromAddress = (addressText) => {
    const raw = String(addressText || '').trim();
    if (!raw) return { city: '', state: '' };

    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        const stateMatch = line.match(/,\s*([A-Za-z]{2})\b/);
        if (!stateMatch) continue;

        const state = stateMatch[1].toUpperCase();
        const city = line.split(',')[0]?.trim() || '';

        if (city) {
            return { city, state };
        }
    }

    return { city: '', state: '' };
};

const getAzCityMetaFromCity = (city) => {
    const key = normalizeCityKey(city);
    if (!key) return null;
    return AZ_CITY_INDEX.get(key) || null;
};

const inferRegionFromAddress = (addressText, cityObj) => {
    const cityFromSelection = cityObj?.value || cityObj?.name || '';
    const parsed = parseCityStateFromAddress(addressText);
    const city = cityFromSelection || parsed.city;
    const state = parsed.state;

    const azCity = getAzCityMetaFromCity(city);
    if (state === 'AZ' || azCity) {
        if (!azCity) return '';
        return 'AZ';
    }

    if (state === 'CA') {
        const key = normalizeCityKey(city);

        if (CA_CITY_REGION_LOOKUP.SC.has(key)) return 'SC';
        if (CA_CITY_REGION_LOOKUP.CC.has(key)) return 'CC';
        if (CA_CITY_REGION_LOOKUP.NC.has(key)) return 'NC';

        return '';
    }

    return '';
};

const inferAzClassFromAddress = (addressText, cityObj) => {
    if (cityObj?.class) return cityObj.class;

    const parsed = parseCityStateFromAddress(addressText);
    const azCity = getAzCityMetaFromCity(parsed.city);

    return azCity?.class || null;
};

const getClass = (salesmanObj, cityObj, addressText) => {
    if (salesmanObj) {
        const salesmanName = String(salesmanObj.name || '').toLowerCase();
        if (salesmanName === 'dom' || salesmanName === 'dave') {
            const inferredRegion = inferRegionFromAddress(addressText, cityObj);
            if (inferredRegion === 'AZ') return inferAzClassFromAddress(addressText, cityObj);
            if (inferredRegion) return inferredRegion;
        }

        if (salesmanObj.region === 'CA') return salesmanObj.subregion;
        if (salesmanObj.region === 'AZ') return inferAzClassFromAddress(addressText, cityObj);
        if (cityObj) return cityObj.class;
        return null;
    } else {
        return null;
    }
};

const getRegion = (salesmanObj, cityObj, addressText) => {
    if (salesmanObj) {
        const salesmanName = String(salesmanObj.name || '').toLowerCase();
        if (salesmanName === 'dom' || salesmanName === 'dave') {
            const inferredRegion = inferRegionFromAddress(addressText, cityObj);
            return inferredRegion || null;
        }

        if (salesmanObj.region === 'AZ') {
            return inferRegionFromAddress(addressText, cityObj) || null;
        }

        return salesmanObj.subregion;
    } else {
        return null;
    }
}

const getStatus = (salesmanObj) => {
    if (salesmanObj) {
        if (salesmanObj.region === 'CA') return 'Admin Ready';
        return 'Ready';
    } else {
        return null;
    }
}

const getSource = (sourceObj) => {
    if (sourceObj) return sourceObj.value;
    return null;
};

const buildAddressText = (data) => {
    let text = '';

    text += `${data.address_name}\n`;
    text += data.address;

    return text;
};

const buildEstimateText = (data) => {
    let text = '';

    text += `${data.job_description}\n`;

    if (data.financed) {
        text += '\nSYNCHRONY\n';
        text += `   - Amount Financed: ${data.amount_financed}\n`;
        text += `   - Account Number: ${data.account_number}\n`;
    }

    if (data.progress_payments.length) {
        text += '\nPROGRESS PAYMENTS:\n';
        data.progress_payments.forEach(payment => {
            text += `   - ${payment.name}: ${payment.price}\n`;
        });
    }

    if (data.discounts.length) {
        text += '\nDISCOUNTS:\n';
        data.discounts.forEach(discount => {
            text += `   - ${discount.name}: ${discount.price}\n`;
        });
    }

    text += `\nPrice: ${data.price}`;
    text += `\nDeposit: ${data.deposit}`;
    if (data.deposit_type) {
        text += ` - ${data.deposit_type}`;
    }
    text += `\nBalance: ${data.balance ? data.balance : '$0'}`

    return text;
};

const buildNoteText = (data) => {
    let text = '';

    text += `${data.contract_date} - ${data.price} - ${data.salesman}:\n`;
    text += `Job entered, folder made.\n`;
    if (data.email_date !== '[MISSING]') {
        text += `Sales email received: `;
        if ((/^(?:1[0-2]|[1-9]):[0-5]\d(?:AM|PM)$/i).test(data.email_date.replace(' ', ''))) {

            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
            const today = new Date();
            const formattedDate = `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`;

            text += `${formattedDate}, ${data.email_date}`;
        } else {
            text += data.email_date;
        }
    } else {
        text += 'Sales email not received/entered beforehand.';
    }

    return text;
};

const getSelectedEntry = (data, value) => {
    if (value) return data.list.find(item => item.value === value);
    return null;
};

const required = (field, errorText) => {
    if (field) return field;
    return errorText || '[MISSING]';
};

const verifyFields = (data) => {
    if (typeof (data) === 'object') {
        return Object.values(data).every(value => {
            return !String(value).includes('MISSING');
        });
    } else {
        return !String(data).includes('MISSING');
    }
};

export {
    getClass,
    getRegion,
    getStatus,
    getSource,
    buildAddressText,
    buildEstimateText,
    buildNoteText,
    getSelectedEntry,
    required,
    verifyFields
};