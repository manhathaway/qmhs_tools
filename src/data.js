export const FORM_SCHEMA = [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'email_date', label: 'Email Date', type: 'text' },
    { id: 'new_customer', label: 'New Customer?', type: 'checkbox' },
    {
        id: 'address',
        label: 'Address',
        type: 'textarea',
        enabledWhen: (form) => form.new_customer
    },
    { id: 'salesman', label: 'Salesman', type: 'select', data: 'salesman' },
    { id: 'contract_date', label: 'Contract Date', type: 'date' },
    { id: 'source', label: 'Source', type: 'select', data: 'source' },
    { id: 'job_name', label: 'Job Name', type: 'text' },
    { id: 'job_description', label: 'Job Description', type: 'textarea' },
    { id: 'price', label: 'Price', type: 'text', currency: true },
    { id: 'deposit', label: 'Deposit', type: 'text', currency: true },
    { id: 'deposit_type', label: 'Deposit Type', type: 'select', data: 'deposit_type' },
    { id: 'financed', label: 'Financed?', type: 'checkbox' },
    {
        id: 'amount_financed',
        label: 'Amount Financed',
        type: 'text',
        currency: true,
        enabledWhen: (form) => form.financed
    },
    {
        id: 'account_number',
        label: 'Account Number',
        type: 'text',
        enabledWhen: (form) => form.financed
    },
    {
        id: 'discounts',
        label: 'Discounts?',
        type: 'repeatable',
        toggle: 'discounts',
        includeInitial: true,
        fields: [
            { key: 'name', placeholder: 'Discount Name' },
            { key: 'price', placeholder: 'Discount Price', currency: true }
        ]
    },
    {
        id: 'progress_payments',
        label: 'Progress Payments?',
        type: 'repeatable',
        toggle: 'progress_payments',
        fields: [
            { key: 'name', placeholder: 'Payment Name' },
            { key: 'price', placeholder: 'Payment Price', currency: true }
        ]
    }
];

export const SALESMEN = {
    name: 'salesmen',
    list: [
        { name: '-' },
        { name: 'Sal', value: 'SalS', region: 'CA', subregion: 'SC' },
        { name: 'Zac', value: 'Zac', region: 'CA', subregion: 'SC' },
        { name: 'Dom', value: null, region: null, subregion: null },
        { name: 'Dave', value: 'Dave', region: 'CA', subregion: 'NC' },
        { name: 'Nick B.', value: 'NB', region: 'CA', subregion: 'NC' },
        { name: 'Chris', value: 'CHP', region: 'AZ' },
        { name: 'Nick M.', value: 'NickM', region: 'AZ' }

    ]
};

export const AZ_CITIES = {
    name: 'AZ_cities',
    list: [
        { name: '-', value: null },
        { name: 'Apache Junction', value: 'Apache Junction', class: 'MP' },
        { name: 'Avondale', value: 'Avondale', class: 'MP' },
        { name: 'Black Canyon City', value: 'Black Canyon City', class: 'NA' },
        { name: 'Benson', value: 'Benson', class: 'TU' },
        { name: 'Buckeye', value: 'Buckeye', class: 'MP' },
        { name: 'Camp Verde', value: 'Camp Verde', class: 'NA' },
        { name: 'Casa Grande', value: 'Casa Grande', class: 'MP' },
        { name: 'Cave Creek', value: 'Cave Creek', class: 'MP' },
        { name: 'Chandler', value: 'Chandler', class: 'MP' },
        { name: 'Chino Valley', value: 'Chino Valley', class: 'NA' },
        { name: 'Cottonwood', value: 'Cottonwood', class: 'MP' },
        { name: 'Dewey', value: 'Dewey', class: 'NA' },
        { name: 'El Mirage', value: 'El Mirage', class: 'MP' },
        { name: 'Flagstaff', value: 'Flagstaff', class: 'NA' },
        { name: 'Gilbert', value: 'Gilbert', class: 'MP' },
        { name: 'Glendale', value: 'Glendale', class: 'MP' },
        { name: 'Goodyear', value: 'Goodyear', class: 'MP' },
        { name: 'Kearny', value: 'Kearny', class: 'MP' },
        { name: 'Mesa', value: 'Mesa', class: 'MP' },
        { name: 'Marana', value: 'Marana', class: 'TU' },
        { name: 'Maricopa', value: 'Maricopa', class: 'MP' },
        { name: 'Mayer', value: 'Mayer', class: 'NA' },
        { name: 'New River', value: 'New River', class: 'NA' },
        { name: 'Phoenix', value: 'Phoenix', class: 'MP' },
        { name: 'Preoria', value: 'Preoria', class: 'MP' },
        { name: 'Prescott', value: 'Prescott', class: 'NA' },
        { name: 'Queen Creek', value: 'Queen Creek', class: 'MP' },
        { name: 'San Tan Valley', value: 'San Tan Valley', class: 'MP' },
        { name: 'Sedona', value: 'Sedona', class: 'NA' },
        { name: 'Sun Lakes', value: 'Sun Lakes', class: 'MP' },
        { name: 'Superior', value: 'Superior', class: 'MP' },
        { name: 'Surprise', value: 'Surprise', class: 'MP' },
        { name: 'Tempe', value: 'Tempe', class: 'MP' },
        { name: 'Tucson', value: 'Tucson', class: 'TU' },
        { name: 'Wickenburg', value: 'Wickenburg', class: 'NA' },
        { name: 'Witmann', value: 'Witmann', class: 'NA' },
    ]
};

export const SOURCES = {
    name: 'sources',
    list: [
        { name: '-', value: null },
        { name: 'Postcard', type: 'CI', value: 'CI - PC' },
        { name: 'Park Magazine', type: 'CI', value: 'CI - PM' },
        { name: 'Web Advertizements', type: 'CI', value: 'CI - Web' },
        { name: 'Referral', type: 'CI', value: 'CI - Ref.' },
        { name: 'Previous Client', type: 'CI', value: 'CI - Prev.' },
        { name: 'Carlyn', type: 'WC', value: 'WC - Carlyn' },
        { name: 'Viki', type: 'WC', value: 'WC - Viki' },
        { name: 'Jose', type: 'WC', value: 'WC - Jose' },
        { name: 'Go Back', value: 'Go Back' },
        { name: 'Upsale', value: 'Upsale' },
    ]
};

export const DEPOSIT_TYPES = {
    name: 'deposit_types',
    list: [
        { name: '-', value: null },
        { name: 'Credit Card', value: 'CC' },
        { name: 'Check', value: 'Check' },
        { name: 'Cash', value: 'Cash' },
        { name: 'Synchrony', value: 'Synchrony' }
    ]
};

export const SELECT_DATA = {
    salesman: SALESMEN,
    city: AZ_CITIES,
    source: SOURCES,
    deposit_type: DEPOSIT_TYPES
};