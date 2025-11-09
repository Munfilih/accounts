// Settings App State
let currentUser = null;
let userSettings = {
    currency: 'INR',
    currencySymbol: '₹'
};
let accountTypes = [];
let transactionTypes = [];
let editingTypeId = null;
let editingTransactionTypeId = null;

// Currency configurations
const currencies = {
    INR: { symbol: '₹', name: 'Indian Rupee' },
    USD: { symbol: '$', name: 'US Dollar' },
    EUR: { symbol: '€', name: 'Euro' },
    GBP: { symbol: '£', name: 'British Pound' },
    JPY: { symbol: '¥', name: 'Japanese Yen' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar' },
    AUD: { symbol: 'A$', name: 'Australian Dollar' }
};

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    
    // Check Firebase auth state
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserSettings();
            loadUserProfile();
        } else {
            window.location.href = 'login.html';
        }
    });
});

function setupEventListeners() {
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
    
    // Currency selection
    document.getElementById('currencySelect').addEventListener('change', updateCurrencyPreview);
    
    // Save buttons
    document.getElementById('saveCurrencyBtn').addEventListener('click', saveCurrencySettings);
    document.getElementById('saveAccountBtn').addEventListener('click', saveAccountSettings);
    document.getElementById('exportDataBtn').addEventListener('click', exportUserData);
    document.getElementById('deleteAccountBtn').addEventListener('click', deleteUserAccount);
    
    // Account type management
    document.getElementById('accountTypeForm').addEventListener('submit', saveAccountType);
    
    // Transaction type management
    document.getElementById('transactionTypeForm').addEventListener('submit', saveTransactionType);
    
    // Reset form when modal is hidden
    document.getElementById('accountTypeModal').addEventListener('hidden.bs.modal', resetAccountTypeForm);
    document.getElementById('transactionTypeModal').addEventListener('hidden.bs.modal', resetTransactionTypeForm);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

async function loadUserSettings() {
    try {
        const doc = await db.collection('user_settings').doc(currentUser.uid).get();
        if (doc.exists) {
            userSettings = { ...userSettings, ...doc.data() };
        }
        
        // Update UI with loaded settings
        document.getElementById('currencySelect').value = userSettings.currency;
        updateCurrencyPreview();
        
        // Load account types and transaction types
        await loadAccountTypes();
        await loadTransactionTypes();
    } catch (error) {
        console.error('Error loading user settings:', error);
    }
}

function loadUserProfile() {
    document.getElementById('displayName').value = currentUser.displayName || '';
    document.getElementById('userEmail').value = currentUser.email;
}

function updateCurrencyPreview() {
    const selectedCurrency = document.getElementById('currencySelect').value;
    const currencyConfig = currencies[selectedCurrency];
    
    if (currencyConfig) {
        const preview = document.getElementById('currencyPreview');
        preview.textContent = `${currencyConfig.symbol}1,234.56`;
    }
}

async function saveCurrencySettings() {
    const selectedCurrency = document.getElementById('currencySelect').value;
    const currencyConfig = currencies[selectedCurrency];
    
    userSettings.currency = selectedCurrency;
    userSettings.currencySymbol = currencyConfig.symbol;
    
    try {
        await db.collection('user_settings').doc(currentUser.uid).set(userSettings, { merge: true });
        
        showAlert('Currency settings saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving currency settings:', error);
        showAlert('Error saving settings. Please try again.', 'danger');
    }
}

async function saveAccountSettings() {
    const displayName = document.getElementById('displayName').value.trim();
    
    if (!displayName) {
        showAlert('Please enter a display name.', 'warning');
        return;
    }
    
    try {
        await currentUser.updateProfile({ displayName: displayName });
        showAlert('Account settings saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving account settings:', error);
        showAlert('Error saving account settings. Please try again.', 'danger');
    }
}

async function exportUserData() {
    try {
        // Get user transactions
        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .get();
        
        const transactions = [];
        transactionsSnapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        
        // Get user categories
        const categoriesSnapshot = await db.collection('categories')
            .where('userId', '==', currentUser.uid)
            .get();
        
        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });
        
        const exportData = {
            user: {
                email: currentUser.email,
                displayName: currentUser.displayName
            },
            settings: userSettings,
            transactions: transactions,
            categories: categories,
            exportDate: new Date().toISOString()
        };
        
        // Create and download file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `accounts-keeper-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        showAlert('Data exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showAlert('Error exporting data. Please try again.', 'danger');
    }
}

async function deleteUserAccount() {
    const confirmation = prompt('Type "DELETE" to confirm account deletion:');
    
    if (confirmation !== 'DELETE') {
        return;
    }
    
    if (!confirm('Are you absolutely sure? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Delete user data from Firestore
        const batch = db.batch();
        
        // Delete transactions
        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .get();
        transactionsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete categories
        const categoriesSnapshot = await db.collection('categories')
            .where('userId', '==', currentUser.uid)
            .get();
        categoriesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete user settings
        batch.delete(db.collection('user_settings').doc(currentUser.uid));
        
        await batch.commit();
        
        // Delete user account
        await currentUser.delete();
        
        showAlert('Account deleted successfully.', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    } catch (error) {
        console.error('Error deleting account:', error);
        showAlert('Error deleting account. Please try again.', 'danger');
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function loadAccountTypes() {
    try {
        const querySnapshot = await db.collection('account_types')
            .where('userId', '==', currentUser.uid)
            .get();
        
        accountTypes = [];
        querySnapshot.forEach((doc) => {
            accountTypes.push({ id: doc.id, ...doc.data() });
        });
        
        renderAccountTypes();
    } catch (error) {
        console.error('Error loading account types:', error);
    }
}

function renderAccountTypes() {
    const container = document.getElementById('accountTypesList');
    
    if (accountTypes.length === 0) {
        container.innerHTML = '<p class="text-muted">No custom account types created yet</p>';
        return;
    }
    
    const html = accountTypes.map(type => `
        <div class="d-flex justify-content-between align-items-center p-2 border rounded mb-2">
            <span>${type.name}</span>
            <div>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editAccountType('${type.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAccountType('${type.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function saveAccountType(e) {
    e.preventDefault();
    
    const name = document.getElementById('accountTypeName').value.trim();
    
    if (!name) {
        showAlert('Please enter a type name.', 'warning');
        return;
    }
    
    console.log('Saving account type:', name, 'User:', currentUser.uid);
    
    const typeData = {
        name: name,
        userId: currentUser.uid,
        createdAt: new Date().toISOString()
    };
    
    try {
        if (editingTypeId) {
            console.log('Updating existing type:', editingTypeId);
            await db.collection('account_types').doc(editingTypeId).update({
                name: name,
                updatedAt: new Date().toISOString()
            });
            showAlert('Account type updated successfully!', 'success');
        } else {
            console.log('Creating new type with data:', typeData);
            const docRef = await db.collection('account_types').add(typeData);
            console.log('Document written with ID: ', docRef.id);
            showAlert('Account type created successfully!', 'success');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('accountTypeModal')).hide();
        await loadAccountTypes();
    } catch (error) {
        console.error('Error saving account type:', error);
        console.error('Error details:', error.message);
        showAlert(`Error: ${error.message}`, 'danger');
    }
}

function editAccountType(typeId) {
    const type = accountTypes.find(t => t.id === typeId);
    if (!type) return;
    
    editingTypeId = typeId;
    document.getElementById('accountTypeName').value = type.name;
    document.getElementById('accountTypeModalTitle').textContent = 'Edit Account Type';
    
    new bootstrap.Modal(document.getElementById('accountTypeModal')).show();
}

async function deleteAccountType(typeId) {
    const type = accountTypes.find(t => t.id === typeId);
    if (!type) return;
    
    if (!confirm(`Are you sure you want to delete "${type.name}"?`)) return;
    
    try {
        await db.collection('account_types').doc(typeId).delete();
        showAlert('Account type deleted successfully!', 'success');
        await loadAccountTypes();
    } catch (error) {
        console.error('Error deleting account type:', error);
        showAlert('Error deleting account type. Please try again.', 'danger');
    }
}

function resetAccountTypeForm() {
    editingTypeId = null;
    document.getElementById('accountTypeForm').reset();
    document.getElementById('accountTypeModalTitle').textContent = 'Add Account Type';
}

// Transaction Type Management
async function loadTransactionTypes() {
    try {
        const querySnapshot = await db.collection('transaction_types')
            .where('userId', '==', currentUser.uid)
            .get();
        
        transactionTypes = [];
        querySnapshot.forEach((doc) => {
            transactionTypes.push({ id: doc.id, ...doc.data() });
        });
        
        renderTransactionTypes();
    } catch (error) {
        console.error('Error loading transaction types:', error);
    }
}

function renderTransactionTypes() {
    const container = document.getElementById('transactionTypesList');
    
    if (transactionTypes.length === 0) {
        container.innerHTML = '<p class="text-muted">No custom transaction types created yet</p>';
        return;
    }
    
    const html = transactionTypes.map(type => `
        <div class="d-flex justify-content-between align-items-center p-2 border rounded mb-2">
            <div>
                <span class="fw-bold">${type.name}</span>
                <span class="badge bg-${type.category === 'receipt' ? 'success' : 'danger'} ms-2">${type.category}</span>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editTransactionType('${type.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteTransactionType('${type.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function saveTransactionType(e) {
    e.preventDefault();
    
    const name = document.getElementById('transactionTypeName').value.trim();
    const category = document.getElementById('transactionTypeCategory').value;
    
    if (!name || !category) {
        showAlert('Please fill in all fields.', 'warning');
        return;
    }
    
    const typeData = {
        name: name,
        category: category,
        userId: currentUser.uid,
        createdAt: new Date().toISOString()
    };
    
    try {
        if (editingTransactionTypeId) {
            await db.collection('transaction_types').doc(editingTransactionTypeId).update({
                name: name,
                category: category,
                updatedAt: new Date().toISOString()
            });
            showAlert('Transaction type updated successfully!', 'success');
        } else {
            await db.collection('transaction_types').add(typeData);
            showAlert('Transaction type created successfully!', 'success');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('transactionTypeModal')).hide();
        await loadTransactionTypes();
    } catch (error) {
        console.error('Error saving transaction type:', error);
        showAlert('Error saving transaction type: ' + error.message, 'danger');
    }
}

function editTransactionType(typeId) {
    const type = transactionTypes.find(t => t.id === typeId);
    if (!type) return;
    
    editingTransactionTypeId = typeId;
    document.getElementById('transactionTypeName').value = type.name;
    document.getElementById('transactionTypeCategory').value = type.category;
    document.getElementById('transactionTypeModalTitle').textContent = 'Edit Transaction Type';
    
    new bootstrap.Modal(document.getElementById('transactionTypeModal')).show();
}

async function deleteTransactionType(typeId) {
    const type = transactionTypes.find(t => t.id === typeId);
    if (!type) return;
    
    if (!confirm(`Are you sure you want to delete "${type.name}"?`)) return;
    
    try {
        await db.collection('transaction_types').doc(typeId).delete();
        showAlert('Transaction type deleted successfully!', 'success');
        await loadTransactionTypes();
    } catch (error) {
        console.error('Error deleting transaction type:', error);
        showAlert('Error deleting transaction type. Please try again.', 'danger');
    }
}

function resetTransactionTypeForm() {
    editingTransactionTypeId = null;
    document.getElementById('transactionTypeForm').reset();
    document.getElementById('transactionTypeModalTitle').textContent = 'Add Transaction Type';
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}