// Currency utility functions
const currencies = {
    INR: { symbol: '₹', name: 'Indian Rupee' },
    USD: { symbol: '$', name: 'US Dollar' },
    EUR: { symbol: '€', name: 'Euro' },
    GBP: { symbol: '£', name: 'British Pound' },
    JPY: { symbol: '¥', name: 'Japanese Yen' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar' },
    AUD: { symbol: 'A$', name: 'Australian Dollar' }
};

let currentCurrency = 'INR';
let currentCurrencySymbol = '₹';

// Load user currency settings
async function loadUserCurrency(userId) {
    try {
        const doc = await db.collection('user_settings').doc(userId).get();
        if (doc.exists) {
            const settings = doc.data();
            currentCurrency = settings.currency || 'INR';
            currentCurrencySymbol = settings.currencySymbol || '₹';
        }
    } catch (error) {
        console.error('Error loading currency settings:', error);
    }
}

// Format amount with current currency
function formatCurrency(amount) {
    const numAmount = parseFloat(amount) || 0;
    return `${currentCurrencySymbol}${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Get current currency symbol
function getCurrencySymbol() {
    return currentCurrencySymbol;
}

// Get current currency code
function getCurrencyCode() {
    return currentCurrency;
}