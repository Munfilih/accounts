// Accounts App State
let currentUser = null;
let accounts = [];
let accountTypes = [];
let editingAccountId = null;
let currentTransactionType = '';
let currentAccountId = '';
let editingTransactionId = null;
let allTransactions = [];

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    
    // Check Firebase auth state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            
            // Wait for transaction form to load, then initialize
            const waitForForm = setInterval(() => {
                if (document.getElementById('transactionModal')) {
                    clearInterval(waitForForm);
                    
                    // Initialize common transaction form
                    TransactionFormInstance.init(user, async () => {
                        await loadTransactions();
                        renderAccounts();
                        renderTransactions(allTransactions);
                    });
                    
                    // Share transactions data with form instance
                    TransactionFormInstance.allTransactions = allTransactions;
                }
            }, 100);
            
            await loadAccountTypes();
            await loadTransactions();
            await loadAccounts();
            renderTransactions(allTransactions);
            handleUrlParams();
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
    
    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
        });
        
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
    
    // Account form
    document.getElementById('accountForm').addEventListener('submit', handleSaveAccount);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Reset form when modal is hidden
    document.getElementById('accountModal').addEventListener('hidden.bs.modal', resetForm);
    
    // Quick type form
    document.getElementById('quickTypeForm').addEventListener('submit', handleQuickAddType);
}

async function loadAccounts() {
    try {
        const querySnapshot = await db.collection('accounts')
            .where('userId', '==', currentUser.uid)
            .get();
        
        accounts = [];
        querySnapshot.forEach((doc) => {
            accounts.push({ id: doc.id, ...doc.data() });
        });
        
        renderAccounts();
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

function renderAccounts() {
    const container = document.getElementById('accountsList');
    
    if (accounts.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    <i class="fas fa-university fa-2x mb-2"></i>
                    <p>No accounts created yet</p>
                </td>
            </tr>
        `;
        updateBalanceSummary();
        return;
    }
    
    const html = accounts.map(account => {
        const balance = calculateAccountBalance(account.id);
        const status = balance > 0 ? 'Active' : balance < 0 ? 'Overdue' : 'Zero';
        const statusClass = balance > 0 ? 'status-active' : balance < 0 ? 'text-danger' : 'text-muted';
        
        return `
            <tr style="cursor: pointer;" onclick="showAccountDetails('${account.id}')">
                <td>
                    <div class="fw-bold">${account.name}</div>
                    <small class="text-muted d-block d-sm-none">${getAccountTypeName(account.type)}</small>
                    <small class="text-muted">${account.description || ''}</small>
                </td>
                <td class="d-none-mobile">${getAccountTypeName(account.type)}</td>
                <td class="fw-bold ${getBalanceClass(balance)}">₹${formatBalance(balance)}</td>
                <td class="d-none-mobile"><span class="${statusClass}">● ${status}</span></td>
                <td>
                    <i class="fas fa-arrow-down me-1" onclick="event.stopPropagation(); receivePayment('${account.id}')" title="Receipt" style="cursor: pointer; color: var(--color-success);"></i>
                    <i class="fas fa-arrow-up me-1" onclick="event.stopPropagation(); makePayment('${account.id}')" title="Payment" style="cursor: pointer; color: var(--color-warning);"></i>
                    <i class="fas fa-edit me-1 d-none d-sm-inline" onclick="event.stopPropagation(); editAccount('${account.id}')" title="Edit" style="cursor: pointer; color: var(--text-secondary);"></i>
                    <i class="fas fa-trash d-none d-sm-inline" onclick="event.stopPropagation(); deleteAccount('${account.id}')" title="Delete" style="cursor: pointer; color: var(--text-secondary);"></i>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = html;
    updateBalanceSummary();
}

function updateBalanceSummary() {
    let totalReceivable = 0;
    let totalPayable = 0;
    
    accounts.forEach(account => {
        const balance = calculateAccountBalance(account.id);
        if (balance > 0) {
            totalReceivable += balance;
        } else if (balance < 0) {
            totalPayable += Math.abs(balance);
        }
    });
    
    const netBalance = totalReceivable - totalPayable;
    const balanceText = `${accounts.length} accounts • Receivable: ₹${totalReceivable.toFixed(2)} • Payable: ₹${totalPayable.toFixed(2)} • Net: ₹${netBalance.toFixed(2)}`;
    
    document.getElementById('balanceText').textContent = balanceText;
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
        
        if (accountTypes.length === 0) {
            await createDefaultAccountTypes();
        }
        
        const select = document.getElementById('accountType');
        select.innerHTML = '<option value="">Select account type</option>';
        
        accountTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = type.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading account types:', error);
    }
}

async function createDefaultAccountTypes() {
    const defaultTypes = [
        { name: 'Cash', category: 'asset' },
        { name: 'Bank Account', category: 'asset' },
        { name: 'Savings Account', category: 'asset' },
        { name: 'Accounts Receivable', category: 'asset' },
        { name: 'Loan Receivable', category: 'asset' },
        { name: 'Accounts Payable', category: 'liability' },
        { name: 'Loan Payable', category: 'liability' },
        { name: 'Credit Card', category: 'liability' }
    ];
    
    try {
        for (const type of defaultTypes) {
            const docRef = await db.collection('account_types').add({
                ...type,
                userId: currentUser.uid,
                createdAt: new Date().toISOString()
            });
            accountTypes.push({ id: docRef.id, ...type });
        }
    } catch (error) {
        console.error('Error creating default account types:', error);
    }
}

function getAccountTypeName(typeId) {
    const type = accountTypes.find(t => t.id === typeId);
    return type ? type.name : 'Unknown';
}

function calculateAccountBalance(accountId) {
    if (!allTransactions || allTransactions.length === 0) {
        return 0;
    }
    
    const accountTransactions = allTransactions.filter(t => t.accountId === accountId);
    let balance = 0;
    
    accountTransactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        if (transaction.type === 'pay') {
            balance += amount;
        } else if (transaction.type === 'receive') {
            balance -= amount;
        }
    });
    
    return balance;
}

function getBalanceClass(balance) {
    if (balance > 0) return 'text-success';
    if (balance < 0) return 'text-danger';
    return 'text-muted';
}

function formatBalance(balance) {
    return Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadTransactions() {
    try {
        const querySnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .get();
        
        allTransactions = [];
        querySnapshot.forEach((doc) => {
            allTransactions.push({ id: doc.id, ...doc.data() });
        });
        
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function renderTransactions(transactions) {
    const container = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-exchange-alt fa-2x mb-2"></i>
                <p>No transactions yet</p>
            </div>
        `;
        return;
    }
    
    const html = transactions.slice(0, 10).map(transaction => {
        const account = accounts.find(a => a.id === transaction.accountId);
        const accountName = account ? account.name : 'Unknown Account';
        const typeClass = transaction.type === 'receive' ? 'text-success' : 'text-danger';
        const typeIcon = transaction.type === 'receive' ? 'fa-arrow-down' : 'fa-arrow-up';
        const typeText = transaction.type === 'receive' ? 'Received' : 'Paid';
        
        return `
            <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
                <div class="d-flex align-items-center flex-grow-1">
                    <i class="fas ${typeIcon} ${typeClass} me-3"></i>
                    <div>
                        <h6 class="mb-1" style="cursor: pointer;" onclick="showTransactionDetails('${transaction.id}')">${typeText} - ${accountName}</h6>
                        <small class="text-muted">${transaction.date}</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold ${typeClass}">
                        ₹${parseFloat(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

async function receivePayment(accountId) {
    await TransactionFormInstance.showReceiptModal(accountId);
}

async function makePayment(accountId) {
    await TransactionFormInstance.showPaymentModal(accountId);
}

async function showReceiptModal() {
    await TransactionFormInstance.showReceiptModal();
}

async function showPaymentModal() {
    await TransactionFormInstance.showPaymentModal();
}

async function handleSaveAccount(e) {
    e.preventDefault();
    
    const accountData = {
        name: document.getElementById('accountName').value.trim(),
        type: document.getElementById('accountType').value,
        description: document.getElementById('accountDescription').value.trim(),
        userId: currentUser.uid
    };
    
    if (!accountData.name || !accountData.type) {
        showAlert('Please fill in all required fields.', 'warning');
        return;
    }
    
    try {
        if (editingAccountId) {
            await db.collection('accounts').doc(editingAccountId).update({
                ...accountData,
                updatedAt: new Date().toISOString()
            });
            showAlert('Account updated successfully!', 'success');
        } else {
            await db.collection('accounts').add({
                ...accountData,
                createdAt: new Date().toISOString()
            });
            showAlert('Account created successfully!', 'success');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('accountModal')).hide();
        setTimeout(async () => {
            await loadTransactions();
            await loadAccounts();
        }, 500);
    } catch (error) {
        console.error('Error saving account:', error);
        showAlert('Error saving account. Please try again.', 'danger');
    }
}

function editAccount(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;
    
    editingAccountId = accountId;
    
    document.getElementById('accountName').value = account.name;
    document.getElementById('accountType').value = account.type;
    document.getElementById('accountDescription').value = account.description || '';
    
    document.getElementById('accountModalTitle').textContent = 'Edit Account';
    
    new bootstrap.Modal(document.getElementById('accountModal')).show();
}

async function deleteAccount(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;
    
    if (!confirm(`Are you sure you want to delete "${account.name}"? This will also delete all related transactions. This action cannot be undone.`)) {
        return;
    }
    
    try {
        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .where('accountId', '==', accountId)
            .get();
        
        const batch = db.batch();
        transactionsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        batch.delete(db.collection('accounts').doc(accountId));
        
        await batch.commit();
        
        showAlert('Account and related transactions deleted successfully!', 'success');
        await loadTransactions();
        await loadAccounts();
    } catch (error) {
        console.error('Error deleting account:', error);
        showAlert('Error deleting account. Please try again.', 'danger');
    }
}

function resetForm() {
    editingAccountId = null;
    document.getElementById('accountForm').reset();
    document.getElementById('accountModalTitle').textContent = 'Add New Account';
}

async function handleLogout() {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function handleQuickAddType(e) {
    e.preventDefault();
    
    const name = document.getElementById('quickTypeName').value.trim();
    if (!name) return;
    
    try {
        const docRef = await db.collection('account_types').add({
            name: name,
            userId: currentUser.uid,
            createdAt: new Date().toISOString()
        });
        
        accountTypes.push({ id: docRef.id, name: name });
        
        const select = document.getElementById('accountType');
        const option = document.createElement('option');
        option.value = docRef.id;
        option.textContent = name;
        option.selected = true;
        select.appendChild(option);
        
        bootstrap.Modal.getInstance(document.getElementById('quickTypeModal')).hide();
        document.getElementById('quickTypeForm').reset();
        
        showAlert('Account type added successfully!', 'success');
    } catch (error) {
        console.error('Error adding account type:', error);
        showAlert('Error adding account type.', 'danger');
    }
}

function showTransactionDetails(transactionId) {
    const transaction = allTransactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    const account = accounts.find(a => a.id === transaction.accountId);
    const typeText = transaction.type === 'receive' ? 'Received' : 'Paid';
    const typeClass = transaction.type === 'receive' ? 'text-success' : 'text-danger';
    
    document.getElementById('transactionDetailsTitle').textContent = `${typeText} Transaction`;
    document.getElementById('detailTransactionAmount').innerHTML = `<span class="${typeClass}">₹${parseFloat(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
    document.getElementById('detailTransactionDate').textContent = transaction.date;
    document.getElementById('detailTransactionType').innerHTML = `<span class="badge bg-${transaction.type === 'receive' ? 'success' : 'danger'}">${typeText}</span>`;
    document.getElementById('detailTransactionAccount').textContent = account ? account.name : 'Unknown Account';
    
    // Store current transaction for edit/delete
    currentTransactionForEdit = transactionId;
    
    new bootstrap.Modal(document.getElementById('transactionDetailsModal')).show();
}

let currentTransactionForEdit = null;

function editTransaction() {
    if (!currentTransactionForEdit) return;
    
    // Close details modal first
    const detailsModal = bootstrap.Modal.getInstance(document.getElementById('transactionDetailsModal'));
    if (detailsModal) {
        detailsModal.hide();
    }
    
    // Wait a bit for modal to close, then open edit form
    setTimeout(() => {
        TransactionFormInstance.editTransaction(currentTransactionForEdit);
    }, 300);
}

async function deleteTransaction() {
    if (!currentTransactionForEdit) return;
    
    const transaction = allTransactions.find(t => t.id === currentTransactionForEdit);
    if (!transaction) return;
    
    const account = accounts.find(a => a.id === transaction.accountId);
    const accountName = account?.name || 'Unknown Account';
    
    if (!confirm(`Delete ${transaction.type} transaction of ₹${transaction.amount} for ${accountName}?`)) {
        return;
    }
    
    try {
        await db.collection('transactions').doc(currentTransactionForEdit).delete();
        showAlert('Transaction deleted successfully!', 'success');
        
        // Close modal and refresh data
        bootstrap.Modal.getInstance(document.getElementById('transactionDetailsModal')).hide();
        await loadTransactions();
        await loadAccounts();
        renderTransactions(allTransactions);
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showAlert('Error deleting transaction.', 'danger');
    }
}

function showAccountDetails(accountId) {
    window.location.href = `account-details.html?id=${accountId}`;
}

function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const accountId = urlParams.get('account');
    
    if (action && accountId) {
        setTimeout(() => {
            if (action === 'receipt') {
                receivePayment(accountId);
            } else if (action === 'payment') {
                makePayment(accountId);
            } else if (action === 'edit') {
                editAccount(accountId);
            }
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 1000);
    }
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