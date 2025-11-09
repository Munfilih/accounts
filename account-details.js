// Account Details State
let currentUser = null;
let currentAccount = null;
let accountTransactions = [];
let accountTypes = [];

// Get account ID from URL
const urlParams = new URLSearchParams(window.location.search);
const accountId = urlParams.get('id');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    
    if (!accountId) {
        window.location.href = 'accounts.html';
        return;
    }
    
    // Check Firebase auth state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('User authenticated:', user.uid);
            console.log('Account ID:', accountId);
            
            // Wait for transaction form to load, then initialize
            const waitForForm = setInterval(() => {
                if (document.getElementById('transactionModal')) {
                    clearInterval(waitForForm);
                    
                    // Initialize common transaction form
                    TransactionFormInstance.init(user, async () => {
                        await loadTransactions();
                        renderTransactions();
                        renderAccountDetails();
                    });
                }
            }, 100);
            
            try {
                await loadAccountTypes();
                console.log('Account types loaded:', accountTypes.length);
                
                await loadAccountDetails();
                console.log('Account details loaded:', currentAccount);
                
                await loadTransactions();
                console.log('Transactions loaded:', accountTransactions.length);
                
                renderAccountDetails();
                renderTransactions();
            } catch (error) {
                console.error('Error during initialization:', error);
            }
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
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    

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
    } catch (error) {
        console.error('Error loading account types:', error);
    }
}

async function loadAccountDetails() {
    try {
        const doc = await db.collection('accounts').doc(accountId).get();
        
        if (doc.exists && doc.data().userId === currentUser.uid) {
            currentAccount = { id: doc.id, ...doc.data() };
        } else {
            window.location.href = 'accounts.html';
        }
    } catch (error) {
        console.error('Error loading account details:', error);
        window.location.href = 'accounts.html';
    }
}

async function loadTransactions() {
    try {
        const querySnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .where('accountId', '==', accountId)
            .get();
        
        accountTransactions = [];
        querySnapshot.forEach((doc) => {
            accountTransactions.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by date descending
        accountTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function renderAccountDetails() {
    if (!currentAccount) return;
    
    // Update page title
    document.getElementById('accountTitle').textContent = `${currentAccount.name} - Details`;
    
    // Account information
    document.getElementById('accountName').textContent = currentAccount.name;
    document.getElementById('accountType').textContent = getAccountTypeName(currentAccount.type);
    document.getElementById('accountDescription').textContent = currentAccount.description || 'No description';
    document.getElementById('createdDate').textContent = currentAccount.createdAt ? new Date(currentAccount.createdAt).toLocaleDateString() : 'Unknown';
    
    // Calculate statistics
    const stats = calculateAccountStats();
    
    // Update statistics
    document.getElementById('currentBalance').textContent = `₹${formatBalance(stats.balance)}`;
    document.getElementById('currentBalance').className = `mb-0 ${getBalanceClass(stats.balance)}`;
    document.getElementById('totalTransactions').textContent = stats.totalTransactions;
    document.getElementById('totalReceived').textContent = `₹${formatBalance(stats.totalReceived)}`;
    document.getElementById('totalPaid').textContent = `₹${formatBalance(stats.totalPaid)}`;
}

function calculateAccountStats() {
    let balance = 0;
    let totalReceived = 0;
    let totalPaid = 0;
    
    accountTransactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        
        if (transaction.type === 'receive') {
            totalReceived += amount;
            balance -= amount;
        } else if (transaction.type === 'pay') {
            totalPaid += amount;
            balance += amount;
        }
    });
    
    return {
        balance,
        totalTransactions: accountTransactions.length,
        totalReceived,
        totalPaid
    };
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');
    const filterType = document.getElementById('filterType').value;
    
    let filteredTransactions = accountTransactions;
    if (filterType !== 'all') {
        filteredTransactions = accountTransactions.filter(t => t.type === filterType);
    }
    
    if (filteredTransactions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-exchange-alt fa-2x mb-2"></i>
                <p>No transactions found</p>
            </div>
        `;
        return;
    }
    
    const html = filteredTransactions.map(transaction => {
        const typeClass = transaction.type === 'receive' ? 'text-success' : 'text-danger';
        const typeIcon = transaction.type === 'receive' ? 'fa-arrow-down' : 'fa-arrow-up';
        const typeText = transaction.type === 'receive' ? 'Received' : 'Paid';
        
        return `
            <div class="transaction-item">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <div class="d-flex align-items-center">
                            <i class="fas ${typeIcon} ${typeClass} me-3"></i>
                            <div>
                                <h6 class="mb-1">${typeText}</h6>
                                <small class="text-muted">${transaction.date} • ${transaction.subType || 'General'}</small>
                                ${transaction.description ? `<br><small class="text-muted">${transaction.description}</small>` : ''}
                                ${transaction.enableEMI ? `<br><small class="text-info">EMI: ${transaction.emiNumbers} ${transaction.emiType}s @ ₹${parseFloat(transaction.emiAmount).toFixed(2)}</small>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4 text-end">
                        <div class="fw-bold ${typeClass} h5">
                            ₹${parseFloat(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <small class="text-muted">${transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : 'Unknown time'}</small>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function filterTransactions() {
    renderTransactions();
}

function getAccountTypeName(typeId) {
    const type = accountTypes.find(t => t.id === typeId);
    return type ? type.name : 'Unknown';
}

function getBalanceClass(balance) {
    if (balance > 0) return 'text-success';
    if (balance < 0) return 'text-danger';
    return 'text-muted';
}

function formatBalance(balance) {
    return Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function addReceipt() {
    await TransactionFormInstance.showReceiptModal(accountId);
}

async function addPayment() {
    await TransactionFormInstance.showPaymentModal(accountId);
}

function editAccount() {
    window.location.href = `accounts.html?action=edit&account=${accountId}`;
}

async function handleLogout() {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}