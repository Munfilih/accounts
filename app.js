// Firebase will be loaded via CDN

// App State
let currentUser = null;
let transactions = [];
let categories = [
    { id: 1, name: 'Food', color: '#28a745' },
    { id: 2, name: 'Transport', color: '#007bff' },
    { id: 3, name: 'Entertainment', color: '#ffc107' },
    { id: 4, name: 'Salary', color: '#17a2b8' },
    { id: 5, name: 'Bills', color: '#dc3545' }
];

// DOM Elements
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    
    // Check Firebase auth state
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            showApp();
        } else {
            currentUser = null;
            authSection.classList.remove('d-none');
            appSection.classList.add('d-none');
        }
    });
});

function initializeApp() {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transactionDate').value = today;
}

function setupEventListeners() {
    // Auth form toggles
    document.getElementById('showSignup').addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthForms();
    });
    
    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthForms();
    });
    
    // Auth forms
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(e.target.dataset.section);
        });
    });
    
    // Forms
    document.getElementById('transactionForm').addEventListener('submit', handleAddTransaction);
    document.getElementById('categoryForm').addEventListener('submit', handleAddCategory);
    
    // Password strength checker
    document.getElementById('signupPassword').addEventListener('input', checkPasswordStrength);
}

function toggleAuthForms() {
    loginForm.classList.toggle('d-none');
    signupForm.classList.toggle('d-none');
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function checkPasswordStrength(e) {
    const password = e.target.value;
    const strengthBar = document.querySelector('.password-strength');
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    strengthBar.className = 'password-strength mt-1';
    if (strength === 0) strengthBar.style.width = '0%';
    else if (strength <= 2) {
        strengthBar.classList.add('password-weak');
        strengthBar.style.width = '33%';
    } else if (strength === 3) {
        strengthBar.classList.add('password-medium');
        strengthBar.style.width = '66%';
    } else {
        strengthBar.classList.add('password-strong');
        strengthBar.style.width = '100%';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!validateEmail(email)) {
        showError('loginEmail', 'Please enter a valid email');
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        // User will be handled by onAuthStateChanged
    } catch (error) {
        showError('loginPassword', error.message);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    if (!validateEmail(email)) {
        showError('signupEmail', 'Please enter a valid email');
        return;
    }
    
    if (password.length < 6) {
        showError('signupPassword', 'Password must be at least 6 characters');
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });
        
        // Create default categories for new user
        await createDefaultCategories(userCredential.user.uid);
    } catch (error) {
        showError('signupEmail', error.message);
    }
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    field.classList.add('is-invalid');
    field.nextElementSibling.textContent = message;
    
    setTimeout(() => {
        field.classList.remove('is-invalid');
    }, 3000);
}

async function handleLogout() {
    try {
        await auth.signOut();
        // Reset forms
        loginForm.reset();
        signupForm.reset();
        loginForm.classList.remove('d-none');
        signupForm.classList.add('d-none');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function showApp() {
    authSection.classList.add('d-none');
    appSection.classList.remove('d-none');
    
    document.getElementById('userName').textContent = currentUser.displayName || currentUser.email;
    
    await loadUserCurrency(currentUser.uid);
    await loadCategories();
    showSection('overview');
}

function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    
    // Show selected section
    document.getElementById(section + 'Section').classList.remove('d-none');
    
    // Update navigation
    document.querySelectorAll('[data-section]').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // Load section data
    switch(section) {
        case 'overview':
            loadOverview();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'categories':
            loadCategoriesSection();
            break;
        case 'recurring':
            loadRecurring();
            break;
        case 'invoices':
            loadInvoices();
            break;
    }
}

async function loadCategories() {
    try {
        const querySnapshot = await db.collection('categories').where('userId', '==', currentUser.uid).get();
        
        categories = [];
        querySnapshot.forEach((doc) => {
            categories.push({ id: doc.id, ...doc.data() });
        });
        
        const select = document.getElementById('transactionCategory');
        select.innerHTML = '';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function getUserTransactions() {
    try {
        const querySnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .get();
        
        transactions = [];
        querySnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        
        return transactions;
    } catch (error) {
        console.error('Error loading transactions:', error);
        return [];
    }
}

async function loadOverview() {
    const userTransactions = await getUserTransactions();
    
    const income = userTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const expenses = userTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(expenses);
    document.getElementById('netBalance').textContent = formatCurrency(income - expenses);
    
    // Recent transactions
    const recent = userTransactions.slice(0, 5);
    
    const recentHtml = recent.map(t => {
        const category = categories.find(c => c.id == t.categoryId);
        return `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                    <strong>${t.description}</strong>
                    <br><small class="text-muted">${category?.name || 'Unknown'} • ${t.date}</small>
                </div>
                <span class="amount-${t.type}">${formatCurrency(t.amount)}</span>
            </div>
        `;
    }).join('');
    
    document.getElementById('recentTransactions').innerHTML = recent.length ? recentHtml : '<p class="text-muted">No transactions yet</p>';
}

async function loadTransactions() {
    const userTransactions = await getUserTransactions();
    const tbody = document.getElementById('transactionsTable');
    
    const html = userTransactions.map(t => {
        const category = categories.find(c => c.id == t.categoryId);
        return `
            <tr>
                <td>${t.date}</td>
                <td>${t.description}</td>
                <td><span class="badge" style="background-color: ${category?.color || '#6c757d'}">${category?.name || 'Unknown'}</span></td>
                <td class="amount-${t.type}">${formatCurrency(t.amount)}</td>
                <td><span class="badge bg-${t.type === 'income' ? 'success' : 'danger'}">${t.type}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction('${t.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center text-muted">No transactions found</td></tr>';
}

async function handleAddTransaction(e) {
    e.preventDefault();
    
    const transaction = {
        userId: currentUser.uid,
        date: document.getElementById('transactionDate').value,
        description: document.getElementById('transactionDescription').value,
        categoryId: document.getElementById('transactionCategory').value,
        amount: parseFloat(document.getElementById('transactionAmount').value),
        type: document.getElementById('transactionType').value,
        createdAt: new Date().toISOString()
    };
    
    try {
        await db.collection('transactions').add(transaction);
        
        // Reset form and close modal
        document.getElementById('transactionForm').reset();
        document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
        bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
        
        // Refresh current view
        const activeSection = document.querySelector('[data-section].active').dataset.section;
        showSection(activeSection);
    } catch (error) {
        console.error('Error adding transaction:', error);
    }
}

async function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        try {
            await db.collection('transactions').doc(id).delete();
            
            const activeSection = document.querySelector('[data-section].active').dataset.section;
            showSection(activeSection);
        } catch (error) {
            console.error('Error deleting transaction:', error);
        }
    }
}

function loadCategoriesSection() {
    const container = document.getElementById('categoriesList');
    
    const html = categories.map(cat => `
        <div class="category-item d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
                <div class="me-3" style="width: 20px; height: 20px; background-color: ${cat.color}; border-radius: 50%;"></div>
                <strong>${cat.name}</strong>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${cat.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    container.innerHTML = html || '<p class="text-muted">No categories found</p>';
}

async function handleAddCategory(e) {
    e.preventDefault();
    
    const category = {
        userId: currentUser.uid,
        name: document.getElementById('categoryName').value,
        color: document.getElementById('categoryColor').value
    };
    
    try {
        await db.collection('categories').add(category);
        
        // Reset form and close modal
        document.getElementById('categoryForm').reset();
        document.getElementById('categoryColor').value = '#007bff';
        bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
        
        await loadCategories();
        loadCategoriesSection();
    } catch (error) {
        console.error('Error adding category:', error);
    }
}

async function deleteCategory(id) {
    if (confirm('Are you sure you want to delete this category?')) {
        try {
            await db.collection('categories').doc(id).delete();
            
            await loadCategories();
            loadCategoriesSection();
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    }
}

async function createDefaultCategories(userId) {
    const defaultCategories = [
        { name: 'Food', color: '#28a745' },
        { name: 'Transport', color: '#007bff' },
        { name: 'Entertainment', color: '#ffc107' },
        { name: 'Salary', color: '#17a2b8' },
        { name: 'Bills', color: '#dc3545' }
    ];
    
    try {
        for (const category of defaultCategories) {
            await db.collection('categories').add({
                ...category,
                userId: userId
            });
        }
    } catch (error) {
        console.error('Error creating default categories:', error);
    }
}

function loadRecurring() {
    const container = document.getElementById('recurringList');
    container.innerHTML = '<p class="text-muted">Recurring transactions feature coming soon...</p>';
}

function loadInvoices() {
    const container = document.getElementById('invoicesList');
    container.innerHTML = '<p class="text-muted">Invoice management feature coming soon...</p>';
}